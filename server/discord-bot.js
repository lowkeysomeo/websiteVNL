import { getDiscordSettings, processDiscordReply } from "./discord.js";

let activeBot = null;

export function isDiscordBotConnected() {
  return Boolean(activeBot && activeBot.isConnected);
}

export async function stopDiscordBot() {
  if (activeBot) {
    activeBot.destroy();
    activeBot = null;
  }
}

export async function reloadDiscordBot(db, config, options = {}) {
  await stopDiscordBot();
  return startDiscordBot(db, config, options);
}

export async function startDiscordBot(db, config, options = {}) {
  await stopDiscordBot();

  let settings = null;
  try {
    settings = await getDiscordSettings(db);
  } catch (err) {
    console.error("[Discord Bot] Failed to load settings:", err.message);
  }

  const botToken = String(
    settings?.botToken || config?.discordBotToken || process.env.DISCORD_BOT_TOKEN || "",
  ).trim();

  const isEnabled = settings?.botEnabled !== undefined ? settings.botEnabled : Boolean(botToken);

  if (!isEnabled || !botToken) {
    return null;
  }

  const fetchFn = options.fetchFn || globalThis.fetch;
  const WebSocketCtor = options.WebSocket || globalThis.WebSocket;

  if (typeof WebSocketCtor !== "function") {
    console.warn("[Discord Bot] WebSocket is not supported in this runtime environment.");
    return null;
  }

  let ws = null;
  let heartbeatInterval = null;
  let reconnectTimer = null;
  let lastSequence = null;
  let isDestroyed = false;
  let reconnectAttempts = 0;

  const botInstance = {
    isConnected: false,
    appId: null,
    destroy() {
      isDestroyed = true;
      botInstance.isConnected = false;
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (ws) {
        try {
          ws.close(1000, "Bot stopped");
        } catch {}
        ws = null;
      }
    },
  };

  activeBot = botInstance;

  async function registerSlashCommands(appId) {
    if (!appId || !botToken) return;
    try {
      const commands = [
        {
          name: "rep",
          description: "Phản hồi tin nhắn trực tiếp tới khách hàng trên đơn hàng webVNL",
          options: [
            {
              name: "don_hang",
              description: "Mã đơn hàng (ví dụ: VNL-4E1AC7B7)",
              type: 3, // STRING
              required: true,
            },
            {
              name: "tin_nhan",
              description: "Nội dung tin nhắn muốn gửi cho khách hàng",
              type: 3, // STRING
              required: true,
            },
          ],
        },
      ];

      await fetchFn(`https://discord.com/api/v10/applications/${appId}/commands`, {
        method: "PUT",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(commands),
        signal: AbortSignal.timeout(10000),
      });
    } catch (err) {
      console.warn("[Discord Bot] Slash commands auto-registration warning:", err.message);
    }
  }

  async function sendDiscordRest(endpoint, method = "GET", body = null) {
    try {
      const res = await fetchFn(`https://discord.com/api/v10${endpoint}`, {
        method,
        headers: {
          Authorization: `Bot ${botToken}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(8000),
      });
      return res;
    } catch (err) {
      console.error(`[Discord Bot REST Error] ${method} ${endpoint}:`, err.message);
      return null;
    }
  }

  function connect() {
    if (isDestroyed) return;

    try {
      ws = new WebSocketCtor("wss://gateway.discord.gg/?v=10&encoding=json");
    } catch (err) {
      console.error("[Discord Bot] Failed to create WebSocket:", err.message);
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      reconnectAttempts = 0;
    };

    ws.onmessage = async (event) => {
      if (isDestroyed) return;

      let payload = null;
      try {
        payload = JSON.parse(typeof event.data === "string" ? event.data : event.data.toString());
      } catch {
        return;
      }

      if (payload.s !== null && payload.s !== undefined) {
        lastSequence = payload.s;
      }

      // Opcode 10: Hello -> start heartbeat & identify
      if (payload.op === 10) {
        const interval = payload.d?.heartbeat_interval || 41250;
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(() => {
          if (ws && ws.readyState === WebSocketCtor.OPEN) {
            ws.send(JSON.stringify({ op: 1, d: lastSequence }));
          }
        }, interval);

        // Opcode 2: Identify
        const identifyPayload = {
          op: 2,
          d: {
            token: botToken,
            intents: 513 | 32768, // GUILDS | GUILD_MESSAGES | MESSAGE_CONTENT
            properties: {
              os: process.platform || "windows",
              browser: "vietnam-legacy-store",
              device: "vietnam-legacy-store",
            },
          },
        };
        ws.send(JSON.stringify(identifyPayload));
        return;
      }

      // Opcode 1: Heartbeat requested by Discord
      if (payload.op === 1) {
        if (ws && ws.readyState === WebSocketCtor.OPEN) {
          ws.send(JSON.stringify({ op: 1, d: lastSequence }));
        }
        return;
      }

      // Opcode 7 or 9: Reconnect or Invalid Session
      if (payload.op === 7 || payload.op === 9) {
        if (ws) {
          try { ws.close(); } catch {}
        }
        return;
      }

      // Opcode 0: Dispatch Events
      if (payload.op === 0) {
        const eventName = payload.t;
        const data = payload.d;

        if (eventName === "READY") {
          botInstance.isConnected = true;
          botInstance.appId = data.user?.id || null;
          console.log(`[Discord Bot] Kết nối thành công bot: ${data.user?.username} (${data.user?.id})`);
          if (botInstance.appId) {
            void registerSlashCommands(botInstance.appId);
          }
          return;
        }

        // Handle incoming messages for reply
        if (eventName === "MESSAGE_CREATE") {
          if (!data || data.author?.bot) return;

          let targetOrderId = null;
          let replyContent = null;

          // 1. Check for command: !rep <orderId> <message> or !reply <orderId> <message>
          const cmdMatch = String(data.content || "").trim().match(/^!(?:rep|reply)\s+([A-Za-z0-9_-]+)\s+(.+)$/is);
          if (cmdMatch) {
            targetOrderId = cmdMatch[1].trim().toUpperCase();
            replyContent = cmdMatch[2].trim();
          } else if (data.referenced_message) {
            // 2. Check for Quote Reply to an order notification message
            const refMsg = data.referenced_message;
            const refText = [
              refMsg.content || "",
              ...(refMsg.embeds || []).flatMap((e) => [
                e.title || "",
                e.description || "",
                ...(e.fields || []).flatMap((f) => [f.name, f.value]),
              ]),
            ].join(" ");

            const matchOrder = refText.match(/VNL-[A-Za-z0-9_-]+/i);
            if (matchOrder) {
              targetOrderId = matchOrder[0].trim().toUpperCase();
              replyContent = String(data.content || "").trim();
            }
          }

          if (targetOrderId && replyContent) {
            const authorId = data.author?.id;
            const authorName = data.author?.global_name || data.author?.username || "Discord User";

            const result = await processDiscordReply({
              db,
              authorId,
              authorName,
              orderId: targetOrderId,
              replyText: replyContent,
            });

            if (result.success) {
              // React with green checkmark
              await sendDiscordRest(
                `/channels/${data.channel_id}/messages/${data.id}/reactions/${encodeURIComponent("✅")}/@me`,
                "PUT",
              );
              // Send confirmation message
              await sendDiscordRest(`/channels/${data.channel_id}/messages`, "POST", {
                content: `💬 **[${result.senderName}]** Đã gửi phản hồi tới khách hàng trên đơn \`${result.order.id}\`:\n> ${replyContent}`,
                message_reference: { message_id: data.id },
              });
            } else {
              // React with warning icon
              await sendDiscordRest(
                `/channels/${data.channel_id}/messages/${data.id}/reactions/${encodeURIComponent("⚠️")}/@me`,
                "PUT",
              );
              // Send error feedback
              await sendDiscordRest(`/channels/${data.channel_id}/messages`, "POST", {
                content: `⚠️ **Không thể gửi tin nhắn:** ${result.message}`,
                message_reference: { message_id: data.id },
              });
            }
          }
          return;
        }

        // Handle slash command interactions over gateway if any
        if (eventName === "INTERACTION_CREATE") {
          if (data.type === 2 && (data.data?.name === "rep" || data.data?.name === "reply")) {
            const options = data.data.options || [];
            const orderOption = options.find((o) => o.name === "don_hang" || o.name === "order" || o.name === "order_id");
            const msgOption = options.find((o) => o.name === "tin_nhan" || o.name === "message");

            const orderId = orderOption?.value;
            const replyText = msgOption?.value;
            const authorId = data.member?.user?.id || data.user?.id;
            const authorName = data.member?.user?.global_name || data.member?.user?.username || data.user?.username;

            const result = await processDiscordReply({
              db,
              authorId,
              authorName,
              orderId,
              replyText,
            });

            const content = result.success
              ? `✅ **[${result.senderName}]** Đã gửi phản hồi tới khách hàng trên đơn \`${result.order.id}\`:\n> ${replyText}`
              : `⚠️ ${result.message}`;

            await sendDiscordRest(`/interactions/${data.id}/${data.token}/callback`, "POST", {
              type: 4,
              data: {
                content,
                flags: result.success ? 0 : 64, // Ephemeral if error
              },
            });
          }
        }
      }
    };

    ws.onclose = (event) => {
      botInstance.isConnected = false;
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      if (!isDestroyed) {
        // Code 4004 = Authentication failed (bad token)
        if (event.code === 4004) {
          console.error("[Discord Bot] Token bot Discord không chính xác (Close code 4004). Dừng kết nối.");
          return;
        }
        scheduleReconnect();
      }
    };

    ws.onerror = (err) => {
      console.warn("[Discord Bot WebSocket Error]:", err?.message || err);
    };
  }

  function scheduleReconnect() {
    if (isDestroyed || reconnectTimer) return;
    reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 30000);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  connect();
  return botInstance;
}

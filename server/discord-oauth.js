import { randomBytes, randomUUID } from "node:crypto";
import { passwordHash } from "./security.js";

export function getDiscordAuthorizeUrl({ clientId, redirectUri, state, prompt = "consent" }) {
  const url = new URL("https://discord.com/api/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify email");
  url.searchParams.set("state", state);
  if (prompt) url.searchParams.set("prompt", prompt);
  return url.toString();
}

export async function exchangeDiscordCode(
  { code, clientId, clientSecret, redirectUri },
  fetchFn = globalThis.fetch,
) {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetchFn("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Discord OAuth2 token exchange failed (${res.status}): ${errText}`);
  }

  return await res.json();
}

export async function fetchDiscordUser(accessToken, fetchFn = globalThis.fetch) {
  const res = await fetchFn("https://discord.com/api/users/@me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Discord API fetch user failed (${res.status}): ${errText}`);
  }

  return await res.json();
}

export function computeDiscordAvatarUrl(discordId, avatarHash) {
  if (!discordId) return null;
  if (avatarHash) {
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png`;
  }
  try {
    const index = Number(BigInt(discordId) >> 22n) % 6;
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  } catch {
    return "https://cdn.discordapp.com/embed/avatars/0.png";
  }
}

export async function syncDiscordUser(db, discordUser, existingUserId = null) {
  const discordId = String(discordUser.id || "").trim();
  if (!discordId) {
    throw new Error("Không nhận được Discord User ID từ Discord.");
  }

  const username = String(discordUser.username || discordUser.tag || "").trim();
  const globalName = String(discordUser.global_name || username || "").trim();
  const avatarUrl = computeDiscordAvatarUrl(discordId, discordUser.avatar);
  const email = discordUser.email
    ? String(discordUser.email).trim().toLowerCase()
    : `${discordId}@discord.vietnamlegacy.com`;

  // 1. If explicitly linking to an existing logged-in user
  if (existingUserId) {
    const user = await db.prepare("SELECT * FROM users WHERE id = ?").get(existingUserId);
    if (!user) {
      throw new Error("Không tìm thấy tài khoản người dùng hiện tại.");
    }
    // Check if another account is already linked to this discord_id
    const conflict = await db
      .prepare("SELECT id FROM users WHERE discord_id = ? AND id != ?")
      .get(discordId, existingUserId);
    if (conflict) {
      throw new Error("Tài khoản Discord này đã được liên kết với một người dùng khác.");
    }

    await db
      .prepare(
        `UPDATE users
         SET discord_id = ?, discord_username = ?, discord_global_name = ?, discord_avatar = ?
         WHERE id = ?`,
      )
      .run(discordId, username, globalName, avatarUrl, existingUserId);

    return await db.prepare("SELECT * FROM users WHERE id = ?").get(existingUserId);
  }

  // 2. Check if user already exists by discord_id
  let user = await db
    .prepare("SELECT * FROM users WHERE discord_id = ?")
    .get(discordId);

  if (user) {
    await db
      .prepare(
        `UPDATE users
         SET discord_username = ?, discord_global_name = ?, discord_avatar = ?
         WHERE id = ?`,
      )
      .run(username, globalName, avatarUrl, user.id);

    return await db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
  }

  // 3. Check if user exists by email (auto-link)
  if (discordUser.email) {
    user = await db
      .prepare("SELECT * FROM users WHERE LOWER(email) = ?")
      .get(email);

    if (user) {
      await db
        .prepare(
          `UPDATE users
           SET discord_id = ?, discord_username = ?, discord_global_name = ?, discord_avatar = ?
           WHERE id = ?`,
        )
        .run(discordId, username, globalName, avatarUrl, user.id);

      return await db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
    }
  }

  // 4. Create new user with Discord info
  const newId = randomUUID();
  const randomPass = randomBytes(32).toString("hex");
  const hash = await passwordHash(randomPass);
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO users (id, email, password_hash, created_at, discord_id, discord_username, discord_global_name, discord_avatar)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(newId, email, hash, now, discordId, username, globalName, avatarUrl);

  return await db.prepare("SELECT * FROM users WHERE id = ?").get(newId);
}

(() => {
  let adminKey = sessionStorage.getItem("vnl_admin_key") || "";
  let currentUser = null;
  let allOrders = [];
  let statsRequest = 0;
  let currentFilter = "all";
  let searchQuery = "";
  let lastAdminChatSync = 0;
  const openAdminChatDrawers = new Set();

  function getInitials(name) {
    if (!name || typeof name !== "string") return "KH";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "KH";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function getAvatarGradient(name) {
    const gradients = [
      "linear-gradient(135deg, #f97316, #ea580c)", // Cam ấm
      "linear-gradient(135deg, #06b6d4, #0284c7)", // Xanh ngọc
      "linear-gradient(135deg, #8b5cf6, #6d28d9)", // Tím
      "linear-gradient(135deg, #ec4899, #be185d)", // Hồng
      "linear-gradient(135deg, #10b981, #047857)", // Xanh lá
      "linear-gradient(135deg, #eab308, #ca8a04)", // Vàng hổ phách
      "linear-gradient(135deg, #6366f1, #4338ca)", // Chàm
    ];
    let hash = 0;
    const str = String(name || "Khach");
    for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) % gradients.length;
    return gradients[Math.abs(hash)];
  }

  function formatRelativeTime(ts) {
    if (!ts) return "";
    const now = Date.now();
    const diffSec = Math.floor((now - ts) / 1000);
    if (diffSec < 60) return "Vừa xong";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} phút`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} giờ`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay} ngày`;
    const diffWeek = Math.floor(diffDay / 7);
    return `${diffWeek} tuần`;
  }

  const loginScreen = document.querySelector("#admin-login-screen");
  const loginForm = document.querySelector("#admin-login-form");
  const loginError = document.querySelector("#admin-login-error");
  const passwordInput = document.querySelector("#admin-password-input");
  const adminApp = document.querySelector("#admin-app");
  const logoutBtn = document.querySelector("#admin-logout-btn");
  const refreshBtn = document.querySelector("#admin-refresh-btn");
  const searchInput = document.querySelector("#admin-search-input");
  const ordersContainer = document.querySelector("#admin-orders-list");
  const tabsContainer = document.querySelector("#admin-status-tabs");
  const toast = document.querySelector("#toast");

  function notify(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("visible");
    setTimeout(() => toast.classList.remove("visible"), 2500);
  }

  const formatCurrencyNumber = (val) =>
    new Intl.NumberFormat("vi-VN").format(Number(val) || 0);
  const money = (val) =>
    formatCurrencyNumber(val) + "đ";
  const moneyText = (val) =>
    formatCurrencyNumber(val) + "đ";

  const escapeHtml = (str) =>
    String(str ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );

  function renderAdminChatBubble(m) {
    const isShop = m.senderRole === "admin" || m.senderRole === "partner";
    const roleBadge = isShop
      ? `👑 ${escapeHtml(m.senderName || "Shop (Quản trị)")}`
      : `👤 ${escapeHtml(m.senderName || "Khách hàng")}`;
    const timeStr = m.createdAt
      ? new Date(m.createdAt).toLocaleString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          day: "2-digit",
          month: "2-digit",
        })
      : "";
    const safeText = escapeHtml(String(m.message ?? "")).trim();
    return `
      <div class="admin-chat-bubble ${isShop ? "bubble-admin" : "bubble-customer"}" data-msg-id="${escapeHtml(m.id || "")}">
        <div class="admin-bubble-header">
          <span class="admin-bubble-sender">${roleBadge}</span>
          <span class="admin-bubble-time">${timeStr}</span>
        </div>
        <div class="admin-bubble-text">${safeText || "(Nội dung trống)"}</div>
      </div>
    `;
  }

  async function api(path, options = {}) {
    let body = options.body;
    if (body && typeof body === "object" && !(typeof FormData !== "undefined" && body instanceof FormData)) {
      body = JSON.stringify(body);
    }
    const res = await fetch(path, {
      ...options,
      body,
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Key": adminKey,
        ...options.headers,
      },
    });
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error("Không thể xử lý phản hồi từ máy chủ.");
    }
    if (!res.ok) {
      throw new Error(data.error || "Yêu cầu thất bại.");
    }
    // Thao tác đơn/nạp thành công thì lấy lại thống kê ngay.
    if ((options.method || "GET").toUpperCase() !== "GET" && /^\/api\/admin\/(orders|deposits)(?:[/?]|$)/.test(path)) {
      void loadStats();
    }
    return data;
  }

  let loginMode = "admin";
  const tabLoginAdmin = document.querySelector("#tab-login-admin");
  const tabLoginPartner = document.querySelector("#tab-login-partner");
  const loginAdminFields = document.querySelector("#login-admin-fields");
  const loginPartnerFields = document.querySelector("#login-partner-fields");
  const partnerEmailInput = document.querySelector("#admin-partner-email-input");
  const partnerPasswordInput = document.querySelector("#admin-partner-password-input");
  const loginSubmitBtn = document.querySelector("#admin-login-submit-btn");
  const loginHint = document.querySelector("#admin-login-hint");
  const userBadge = document.querySelector("#admin-user-badge");

  function setLoginMode(mode) {
    loginMode = mode;
    loginError.hidden = true;
    if (mode === "partner") {
      tabLoginPartner.classList.add("active");
      tabLoginAdmin.classList.remove("active");
      loginAdminFields.style.display = "none";
      loginPartnerFields.style.display = "block";
      if (passwordInput) passwordInput.required = false;
      if (partnerEmailInput) partnerEmailInput.required = true;
      if (partnerPasswordInput) partnerPasswordInput.required = true;
      if (loginSubmitBtn) loginSubmitBtn.textContent = "Đăng nhập Đối tác 🤝";
      if (loginHint) loginHint.textContent = "Dành cho đối tác đăng nhập để bán và quản lý dịch vụ của mình.";
      partnerEmailInput?.focus();
    } else {
      tabLoginAdmin.classList.add("active");
      tabLoginPartner.classList.remove("active");
      loginAdminFields.style.display = "block";
      loginPartnerFields.style.display = "none";
      if (passwordInput) passwordInput.required = true;
      if (partnerEmailInput) partnerEmailInput.required = false;
      if (partnerPasswordInput) partnerPasswordInput.required = false;
      if (loginSubmitBtn) loginSubmitBtn.textContent = "Đăng nhập Quản trị 👑";
      if (loginHint) loginHint.textContent = "Dành cho quản trị viên quản lý đơn hàng, giá bán và các chương trình ưu đãi.";
      passwordInput?.focus();
    }
  }

  tabLoginAdmin?.addEventListener("click", () => setLoginMode("admin"));
  tabLoginPartner?.addEventListener("click", () => setLoginMode("partner"));

  function showLogin() {
    statsRequest += 1;
    for (const id of ["stat-total-orders", "stat-processing-orders", "stat-completed-orders", "stat-total-revenue"]) {
      document.querySelector("#" + id).textContent = "…";
    }
    document.querySelector("#admin-stats-feedback").textContent = "";
    loginScreen.hidden = false;
    adminApp.hidden = true;
    if (passwordInput) passwordInput.value = "";
    if (partnerPasswordInput) partnerPasswordInput.value = "";
    loginError.hidden = true;
  }

  function showDashboard(user = null) {
    const role = user?.role || sessionStorage.getItem("vnl_admin_role") || "admin";
    const email = user?.email || sessionStorage.getItem("vnl_admin_email") || "";
    const name = user?.name || sessionStorage.getItem("vnl_admin_name") || "";
    currentUser = { role, email, name };

    loginScreen.hidden = true;
    adminApp.hidden = false;

    const brandTitle = document.querySelector("#admin-brand-title");
    const brandSubtitle = document.querySelector("#admin-brand-subtitle");
    const annCard = document.querySelector("#admin-announcement-card") || document.querySelector(".admin-announcement-card");
    const discordCard = document.querySelector("#admin-discord-card");

    const ordersBtn = document.querySelector('[data-admin-view="orders"]');
    const pricesBtn = document.querySelector('[data-admin-view="prices"]');
    const depositsBtn = document.querySelector('[data-admin-view="deposits"]');
    const campaignsBtn = document.querySelector('[data-admin-view="campaigns"]');
    const couponsBtn = document.querySelector('[data-admin-view="coupons"]');
    const guideBtn = document.querySelector('[data-admin-view="guide"]');
    const contactsBtn = document.querySelector('[data-admin-view="contacts"]');
    const partnersBtn = document.querySelector('[data-admin-view="partners"]');

    if (role === "partner") {
      if (brandTitle) brandTitle.innerHTML = 'VietNam Legacy <span>ĐỐI TÁC</span>';
      if (brandSubtitle) brandSubtitle.textContent = 'Quản lý đơn hàng & dịch vụ của bạn';
      if (userBadge) {
        userBadge.innerHTML = `<span class="user-badge-role partner">🤝 Đối tác: <b>${escapeHtml(name || email)}</b></span>`;
      }
      if (annCard) annCard.hidden = true;
      if (discordCard) {
        discordCard.hidden = false;
        const discordTitle = document.querySelector("#admin-discord-title");
        const discordDesc = document.querySelector("#admin-discord-desc");
        const discordIdLabel = document.querySelector("#admin-discord-id-label");
        const discordIdHint = document.querySelector("#admin-discord-id-hint");
        if (discordTitle) discordTitle.innerHTML = '<span style="font-size: 16px;">🔔</span> Thông báo đơn hàng dịch vụ qua Discord (Đối tác)';
        if (discordDesc) discordDesc.textContent = 'Tự động gửi thông báo đến kênh Discord của bạn khi có khách hàng đặt mua dịch vụ do bạn cung cấp.';
        if (discordIdLabel) discordIdLabel.textContent = 'ID Discord của bạn (để bot tag ping khi có đơn mới)';
        if (discordAdminIdInput) discordAdminIdInput.placeholder = 'Nhập ID Discord của bạn (VD: 604729446649298963)';
        if (discordIdHint) {
          discordIdHint.innerHTML = 'Nhập ID Discord của bạn để bot tag <code>&lt;@ID&gt;</code> khi có đơn mới (hoặc để trống nếu không cần tag).';
        }
      }

      if (ordersBtn) ordersBtn.textContent = "📦 Đơn hàng của tôi";
      if (pricesBtn) pricesBtn.textContent = "🏷️ Dịch vụ của tôi";
      if (depositsBtn) depositsBtn.hidden = true;
      if (campaignsBtn) {
        campaignsBtn.hidden = false;
        campaignsBtn.textContent = "Đợt giảm giá của tôi";
      }
      if (couponsBtn) {
        couponsBtn.hidden = false;
        couponsBtn.textContent = "🎟️ Mã giảm giá của tôi";
      }
      if (guideBtn) { guideBtn.hidden = false; guideBtn.textContent = "📘 Hướng dẫn của tôi"; }
      if (contactsBtn) contactsBtn.hidden = true;
      if (partnersBtn) partnersBtn.hidden = true;
    } else {
      if (brandTitle) brandTitle.innerHTML = 'VietNam Legacy <span>ADMIN</span>';
      if (brandSubtitle) brandSubtitle.textContent = 'Đơn hàng · Giá bán · Ưu đãi';
      if (userBadge) {
        userBadge.innerHTML = `<span class="user-badge-role admin">👑 Quản trị viên</span>`;
      }
      if (annCard) annCard.hidden = false;
      if (discordCard) {
        discordCard.hidden = false;
        const discordTitle = document.querySelector("#admin-discord-title");
        const discordDesc = document.querySelector("#admin-discord-desc");
        const discordIdLabel = document.querySelector("#admin-discord-id-label");
        const discordIdHint = document.querySelector("#admin-discord-id-hint");
        if (discordTitle) discordTitle.innerHTML = '<span style="font-size: 16px;">🔔</span> Thông báo đơn hàng qua Discord Admin';
        if (discordDesc) discordDesc.textContent = 'Tự động gửi thông báo kèm ping Discord Admin khi có khách hàng đặt hàng mới trên website.';
        if (discordIdLabel) discordIdLabel.textContent = 'ID Discord Admin (để ping khi có đơn)';
        if (discordAdminIdInput) discordAdminIdInput.placeholder = '604729446649298963';
        if (discordIdHint) {
          discordIdHint.innerHTML = 'Mặc định: <code style="color: #c084fc;">604729446649298963</code> (bot sẽ gắn thẻ <code>&lt;@604729446649298963&gt;</code>).';
        }
      }

      if (ordersBtn) ordersBtn.textContent = "Đơn hàng & thông báo";
      if (pricesBtn) pricesBtn.textContent = "Giá sản phẩm";
      if (depositsBtn) depositsBtn.hidden = false;
      if (campaignsBtn) campaignsBtn.hidden = false;
      if (couponsBtn) couponsBtn.hidden = false;
      if (guideBtn) { guideBtn.hidden = false; guideBtn.textContent = "📘 Hướng dẫn & Tin tức"; }
      if (contactsBtn) contactsBtn.hidden = false;
      if (partnersBtn) partnersBtn.hidden = false;
    }

    loadOrders();
    if (role === "admin") {
      loadAnnouncement();
    // loadDiscordSettings called below
    }
    loadDiscordSettings();
    if (window.initAdminPricing) {
      window.initAdminPricing({ api, notify, user: { role, email, name } });
    }
  }

  async function checkAuthAndInit() {
    if (!adminKey) {
      showLogin();
      return;
    }
    try {
      const me = await api("/api/admin/me");
      sessionStorage.setItem("vnl_admin_role", me.user?.role || "admin");
      sessionStorage.setItem("vnl_admin_email", me.user?.email || "");
      sessionStorage.setItem("vnl_admin_name", me.user?.name || "");
      showDashboard(me.user);
    } catch {
      adminKey = "";
      sessionStorage.removeItem("vnl_admin_key");
      sessionStorage.removeItem("vnl_admin_role");
      sessionStorage.removeItem("vnl_admin_email");
      sessionStorage.removeItem("vnl_admin_name");
      showLogin();
    }
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.hidden = true;

    try {
      let payload = {};
      if (loginMode === "partner") {
        const email = partnerEmailInput.value.trim();
        const password = partnerPasswordInput.value.trim();
        if (!email || !password) {
          throw new Error("Vui lòng nhập đầy đủ Gmail và mật khẩu đối tác.");
        }
        payload = { email, password };
      } else {
        const password = passwordInput.value.trim();
        if (!password) {
          throw new Error("Vui lòng nhập mật khẩu quản trị viên.");
        }
        payload = { password };
      }

      const res = await api("/api/admin/auth", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      adminKey = res.adminKey;
      sessionStorage.setItem("vnl_admin_key", adminKey);
      sessionStorage.setItem("vnl_admin_role", res.role || "admin");
      sessionStorage.setItem("vnl_admin_email", res.email || "");
      sessionStorage.setItem("vnl_admin_name", res.name || "");
      showDashboard(res);
    } catch (err) {
      loginError.textContent = err.message;
      loginError.hidden = false;
    }
  });

  logoutBtn.addEventListener("click", () => {
    adminKey = "";
    sessionStorage.removeItem("vnl_admin_key");
    sessionStorage.removeItem("vnl_admin_role");
    sessionStorage.removeItem("vnl_admin_email");
    sessionStorage.removeItem("vnl_admin_name");
    showLogin();
  });

  refreshBtn.addEventListener("click", () => {
    loadOrders();
    notify("Đã làm mới danh sách đơn hàng.");
  });

  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderOrders();
  });

  tabsContainer.addEventListener("click", (e) => {
    const tab = e.target.closest(".admin-tab");
    if (!tab) return;
    tabsContainer
      .querySelectorAll(".admin-tab")
      .forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentFilter = tab.dataset.filter;
    renderOrders();
  });

  async function loadOrders() {
    ordersContainer.innerHTML =
      '<p class="admin-loading-text">Đang tải danh sách đơn hàng...</p>';
    try {
      const [res] = await Promise.all([api("/api/admin/orders?limit=100"), loadStats()]);
      allOrders = res.orders || [];
      for (const o of allOrders) {
        for (const m of (o.messages || [])) {
          if (m.createdAt > lastAdminChatSync) lastAdminChatSync = m.createdAt;
        }
      }
      renderOrders();
    } catch (err) {
      ordersContainer.innerHTML = `<p class="admin-error-msg">${escapeHtml(err.message)}</p>`;
    }
  }

  function updateStats(stats) {
    document.querySelector("#stat-total-orders").textContent = stats.totalOrders;
    document.querySelector("#stat-processing-orders").textContent = stats.needsAction;
    document.querySelector("#stat-completed-orders").textContent = stats.completedOrders;
    document.querySelector("#stat-total-revenue").innerHTML = money(stats.revenue);
    document.querySelector("#stat-processing-orders").title =
      stats.processingOrders + " đơn đang xử lý, " + stats.pendingDeposits + " yêu cầu nạp chờ/đối soát";
  }

  async function loadStats() {
    if (!adminKey || adminApp.hidden) return;
    const request = ++statsRequest;
    const feedback = document.querySelector("#admin-stats-feedback");
    try {
      const result = await api("/api/admin/stats");
      if (request !== statsRequest || !adminKey || adminApp.hidden) return;
      updateStats(result.stats);
      feedback.textContent = "Cập nhật lúc " + new Date(result.stats.updatedAt).toLocaleTimeString("vi-VN") + " · Tự làm mới mỗi 15 giây";
    } catch (error) {
      if (request !== statsRequest || adminApp.hidden) return;
      // Giữ số liệu gần nhất khi mất mạng, tránh hiển thị số 0 gây hiểu nhầm.
      feedback.textContent = "Chưa cập nhật được thống kê: " + error.message;
    }
  }

  setInterval(() => {
    if (!document.hidden) void loadStats();
  }, 15000);
  window.addEventListener("focus", () => { void loadStats(); });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void loadStats();
  });

  function filterOrders() {
    return allOrders.filter((order) => {
      // Status filter
      if (currentFilter === "processing") {
        if (order.status !== "processing" && order.status !== "cancelled" && order.status !== "pending") return false;
      } else if (currentFilter === "completed") {
        if (order.status !== "completed" && order.status !== "cancelled") return false;
      } else if (currentFilter === "cancelled") {
        if (order.status !== "cancelled") return false;
      } else if (currentFilter === "messages") {
        if (!Array.isArray(order.messages) || order.messages.length === 0) return false;
      }

      // Keyword search
      if (searchQuery) {
        const matchId = order.id.toLowerCase().includes(searchQuery);
        const matchName = (order.customerName || "").toLowerCase().includes(searchQuery);
        const matchEmail = (order.customerEmail || "").toLowerCase().includes(searchQuery);
        const matchDiscord = (order.discordAccount || "").toLowerCase().includes(searchQuery);
        const matchToken = (order.discordToken || "").toLowerCase().includes(searchQuery);
        if (!matchId && !matchName && !matchEmail && !matchDiscord && !matchToken) return false;
      }

      return true;
    });
  }

  function renderOrders() {
    const list = filterOrders();
    if (list.length === 0) {
      ordersContainer.innerHTML =
        '<p class="admin-empty-text">Không có đơn hàng nào phù hợp với bộ lọc.</p>';
      return;
    }

    const statusLabels = {
      pending: "Chờ duyệt",
      processing: "Đang nạp gói",
      completed: "Hoàn tất",
      cancelled: "Đã hủy",
    };

    ordersContainer.innerHTML = list
      .map((order) => {
        const dateStr = new Date(order.createdAt).toLocaleString("vi-VN");
        const statusText = statusLabels[order.status] || order.status;

        const itemsHtml = (order.items || [])
          .map((item) => {
            const delType = (item.deliveryType || "gift").toLowerCase();
            let badgeClass = "item-badge-gift";
            let badgeText = "LINK CLAIM (GIFT)";
            if (delType === "log") {
              badgeClass = "item-badge-log";
              badgeText = "NẠP ACC (LOG)";
            } else if (delType === "key") {
              badgeClass = "item-badge-key";
              badgeText = "MÃ KEY (CODE)";
            } else if (delType === "account") {
              badgeClass = "item-badge-acc";
              badgeText = "TÀI KHOẢN (ACC)";
            } else if (delType === "invite") {
              badgeClass = "item-badge-invite";
              badgeText = "MỜI EMAIL (INVITE)";
            } else if (delType === "bot") {
              badgeClass = "item-badge-bot";
              badgeText = "BOT NẠP";
            } else if (delType === "file") {
              badgeClass = "item-badge-file";
              badgeText = "FILE TẢI VỀ";
            } else if (delType === "service") {
              badgeClass = "item-badge-service";
              badgeText = "TƯ VẤN (SERVICE)";
            } else if (delType !== "gift") {
              badgeClass = "item-badge-custom";
              badgeText = escapeHtml(item.deliveryType.toUpperCase());
            }
            return `
              <li>
                <div>
                  <strong>${escapeHtml(item.productName || item.name)}</strong> · ${escapeHtml(item.variantName || item.variant)}
                  <span class="${badgeClass}">${badgeText}</span>
                </div>
                <span>Số lượng: ${item.quantity} · ${money(item.subtotal || item.price * item.quantity)}</span>
              </li>
            `;
          })
          .join("");

        const orderMessages = Array.isArray(order.messages) ? order.messages : [];
        const lastMsg = orderMessages.length > 0 ? orderMessages[orderMessages.length - 1] : null;
        const isLastCustomer = lastMsg && lastMsg.senderRole === "customer";
        const isDrawerOpen = openAdminChatDrawers.has(order.id);

        let snippetText = "Chưa có trao đổi nào. Bấm để nhắn với khách...";
        let lastMsgTime = "";
        if (lastMsg) {
          const prefix = isLastCustomer ? `${escapeHtml(order.customerName || "Khách")}: ` : "Shop: ";
          snippetText = `${prefix}${escapeHtml(lastMsg.message || "")}`;
          lastMsgTime = formatRelativeTime(lastMsg.createdAt);
        }

        const messagesHtml = orderMessages.length > 0
          ? orderMessages.map(renderAdminChatBubble).join("")
          : '<p class="admin-chat-empty">Chưa có trao đổi nào trên đơn hàng này. Gửi phản hồi bên dưới để nhắn với khách hàng.</p>';

        const adminChatBox = `
          <!-- Khối Messenger / Zalo thu nhỏ riêng biệt -->
          <div class="chat-messenger-card ${isDrawerOpen ? "is-active" : ""}" data-admin-chat-toggle="${escapeHtml(order.id)}">
            <div class="chat-messenger-avatar-wrap">
              <div class="chat-messenger-avatar" style="background: ${getAvatarGradient(order.customerName)};">
                ${escapeHtml(getInitials(order.customerName))}
              </div>
              ${isLastCustomer ? '<span class="chat-messenger-unread-dot" title="Có tin nhắn mới từ khách"></span>' : ""}
            </div>
            <div class="chat-messenger-info">
              <div class="chat-messenger-top-row">
                <span class="chat-messenger-name">${escapeHtml(order.customerName || "Khách hàng")}</span>
                <span class="chat-messenger-time">${escapeHtml(lastMsgTime)}</span>
              </div>
              <div class="chat-messenger-bottom-row">
                <span class="chat-messenger-snippet ${isLastCustomer ? "is-unread" : ""}">
                  ${snippetText}
                </span>
                <span class="chat-messenger-badge ${orderMessages.length > 0 ? "has-count" : ""}">
                  ${orderMessages.length > 0 ? `${orderMessages.length} tin` : "Chat"}
                </span>
              </div>
            </div>
            <button type="button" class="chat-messenger-action-btn" aria-label="Mở hoặc thu gọn hội thoại">
              <span class="toggle-label">${isDrawerOpen ? "Thu gọn ▲" : "Phản hồi 💬"}</span>
            </button>
          </div>

          <!-- Khung chat chi tiết mở rộng -->
          <div class="chat-messenger-drawer" id="admin-chat-drawer-${escapeHtml(order.id)}" style="${isDrawerOpen ? "display:block;" : "display:none;"}">
            <div class="chat-drawer-header">
              <span class="chat-drawer-title">💬 Trao đổi với khách (${escapeHtml(order.customerName || "Khách hàng")} · Đơn ${escapeHtml(order.id)})</span>
              <button type="button" class="chat-drawer-close-btn" data-admin-chat-close="${escapeHtml(order.id)}">✕ Thu gọn</button>
            </div>
            <div class="admin-chat-feed" id="admin-chat-feed-${escapeHtml(order.id)}">
              ${messagesHtml}
            </div>
            <div class="admin-chat-quick-replies">
              <span class="quick-reply-label">⚡ Mẫu phản hồi nhanh:</span>
              <button type="button" class="admin-quick-chip" data-quick-admin="Shop đang tiến hành nạp gói cho bạn nhé, vui lòng chờ khoảng 5-10 phút!">⏳ Đang nạp gói</button>
              <button type="button" class="admin-quick-chip" data-quick-admin="Đơn hàng của bạn đã hoàn tất! Bạn kiểm tra lại giúp shop nhé.">✅ Đã hoàn tất</button>
              <button type="button" class="admin-quick-chip" data-quick-admin="Mã xác thực 2FA hoặc mật khẩu chưa chính xác, bạn kiểm tra và gửi lại giúp shop nhé!">⚠️ Cần mã 2FA mới</button>
              <button type="button" class="admin-quick-chip" data-quick-admin="Bạn gửi giúp shop link server Discord cần Boost để shop vào thực hiện nhé!">🚀 Cần link server</button>
            </div>
            <form class="admin-chat-form" data-admin-chat-order="${escapeHtml(order.id)}">
              <div class="admin-chat-input-row">
                <input
                  type="text"
                  class="admin-chat-input"
                  placeholder="Nhập nội dung phản hồi cho khách..."
                  maxlength="1000"
                  required
                />
                <button type="submit" class="button primary btn-small admin-chat-send-btn">
                  Gửi khách ✉️
                </button>
              </div>
            </form>
          </div>
        `;

        // LOG CREDENTIALS BOX (ONLY ADMIN CAN SEE)
        let logCredentialsBox = "";
        if (order.hasLogItems) {
          const acc = escapeHtml(order.discordAccount || "Chưa có");
          const pass = escapeHtml(order.discordPassword || "Chưa có");
          const codes = escapeHtml(order.backupCodes || "Chưa có");
          const fullInfo = `Tài khoản: ${order.discordAccount}\nMật khẩu: ${order.discordPassword}\nMã dự phòng: ${order.backupCodes}`;

          logCredentialsBox = `
            <div class="admin-log-credentials-box">
              <div class="admin-log-credentials-header">
                <strong>🔐 THÔNG TIN TÀI KHOẢN DISCORD ĐỂ NẠP (BẢO MẬT ADMIN)</strong>
                <button class="admin-copy-btn" data-copy-text="${escapeHtml(fullInfo)}">📋 Sao chép tất cả</button>
              </div>
              <div class="credential-row">
                <span class="credential-label">Tài khoản (Email/SĐT):</span>
                <span class="credential-value">${acc}</span>
                <div class="credential-actions">
                  <button class="admin-copy-btn" data-copy-text="${acc}">Sao chép</button>
                </div>
              </div>
              <div class="credential-row">
                <span class="credential-label">Mật khẩu Discord:</span>
                <span class="credential-value" data-masked="true" data-real-password="${pass}">••••••••••••</span>
                <div class="credential-actions">
                  <button class="admin-toggle-btn" data-action="toggle-pass">Hiện</button>
                  <button class="admin-copy-btn" data-copy-text="${pass}">Sao chép</button>
                </div>
              </div>
              <div class="credential-row">
                <span class="credential-label">3 Mã dự phòng (2FA):</span>
                <span class="credential-value">${codes}</span>
                <div class="credential-actions">
                  <button class="admin-copy-btn" data-copy-text="${codes}">Sao chép</button>
                </div>
              </div>
            </div>
          `;
        }

        // DISCORD TOKEN BOX
        let discordTokenBox = "";
        if (order.discordToken) {
          const token = escapeHtml(order.discordToken);
          discordTokenBox = `
            <div class="admin-log-credentials-box" style="margin-top:12px; background:rgba(234, 179, 8, 0.08); border:1px solid rgba(234, 179, 8, 0.35);">
              <div class="admin-log-credentials-header">
                <strong style="color:#ffd15c;">🔑 TOKEN TÀI KHOẢN DISCORD CỦA KHÁCH</strong>
                <button class="admin-copy-btn" data-copy-text="${token}">📋 Sao chép Token</button>
              </div>
              <div class="credential-row">
                <span class="credential-label" style="min-width:130px;">Token Discord:</span>
                <span class="credential-value" data-masked="true" data-real-password="${token}" style="font-family:monospace; word-break:break-all;">••••••••••••••••••••••••</span>
                <div class="credential-actions">
                  <button class="admin-toggle-btn" data-action="toggle-pass">Hiện</button>
                  <button class="admin-copy-btn" data-copy-text="${token}">Sao chép</button>
                </div>
              </div>
            </div>
          `;
        }

        // BOOST SERVER INVITE BOX
        let serverInviteBox = "";
        if (order.serverInvite) {
          const invite = escapeHtml(order.serverInvite);
          serverInviteBox = `
            <div class="admin-server-invite-box" style="margin-top:12px; padding:12px; background:rgba(147, 51, 234, 0.12); border:1px solid rgba(147, 51, 234, 0.35); border-radius:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <strong style="color:#c084fc; font-size:13px;">🚀 LINK SERVER DISCORD CẦN BOOST (VÔ THỜI HẠN)</strong>
                <button class="admin-copy-btn" data-copy-text="${invite}">📋 Sao chép link</button>
              </div>
              <div style="display:flex; align-items:center; gap:10px; font-size:13px; word-break:break-all;">
                <a href="${invite}" target="_blank" rel="noopener noreferrer" style="color:#c084fc; text-decoration:underline; font-weight:600;">
                  ${invite}
                </a>
                <a href="${invite}" target="_blank" rel="noopener noreferrer" style="padding:4px 8px; background:var(--accent, #9333ea); color:#fff; border-radius:4px; font-size:11px; text-decoration:none; white-space:nowrap;">
                  Tham gia server ↗
                </a>
              </div>
            </div>
          `;
        }

        // DECOR IMAGE BOX
        let decorImageBox = "";
        if (order.decorImage) {
          const decorImg = escapeHtml(order.decorImage);
          decorImageBox = `
            <div class="admin-decor-box" style="margin-top:12px; padding:12px; background:rgba(59, 130, 246, 0.1); border:1px solid rgba(59, 130, 246, 0.35); border-radius:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
                <strong style="color:#60a5fa; font-size:13px;">🎨 ẢNH MẪU DECOR KHÁCH YÊU CẦU MUA (AVATAR / PROFILE EFFECT)</strong>
                <a href="${decorImg}" target="_blank" rel="noopener noreferrer" style="font-size:11px; color:#93c5fd; text-decoration:underline;">
                  Mở ảnh gốc trong tab mới ↗
                </a>
              </div>
              <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap;">
                <a href="${decorImg}" target="_blank" rel="noopener noreferrer" title="Bấm để phóng to">
                  <img src="${decorImg}" alt="Mẫu Decor" style="max-width:140px; max-height:140px; object-fit:contain; border-radius:6px; border:1px solid rgba(255,255,255,0.15); background:#111; cursor:zoom-in; box-shadow:0 2px 8px rgba(0,0,0,0.4);" />
                </a>
                <div style="font-size:12px; color:var(--muted); line-height:1.5;">
                  <p style="margin:0 0 4px 0;">Khách hàng đã gửi ảnh mẫu trên. Vui lòng kiểm tra kỹ mẫu Decor để gửi đúng link Gift hoặc nạp đúng mẫu vào tài khoản.</p>
                  <span style="font-size:11px; color:#94a3b8;">(Bấm vào ảnh để xem kích thước đầy đủ)</span>
                </div>
              </div>
            </div>
          `;
        }

        // GIFT / CLAIM / DELIVERY CONTENT BOX
        let giftClaimBox = "";
        const hasGift = (order.items || []).some((i) => i.deliveryType !== "log");
        if (hasGift) {
          giftClaimBox = `
            <div class="admin-gift-claim-box">
              <div class="admin-gift-claim-header">🎁 LINK CLAIM QUÀ TẶNG / NỘI DUNG GIAO HÀNG (KEY, LINK, ACC...)</div>
              <div class="admin-claim-input-group">
                <input
                  class="admin-claim-input"
                  data-order-claim="${order.id}"
                  placeholder="Dán link claim quà, key kích hoạt, link tải hoặc thông tin bàn giao..."
                  value="${escapeHtml(order.claimLink || "")}"
                />
                <button class="admin-claim-save-btn" data-action="save-claim" data-order-id="${order.id}">
                  Cập nhật & Hoàn tất
                </button>
              </div>
            </div>
          `;
        }

        return `
          <article class="admin-order-card status-${order.status}" data-order-id="${order.id}">
            <div class="admin-order-header">
              <div class="admin-order-title-group">
                <strong>${escapeHtml(order.id)}</strong>
                <span class="order-date">${dateStr}</span>
                <div class="admin-customer-info">
                  Khách hàng: <span>${escapeHtml(order.customerName)}</span> · Email: <span>${escapeHtml(order.customerEmail)}</span>
                  ${order.customerNote ? `<br>Ghi chú khách: <em>${escapeHtml(order.customerNote)}</em>` : ""}
                </div>
              </div>
              <span class="order-status-badge status-${order.status}">${statusText}</span>
            </div>

            <div class="admin-order-items">
              <ul>${itemsHtml}</ul>
            </div>

            ${logCredentialsBox}
            ${discordTokenBox}
            ${serverInviteBox}
            ${decorImageBox}
            ${giftClaimBox}
            ${adminChatBox}

            <div class="admin-order-footer">
              <div class="admin-order-total">
                Thanh toán qua Ví: <strong>${money(order.total)}</strong>
                ${order.pricing && (order.pricing.saleDiscount || order.pricing.couponDiscount) ? `<small class="order-discount-note">Giá gốc: ${money(order.pricing.subtotal)} · Ưu đãi: −${money(order.pricing.saleDiscount + order.pricing.couponDiscount)}${order.pricing.coupon ? ' · Mã ' + escapeHtml(order.pricing.coupon.code) : ''}</small>` : ''}
              </div>
              <div class="admin-action-buttons">
                ${
                  order.status !== "completed" && order.status !== "cancelled"
                    ? `<button class="admin-status-btn btn-complete" data-action="set-status" data-status="completed" data-order-id="${order.id}">✅ Hoàn tất</button>`
                    : ""
                }
                ${
                  order.status !== "processing" && order.status !== "cancelled"
                    ? `<button class="admin-status-btn" data-action="set-status" data-status="processing" data-order-id="${order.id}">🔄 Đang nạp</button>`
                    : ""
                }
                ${
                  order.status !== "cancelled"
                    ? `<button class="admin-status-btn btn-cancel" data-action="set-status" data-status="cancelled" data-order-id="${order.id}">❌ Hủy đơn (Hoàn tiền)</button>`
                    : ""
                }
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  // Helper function to update the Messenger card on new messages or admin sends
  function updateAdminChatCard(orderId, lastMsg, totalCount) {
    const card = document.querySelector(`[data-admin-chat-toggle="${orderId}"]`);
    if (!card) return;
    const isCustomer = lastMsg && lastMsg.senderRole === "customer";
    const snippetEl = card.querySelector(".chat-messenger-snippet");
    if (snippetEl) {
      if (lastMsg) {
        const order = allOrders.find((o) => o.id === orderId);
        const prefix = isCustomer ? `${order?.customerName || "Khách"}: ` : "Shop: ";
        snippetEl.textContent = `${prefix}${lastMsg.message || ""}`;
      }
      snippetEl.classList.toggle("is-unread", Boolean(isCustomer));
    }
    const timeEl = card.querySelector(".chat-messenger-time");
    if (timeEl && lastMsg) {
      timeEl.textContent = formatRelativeTime(lastMsg.createdAt);
    }
    const badgeEl = card.querySelector(".chat-messenger-badge");
    if (badgeEl) {
      badgeEl.textContent = totalCount > 0 ? `${totalCount} tin` : "Chat";
      badgeEl.classList.toggle("has-count", totalCount > 0);
    }
    const avatarWrap = card.querySelector(".chat-messenger-avatar-wrap");
    if (avatarWrap) {
      let dot = avatarWrap.querySelector(".chat-messenger-unread-dot");
      if (isCustomer) {
        if (!dot) {
          avatarWrap.insertAdjacentHTML("beforeend", '<span class="chat-messenger-unread-dot" title="Có tin nhắn mới từ khách"></span>');
        }
      } else {
        if (dot) dot.remove();
      }
    }
  }

  // Global click handler for order actions
  document.addEventListener("click", async (e) => {
    // Quick reply chips click
    const quickChip = e.target.closest(".admin-quick-chip");
    if (quickChip) {
      const chatContainer = quickChip.closest(".chat-messenger-drawer") || quickChip.closest(".admin-order-chat");
      if (chatContainer) {
        const input = chatContainer.querySelector(".admin-chat-input");
        if (input) {
          input.value = quickChip.getAttribute("data-quick-admin") || "";
          input.focus();
        }
      }
      return;
    }

    // Toggle Admin Chat Drawer (Messenger / Zalo style)
    const chatCloseBtn = e.target.closest("[data-admin-chat-close]");
    if (chatCloseBtn) {
      const orderId = chatCloseBtn.getAttribute("data-admin-chat-close");
      const drawer = document.getElementById(`admin-chat-drawer-${orderId}`);
      const card = document.querySelector(`[data-admin-chat-toggle="${orderId}"]`);
      if (drawer) drawer.style.display = "none";
      if (card) {
        card.classList.remove("is-active");
        const label = card.querySelector(".toggle-label");
        if (label) label.textContent = "Phản hồi 💬";
      }
      openAdminChatDrawers.delete(orderId);
      return;
    }

    const chatToggleCard = e.target.closest("[data-admin-chat-toggle]");
    if (chatToggleCard) {
      const orderId = chatToggleCard.getAttribute("data-admin-chat-toggle");
      const drawer = document.getElementById(`admin-chat-drawer-${orderId}`);
      if (drawer) {
        const isOpen = openAdminChatDrawers.has(orderId);
        if (isOpen) {
          openAdminChatDrawers.delete(orderId);
          drawer.style.display = "none";
          chatToggleCard.classList.remove("is-active");
          const label = chatToggleCard.querySelector(".toggle-label");
          if (label) label.textContent = "Phản hồi 💬";
        } else {
          openAdminChatDrawers.add(orderId);
          drawer.style.display = "block";
          chatToggleCard.classList.add("is-active");
          const label = chatToggleCard.querySelector(".toggle-label");
          if (label) label.textContent = "Thu gọn ▲";
          const feed = document.getElementById(`admin-chat-feed-${orderId}`);
          if (feed) feed.scrollTop = feed.scrollHeight;
          const input = drawer.querySelector(".admin-chat-input");
          if (input) input.focus();
          // Remove unread dot when admin opens drawer
          const dot = chatToggleCard.querySelector(".chat-messenger-unread-dot");
          if (dot) dot.remove();
        }
      }
      return;
    }

    // 1. Copy text buttons
    const copyBtn = e.target.closest("[data-copy-text]");
    if (copyBtn) {
      const text = copyBtn.getAttribute("data-copy-text");
      try {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = "Đã chép!";
        setTimeout(() => (copyBtn.textContent = "Sao chép"), 1800);
      } catch {
        notify("Không thể sao chép tự động.");
      }
      return;
    }

    // 2. Toggle password visibility
    const toggleBtn = e.target.closest('[data-action="toggle-pass"]');
    if (toggleBtn) {
      const row = toggleBtn.closest(".credential-row");
      const valEl = row.querySelector(".credential-value");
      const realPass = valEl.dataset.realPassword;
      const isMasked = valEl.dataset.masked === "true";
      if (isMasked) {
        valEl.textContent = realPass;
        valEl.dataset.masked = "false";
        toggleBtn.textContent = "Ẩn";
      } else {
        valEl.textContent = "••••••••••••";
        valEl.dataset.masked = "true";
        toggleBtn.textContent = "Hiện";
      }
      return;
    }

    // 3. Save Claim Link & Mark Completed
    const saveClaimBtn = e.target.closest('[data-action="save-claim"]');
    if (saveClaimBtn) {
      const orderId = saveClaimBtn.dataset.orderId;
      const input = document.querySelector(`[data-order-claim="${orderId}"]`);
      const claimLink = input ? input.value.trim() : "";
      if (!claimLink) {
        alert("Vui lòng nhập Link Claim quà tặng Discord trước khi lưu.");
        return;
      }
      saveClaimBtn.disabled = true;
      saveClaimBtn.textContent = "Đang lưu...";
      try {
        const res = await api(`/api/admin/orders/${orderId}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: "completed",
            claimLink,
          }),
        });
        const idx = allOrders.findIndex((o) => o.id === orderId);
        if (idx !== -1) allOrders[idx] = res.order;
        renderOrders();
        notify(`Đã lưu Link Claim và hoàn tất đơn ${orderId}!`);
      } catch (err) {
        alert(err.message);
      }
      return;
    }

    // 4. Change Status button
    const statusBtn = e.target.closest('[data-action="set-status"]');
    if (statusBtn) {
      const orderId = statusBtn.dataset.orderId;
      const nextStatus = statusBtn.dataset.status;
      const confirmMsg =
        nextStatus === "cancelled"
          ? `Bạn có chắc muốn HỦY đơn ${orderId}? Số tiền sẽ được hoàn trả lại ví của khách hàng.`
          : `Chuyển trạng thái đơn ${orderId} sang "${nextStatus}"?`;

      if (!confirm(confirmMsg)) return;

      statusBtn.disabled = true;
      try {
        const res = await api(`/api/admin/orders/${orderId}`, {
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus }),
        });
        const idx = allOrders.findIndex((o) => o.id === orderId);
        if (idx !== -1) allOrders[idx] = res.order;
        renderOrders();
        notify(`Đã cập nhật trạng thái đơn ${orderId} thành "${nextStatus}".`);
      } catch (err) {
        alert(err.message);
      }
      return;
    }
  });

  // Announcement Banner Management
  const announcementTextarea = document.querySelector("#admin-announcement-text");
  const announcementActive = document.querySelector("#admin-announcement-active");
  const announcementStatusText = document.querySelector("#admin-announcement-status-text");
  const announcementCounter = document.querySelector("#admin-announcement-counter");
  const saveAnnouncementBtn = document.querySelector("#admin-save-announcement-btn");

  const announcementFeedback = document.querySelector("#admin-announcement-feedback");
  let announcementChannel;
  try {
    if (typeof BroadcastChannel === "function") announcementChannel = new BroadcastChannel("vnl-announcements");
  } catch { /* Vẫn đồng bộ qua localStorage hoặc lúc quay lại cửa hàng. */ }

  function announcementStatus(message, error = false) {
    if (!announcementFeedback) return;
    announcementFeedback.textContent = message;
    announcementFeedback.classList.toggle("is-error", error);
  }

  function updateAnnouncementCounter() {
    if (!announcementTextarea || !announcementCounter) return;
    const len = announcementTextarea.value.length;
    announcementCounter.textContent = `${len} / 400 ký tự`;
  }

  function updateAnnouncementStatusLabel() {
    if (!announcementActive || !announcementStatusText) return;
    const isActive = announcementActive.checked;
    announcementStatusText.textContent = isActive ? "Bật hiển thị" : "Tắt (Ẩn)";
    announcementStatusText.classList.toggle("status-active", isActive);
    announcementStatusText.classList.toggle("status-inactive", !isActive);
  }

  if (announcementTextarea) {
    announcementTextarea.addEventListener("input", updateAnnouncementCounter);
  }
  if (announcementActive) {
    announcementActive.addEventListener("change", updateAnnouncementStatusLabel);
  }

  async function loadAnnouncement() {
    if (!announcementTextarea) return;
    try {
      const data = await api("/api/admin/announcement");
      if (data.announcement) {
        announcementTextarea.value = data.announcement.content || "";
        if (announcementActive) {
          announcementActive.checked = Boolean(data.announcement.is_active);
        }
        updateAnnouncementCounter();
        updateAnnouncementStatusLabel();
      }
    } catch (err) {
      announcementStatus("Chưa tải được thông báo: " + err.message, true);
    }
  }

  if (saveAnnouncementBtn) {
    saveAnnouncementBtn.addEventListener("click", async () => {
      const content = announcementTextarea ? announcementTextarea.value.trim() : "";
      const enabled = announcementActive ? announcementActive.checked : true;
      if (enabled && !content) {
        announcementStatus("Vui lòng nhập nội dung trước khi bật thông báo.", true);
        notify("Vui lòng nhập nội dung thông báo.");
        announcementTextarea?.focus();
        return;
      }
      saveAnnouncementBtn.disabled = true;
      saveAnnouncementBtn.textContent = "Đang lưu...";
      announcementStatus("Đang lưu thông báo...");
      try {
        const data = await api("/api/admin/announcement", {
          method: "POST",
          body: JSON.stringify({
            content,
            is_active: enabled,
          }),
        });
        announcementTextarea.value = data.announcement.content;
        announcementActive.checked = Boolean(data.announcement.is_active);
        updateAnnouncementCounter();
        updateAnnouncementStatusLabel();
        const savedAt = new Date(data.announcement.updated_at).toLocaleTimeString("vi-VN");
        announcementStatus(data.announcement.is_active
          ? "Đã lưu lúc " + savedAt + ". Thông báo đang bật; cửa hàng đã nhận cập nhật."
          : "Đã lưu lúc " + savedAt + ". Thông báo đang tắt và được ẩn ngoài cửa hàng.");
        try {
          if (announcementChannel) announcementChannel.postMessage({ updated: true });
          else localStorage.setItem("vnl-announcement-updated", String(Date.now()));
        } catch { /* Cửa hàng vẫn lấy lại dữ liệu khi được mở hoặc trở lại. */ }
        notify(data.announcement.is_active ? "Đã lưu và đăng thông báo." : "Đã lưu và ẩn thông báo.");
      } catch (err) {
        announcementStatus("Chưa lưu được: " + err.message, true);
        notify("Lỗi khi lưu thông báo: " + err.message);
      } finally {
        saveAnnouncementBtn.disabled = false;
        saveAnnouncementBtn.textContent = "Lưu & Đăng thông báo";
      }
    });
  }

  // Discord Admin Notification Management
  const discordWebhookInput = document.querySelector("#admin-discord-webhook");
  const discordAdminIdInput = document.querySelector("#admin-discord-admin-id");
  const discordActive = document.querySelector("#admin-discord-active");
  const discordStatusText = document.querySelector("#admin-discord-status-text");
  const discordFeedback = document.querySelector("#admin-discord-feedback");
  const saveDiscordBtn = document.querySelector("#admin-save-discord-btn");
  const testDiscordBtn = document.querySelector("#admin-test-discord-btn");

  function discordStatus(message, error = false) {
    if (!discordFeedback) return;
    discordFeedback.textContent = message;
    discordFeedback.classList.toggle("is-error", error);
  }

  function updateDiscordStatusLabel() {
    if (!discordActive || !discordStatusText) return;
    const isEnabled = discordActive.checked;
    discordStatusText.textContent = isEnabled ? "Bật thông báo" : "Tắt thông báo";
    discordStatusText.classList.toggle("status-active", isEnabled);
    discordStatusText.classList.toggle("status-inactive", !isEnabled);
  }

  if (discordActive) {
    discordActive.addEventListener("change", updateDiscordStatusLabel);
  }

  async function loadDiscordSettings() {
    if (!discordWebhookInput) return;
    try {
      const isPartner = currentUser?.role === "partner";
      const endpoint = isPartner ? "/api/partner/discord" : "/api/admin/discord";
      const data = await api(endpoint);
      if (data.settings) {
        discordWebhookInput.value = data.settings.webhookUrl || "";
        if (discordAdminIdInput) {
          discordAdminIdInput.value = data.settings.discordId || data.settings.adminId || (isPartner ? "" : "604729446649298963");
        }
        if (discordActive) {
          discordActive.checked = Boolean(data.settings.enabled);
        }
        updateDiscordStatusLabel();
      }
    } catch (err) {
      discordStatus("Chưa tải được cấu hình Discord: " + err.message, true);
    }
  }

  if (saveDiscordBtn) {
    saveDiscordBtn.addEventListener("click", async () => {
      const webhookUrl = discordWebhookInput ? discordWebhookInput.value.trim() : "";
      const isPartner = currentUser?.role === "partner";
      const adminId = discordAdminIdInput ? discordAdminIdInput.value.trim() : (isPartner ? "" : "604729446649298963");
      const enabled = discordActive ? discordActive.checked : false;

      if (enabled && !webhookUrl) {
        discordStatus("Vui lòng nhập Discord Webhook URL trước khi bật thông báo.", true);
        notify("Vui lòng nhập Discord Webhook URL.");
        discordWebhookInput?.focus();
        return;
      }

      saveDiscordBtn.disabled = true;
      saveDiscordBtn.textContent = "Đang lưu...";
      discordStatus("Đang lưu cấu hình...");

      try {
        const endpoint = isPartner ? "/api/partner/discord" : "/api/admin/discord";
        const data = await api(endpoint, {
          method: "PUT",
          body: JSON.stringify({
            webhookUrl,
            adminId: adminId || "604729446649298963",
            enabled,
          }),
        });

        if (discordWebhookInput) discordWebhookInput.value = data.settings.webhookUrl || "";
        if (discordAdminIdInput) discordAdminIdInput.value = data.settings.discordId || data.settings.adminId || (isPartner ? "" : "604729446649298963");
        if (discordActive) discordActive.checked = Boolean(data.settings.enabled);
        updateDiscordStatusLabel();

        const savedAt = new Date().toLocaleTimeString("vi-VN");
        discordStatus(
          data.settings.enabled
            ? `Đã lưu lúc ${savedAt}. Đang bật thông báo đơn hàng qua Discord (${isPartner ? "Đối tác" : "Admin"}${data.settings.adminId || data.settings.discordId ? `: ${data.settings.adminId || data.settings.discordId}` : ""}).`
            : `Đã lưu lúc ${savedAt}. Thông báo qua Discord đang tắt.`,
        );
        notify("Đã lưu cấu hình thông báo Discord.");
      } catch (err) {
        discordStatus("Chưa lưu được: " + err.message, true);
        notify("Lỗi khi lưu cấu hình Discord: " + err.message);
      } finally {
        saveDiscordBtn.disabled = false;
        saveDiscordBtn.textContent = "Lưu cấu hình Discord";
      }
    });
  }

  if (testDiscordBtn) {
    testDiscordBtn.addEventListener("click", async () => {
      const webhookUrl = discordWebhookInput ? discordWebhookInput.value.trim() : "";
      const isPartner = currentUser?.role === "partner";
      const adminId = discordAdminIdInput ? discordAdminIdInput.value.trim() : (isPartner ? "" : "604729446649298963");

      if (!webhookUrl) {
        discordStatus("Vui lòng nhập Discord Webhook URL để gửi tin thử nghiệm.", true);
        notify("Vui lòng nhập Discord Webhook URL.");
        discordWebhookInput?.focus();
        return;
      }

      testDiscordBtn.disabled = true;
      testDiscordBtn.textContent = "Đang gửi...";
      discordStatus("Đang gửi tin thử nghiệm tới Discord...");

      try {
        const endpoint = isPartner ? "/api/partner/discord/test" : "/api/admin/discord/test";
        const data = await api(endpoint, {
          method: "POST",
          body: JSON.stringify({
            webhookUrl,
            adminId: adminId,
            discordId: adminId,
          }),
        });
        discordStatus("✅ " + (data.message || "Đã gửi thông báo thử nghiệm thành công! Hãy kiểm tra Discord."));
        notify("Gửi thử nghiệm thành công! Kiểm tra Discord.");
      } catch (err) {
        discordStatus("❌ Gửi thử nghiệm thất bại: " + err.message, true);
        notify("Lỗi thử nghiệm: " + err.message);
      } finally {
        testDiscordBtn.disabled = false;
        testDiscordBtn.textContent = "Gửi tin thử nghiệm 🧪";
      }
    });
  }



  // Submit handler for admin order chat
  document.addEventListener("submit", async (e) => {
    const form = e.target.closest(".admin-chat-form");
    if (!form) return;
    e.preventDefault();
    if (form.dataset.submitting === "true") return;
    form.dataset.submitting = "true";
    const orderId = form.getAttribute("data-admin-chat-order");
    if (!orderId) {
      delete form.dataset.submitting;
      return;
    }
    const input = form.querySelector(".admin-chat-input");
    const sendBtn = form.querySelector(".admin-chat-send-btn");
    const text = (input?.value || "").trim();
    if (!text) {
      delete form.dataset.submitting;
      return;
    }

    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = "Đang gửi...";
    }

    try {
      const res = await api(`/api/admin/orders/${encodeURIComponent(orderId)}/messages`, {
        method: "POST",
        body: { message: text },
      });
      if (input) input.value = "";
      const feed = document.getElementById(`admin-chat-feed-${orderId}`);
      if (feed && res.message) {
        const m = res.message;
        lastAdminChatSync = Math.max(lastAdminChatSync, m.createdAt || Date.now());
        const emptyEl = feed.querySelector(".admin-chat-empty");
        if (emptyEl) emptyEl.remove();
        feed.insertAdjacentHTML("beforeend", renderAdminChatBubble(m));
        feed.scrollTop = feed.scrollHeight;
        const chatBox = feed.closest(".admin-order-chat");
        const countBadge = chatBox?.querySelector(".admin-chat-count");
        if (countBadge) {
          const totalBubbles = feed.querySelectorAll(".admin-chat-bubble").length;
          countBadge.textContent = `${totalBubbles} tin nhắn`;
          countBadge.classList.add("has-count");
        }
      }
      const targetOrder = allOrders.find((o) => o.id === orderId);
      if (targetOrder && res.message) {
        targetOrder.messages = targetOrder.messages || [];
        if (!targetOrder.messages.some((x) => x.id === res.message.id)) {
          targetOrder.messages.push(res.message);
        }
      }
      const totalCount = targetOrder?.messages?.length || (feed ? feed.querySelectorAll(".admin-chat-bubble").length : 1);
      updateAdminChatCard(orderId, res.message, totalCount);
      notify("Đã gửi phản hồi đến khách hàng thành công!");
    } catch (err) {
      alert(err.message || "Gửi phản hồi cho khách thất bại.");
    } finally {
      delete form.dataset.submitting;
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = "Gửi khách ✉️";
      }
    }
  });

  // Real-time Chat Sync for Admin / Partner
  let isSyncingAdminChat = false;
  async function syncAdminChatMessages() {
    if (isSyncingAdminChat || !adminKey || adminApp.hidden || document.hidden) return;
    isSyncingAdminChat = true;
    try {
      const res = await api(`/api/admin/orders-chat-sync?since=${lastAdminChatSync}`);
      if (res?.success && Array.isArray(res.messages) && res.messages.length > 0) {
        for (const m of res.messages) {
          lastAdminChatSync = Math.max(lastAdminChatSync, m.createdAt || 0);

          // Update in-memory allOrders
          const targetOrder = allOrders.find((o) => o.id === m.orderId);
          if (targetOrder) {
            targetOrder.messages = targetOrder.messages || [];
            if (!targetOrder.messages.some((x) => x.id === m.id)) {
              targetOrder.messages.push(m);
            }
          }

          // Update live DOM feed if visible
          const feed = document.getElementById(`admin-chat-feed-${m.orderId}`);
          if (feed) {
            const alreadyRendered = feed.querySelector(`[data-msg-id="${m.id}"]`);
            if (!alreadyRendered) {
              const emptyEl = feed.querySelector(".admin-chat-empty");
              if (emptyEl) emptyEl.remove();
              feed.insertAdjacentHTML("beforeend", renderAdminChatBubble(m));
              feed.scrollTop = feed.scrollHeight;
              const chatBox = feed.closest(".admin-order-chat");
              const countBadge = chatBox?.querySelector(".admin-chat-count");
              if (countBadge) {
                const totalBubbles = feed.querySelectorAll(".admin-chat-bubble").length;
                countBadge.textContent = `${totalBubbles} tin nhắn`;
                countBadge.classList.add("has-count");
              }
            }
          }

          if (m.senderRole === "customer") {
            const preview = m.message.length > 35 ? m.message.slice(0, 33) + "..." : m.message;
            notify(`💬 Khách (${m.senderName || "Khách"}) nhắn đơn ${m.orderId}: "${preview}"`);
          }

          const totalCount = targetOrder?.messages?.length || (feed ? feed.querySelectorAll(".admin-chat-bubble").length : 1);
          updateAdminChatCard(m.orderId, m, totalCount);
        }
      }
    } catch {
      // Background retry silently
    } finally {
      isSyncingAdminChat = false;
    }
  }

  setInterval(() => {
    void syncAdminChatMessages();
  }, 2500);

  window.addEventListener("focus", () => {
    void syncAdminChatMessages();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void syncAdminChatMessages();
  });

  // Init
  checkAuthAndInit();
})();

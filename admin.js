(() => {
  let adminKey = sessionStorage.getItem("vnl_admin_key") || "";
  let allOrders = [];
  let currentFilter = "all";
  let searchQuery = "";

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

  const money = (val) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(val || 0);

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

  async function api(path, options = {}) {
    const res = await fetch(path, {
      ...options,
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

    loginScreen.hidden = true;
    adminApp.hidden = false;

    const brandTitle = document.querySelector("#admin-brand-title");
    const brandSubtitle = document.querySelector("#admin-brand-subtitle");
    const annCard = document.querySelector(".admin-announcement-card");

    const ordersBtn = document.querySelector('[data-admin-view="orders"]');
    const pricesBtn = document.querySelector('[data-admin-view="prices"]');
    const depositsBtn = document.querySelector('[data-admin-view="deposits"]');
    const campaignsBtn = document.querySelector('[data-admin-view="campaigns"]');
    const couponsBtn = document.querySelector('[data-admin-view="coupons"]');
    const guideBtn = document.querySelector('[data-admin-view="guide"]');
    const partnersBtn = document.querySelector('[data-admin-view="partners"]');

    if (role === "partner") {
      if (brandTitle) brandTitle.innerHTML = 'VietNam Legacy <span>ĐỐI TÁC</span>';
      if (brandSubtitle) brandSubtitle.textContent = 'Quản lý đơn hàng & dịch vụ của bạn';
      if (userBadge) {
        userBadge.innerHTML = `<span class="user-badge-role partner">🤝 Đối tác: <b>${escapeHtml(name || email)}</b></span>`;
      }
      if (annCard) annCard.hidden = true;

      if (ordersBtn) ordersBtn.textContent = "📦 Đơn hàng của tôi";
      if (pricesBtn) pricesBtn.textContent = "🏷️ Dịch vụ của tôi";
      if (depositsBtn) depositsBtn.hidden = true;
      if (campaignsBtn) campaignsBtn.hidden = true;
      if (couponsBtn) couponsBtn.hidden = true;
      if (guideBtn) guideBtn.hidden = true;
      if (partnersBtn) partnersBtn.hidden = true;
    } else {
      if (brandTitle) brandTitle.innerHTML = 'VietNam Legacy <span>ADMIN</span>';
      if (brandSubtitle) brandSubtitle.textContent = 'Đơn hàng · Giá bán · Ưu đãi';
      if (userBadge) {
        userBadge.innerHTML = `<span class="user-badge-role admin">👑 Quản trị viên</span>`;
      }
      if (annCard) annCard.hidden = false;

      if (ordersBtn) ordersBtn.textContent = "Đơn hàng & thông báo";
      if (pricesBtn) pricesBtn.textContent = "Giá sản phẩm";
      if (depositsBtn) depositsBtn.hidden = false;
      if (campaignsBtn) campaignsBtn.hidden = false;
      if (couponsBtn) couponsBtn.hidden = false;
      if (guideBtn) guideBtn.hidden = false;
      if (partnersBtn) partnersBtn.hidden = false;
    }

    loadOrders();
    if (role === "admin") {
      loadAnnouncement();
    }
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
      const res = await api("/api/admin/orders?limit=100");
      allOrders = res.orders || [];
      updateStats();
      renderOrders();
    } catch (err) {
      ordersContainer.innerHTML = `<p class="admin-error-msg">${escapeHtml(err.message)}</p>`;
    }
  }

  function updateStats() {
    document.querySelector("#stat-total-orders").textContent = allOrders.length;
    document.querySelector("#stat-processing-orders").textContent =
      allOrders.filter((o) => o.status === "processing" || o.status === "pending").length;
    document.querySelector("#stat-completed-orders").textContent =
      allOrders.filter((o) => o.status === "completed").length;

    const revenue = allOrders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + (o.total || 0), 0);
    document.querySelector("#stat-total-revenue").textContent = money(revenue);
  }

  function filterOrders() {
    return allOrders.filter((order) => {
      // Status filter
      if (currentFilter === "processing") {
        if (order.status !== "processing" && order.status !== "cancelled" && order.status !== "pending") return false;
      } else if (currentFilter === "completed") {
        if (order.status !== "completed" && order.status !== "cancelled") return false;
      } else if (currentFilter === "cancelled") {
        if (order.status !== "cancelled") return false;
      }

      // Keyword search
      if (searchQuery) {
        const matchId = order.id.toLowerCase().includes(searchQuery);
        const matchName = (order.customerName || "").toLowerCase().includes(searchQuery);
        const matchEmail = (order.customerEmail || "").toLowerCase().includes(searchQuery);
        const matchDiscord = (order.discordAccount || "").toLowerCase().includes(searchQuery);
        if (!matchId && !matchName && !matchEmail && !matchDiscord) return false;
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
            ${serverInviteBox}
            ${giftClaimBox}

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

  // Global click handler for order actions
  document.addEventListener("click", async (e) => {
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
        updateStats();
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
        updateStats();
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
        saveAnnouncementBtn.textContent = "Lưu & Đăng thông báo ⚡";
      }
    });
  }

  // Init
  checkAuthAndInit();
})();

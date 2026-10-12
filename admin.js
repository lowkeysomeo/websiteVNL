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

  function showLogin() {
    loginScreen.hidden = false;
    adminApp.hidden = true;
    passwordInput.value = "";
    loginError.hidden = true;
  }

  function showDashboard() {
    loginScreen.hidden = true;
    adminApp.hidden = false;
    loadOrders();
  }

  async function checkAuthAndInit() {
    if (!adminKey) {
      showLogin();
      return;
    }
    try {
      await api("/api/admin/orders?limit=1");
      showDashboard();
    } catch {
      adminKey = "";
      sessionStorage.removeItem("vnl_admin_key");
      showLogin();
    }
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    const password = passwordInput.value.trim();
    if (!password) return;

    try {
      await api("/api/admin/auth", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      adminKey = password;
      sessionStorage.setItem("vnl_admin_key", adminKey);
      showDashboard();
    } catch (err) {
      loginError.textContent = err.message;
      loginError.hidden = false;
    }
  });

  logoutBtn.addEventListener("click", () => {
    adminKey = "";
    sessionStorage.removeItem("vnl_admin_key");
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
        if (order.status !== "processing" && order.status !== "pending") return false;
      } else if (currentFilter === "completed") {
        if (order.status !== "completed") return false;
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
            const isLog = item.deliveryType === "log";
            const badgeClass = isLog ? "item-badge-log" : "item-badge-gift";
            const badgeText = isLog ? "NẠP ACC (LOG)" : "LINK CLAIM (GIFT)";
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

        // GIFT CLAIM BOX
        let giftClaimBox = "";
        const hasGift = (order.items || []).some((i) => i.deliveryType !== "log");
        if (hasGift) {
          giftClaimBox = `
            <div class="admin-gift-claim-box">
              <div class="admin-gift-claim-header">🎁 LINK CLAIM QUÀ TẶNG CHO KHÁCH (GIFT)</div>
              <div class="admin-claim-input-group">
                <input
                  class="admin-claim-input"
                  data-order-claim="${order.id}"
                  placeholder="Dán link claim quà Discord (vd: https://discord.gift/...)"
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
            ${giftClaimBox}

            <div class="admin-order-footer">
              <div class="admin-order-total">
                Thanh toán qua Ví: <strong>${money(order.total)}</strong>
              </div>
              <div class="admin-action-buttons">
                ${
                  order.status !== "completed"
                    ? `<button class="admin-status-btn btn-complete" data-action="set-status" data-status="completed" data-order-id="${order.id}">✅ Hoàn tất</button>`
                    : ""
                }
                ${
                  order.status !== "processing"
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

  // Init
  checkAuthAndInit();
})();

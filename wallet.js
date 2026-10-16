(() => {
  const dialog = document.querySelector("#wallet-dialog");
  const content = document.querySelector("#wallet-content");
  const message = document.querySelector("#wallet-message");
  const label = document.querySelector("#wallet-label");
  const wallet = {
    user: null,
    csrfToken: null,
    balance: null,
    paymentsEnabled: false,
    bank: null,
    available: false,
    mode: "login",
  };
  window.vnlWallet = wallet;
  let timer;
  let currentDeposit = null;
  let busy = false;
  const statusLabels = {
    pending: "Chờ chuyển khoản",
    credited: "Đã cộng tiền",
    expired: "Đã hết hạn",
    review: "Cần đối soát",
  };
  const safe = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  const formatCurrencyNumber = (value) =>
    new Intl.NumberFormat("vi-VN").format(Number(value) || 0);
  const money = (value) =>
    formatCurrencyNumber(value) + "đ";
  const moneyText = (value) =>
    formatCurrencyNumber(value) + "đ";
  const date = (value) => new Date(value).toLocaleString("vi-VN");
  function say(text = "") {
    message.textContent = text;
  }
  async function api(route, options = {}) {
    const response = await fetch(route, {
      credentials: "same-origin",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(wallet.csrfToken ? { "X-CSRF-Token": wallet.csrfToken } : {}),
        ...options.headers,
      },
      signal: AbortSignal.timeout(15000),
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(
        "Hệ thống tài khoản chưa kết nối. Hãy mở trang qua máy chủ của shop.",
      );
    }
    if (!response.ok) {
      const error = new Error(data.error || "Không xử lý được yêu cầu.");
      error.status = response.status;
      throw error;
    }
    return data;
  }
  function updateLabel() {
    const isLoggedIn = Boolean(wallet.user);
    label.textContent = isLoggedIn ? formatCurrencyNumber(wallet.balance || 0) + "đ" : "Đăng nhập";
    const topbarLogout = document.querySelector("#topbar-logout");
    if (topbarLogout) {
      topbarLogout.style.display = isLoggedIn ? "inline-flex" : "none";
      if (isLoggedIn && !topbarLogout.querySelector("svg") && typeof paintIcons === "function") {
        paintIcons(topbarLogout);
      }
    }
    const sidebarLogout = document.querySelector("#sidebar-logout");
    if (sidebarLogout) {
      sidebarLogout.style.display = isLoggedIn ? "flex" : "none";
      if (isLoggedIn && !sidebarLogout.querySelector("svg") && typeof paintIcons === "function") {
        paintIcons(sidebarLogout);
      }
    }
    document.dispatchEvent(
      new CustomEvent("vnl:session", {
        detail: { user: wallet.user, balance: wallet.balance },
      }),
    );
  }
  async function loadSession() {
    try {
      Object.assign(wallet, await api("/api/session"), { available: true });
    } catch {
      wallet.available = false;
    }
    updateLabel();
  }
  function authView() {
    const register = wallet.mode === "register";
    content.innerHTML = `<div class="wallet-tabs" role="tablist" aria-label="Tài khoản">
      <button role="tab" aria-selected="${!register}" data-auth-mode="login">Đăng nhập</button>
      <button role="tab" aria-selected="${register}" data-auth-mode="register">Đăng ký</button></div>
      <form id="wallet-auth-form"><label>Email<input name="email" type="email" maxlength="254" autocomplete="email" required placeholder="ban@example.com"></label>
      <label>Mật khẩu<input name="password" type="password" minlength="10" maxlength="128" autocomplete="${register ? "new-password" : "current-password"}" required placeholder="Tối thiểu 10 ký tự"></label>
      ${register ? '<label>Nhập lại mật khẩu<input name="confirmation" type="password" minlength="10" maxlength="128" autocomplete="new-password" required></label>' : ""}
      <button class="button wallet-blue full-width" type="submit">${register ? "Tạo tài khoản" : "Đăng nhập"}</button></form>
      <p class="wallet-muted">Số dư và lịch sử nạp được lưu theo tài khoản trên máy chủ.</p>`;
    content
      .querySelector("#wallet-auth-form")
      .addEventListener("submit", async (event) => {
        event.preventDefault();
        if (busy) return;
        const form = event.currentTarget;
        const fields = new FormData(form);
        if (register && fields.get("password") !== fields.get("confirmation"))
          return say("Hai mật khẩu chưa khớp.");
        busy = true;
        form.querySelector("button").disabled = true;
        say();
        try {
          Object.assign(
            wallet,
            await api(`/api/auth/${register ? "register" : "login"}`, {
              method: "POST",
              body: JSON.stringify({
                email: fields.get("email"),
                password: fields.get("password"),
              }),
            }),
          );
          await loadSession();
          await showWallet();
        } catch (error) {
          say(error.message);
          if (form.isConnected) form.querySelector("button").disabled = false;
        } finally {
          busy = false;
        }
      });
  }
  function unavailable() {
    content.innerHTML =
      '<div class="wallet-notice">Hệ thống tài khoản và nạp tiền chưa được kết nối trên địa chỉ này. Chức năng sẽ mở khi máy chủ của shop sẵn sàng.</div><p class="wallet-muted">Hiện chưa thể đăng ký, chuyển khoản hoặc nhận số dư tại đây.</p>';
  }
  async function showWallet() {
    stopPolling();
    currentDeposit = null;
    say();
    if (!wallet.available) return unavailable();
    if (!wallet.user) return authView();
    const result = await api("/api/wallet");
    wallet.balance = result.balance;
    updateLabel();
    content.innerHTML = `<div class="wallet-account"><p>${safe(wallet.user.email)}</p><button data-wallet="logout">Đăng xuất</button></div>
      <div class="wallet-summary"><span>SỐ DƯ KHẢ DỤNG</span><strong>${money(result.balance)}</strong></div>
      <section class="purchase-summary" aria-label="Thống kê mua hàng">
        <div><span>Đơn đã mua</span><strong>${result.purchaseStats.purchasedOrders}</strong></div>
        <div><span>Đã hoàn tất</span><strong>${result.purchaseStats.completedOrders}</strong></div>
        <div><span>Tổng tiền mua</span><strong>${money(result.purchaseStats.totalSpent)}</strong></div>
      </section>
      <button type="button" class="button secondary full-width" data-wallet="purchase-history">Xem lịch sử mua hàng →</button>
      ${wallet.paymentsEnabled ? '<p class="wallet-muted">Tạo yêu cầu nạp rồi chuyển khoản đúng số tiền và nội dung. Số dư tự cập nhật khi ngân hàng xác nhận.</p>' : '<div class="wallet-notice">Shop chưa mở nạp tiền. Đừng chuyển khoản trước khi yêu cầu nạp và mã QR được cấp tại đây.</div>'}
      <form id="wallet-deposit-form"><label>Số tiền nạp (VND)<input name="amount" type="number" min="10000" max="10000000" step="1" required value="50000" ${wallet.paymentsEnabled ? "" : "disabled"}></label>
      <div class="wallet-presets">${[50000, 100000, 200000, 500000].map((amount) => `<button type="button" data-amount="${amount}" ${wallet.paymentsEnabled ? "" : "disabled"}>${money(amount)}</button>`).join("")}</div>
      <button type="submit" class="button wallet-blue full-width" ${wallet.paymentsEnabled ? "" : "disabled"}>Tạo yêu cầu nạp</button></form>
      <section class="wallet-history"><h3>Lịch sử nạp tiền</h3>${result.deposits.length ? `<ul>${result.deposits.map((deposit) => `<li><div><strong>${money(deposit.amount)}</strong><small>${date(deposit.createdAt)} · ${safe(deposit.code)}</small></div><button class="${safe(deposit.status)}" data-deposit="${safe(deposit.id)}">${statusLabels[deposit.status] || "Đang xử lý"}</button></li>`).join("")}</ul>` : '<p class="wallet-muted">Bạn chưa có giao dịch nạp tiền.</p>'}</section>`;
    content
      .querySelector("#wallet-deposit-form")
      .addEventListener("submit", async (event) => {
        event.preventDefault();
        if (busy || !wallet.paymentsEnabled) return;
        const form = event.currentTarget;
        busy = true;
        form.querySelector('[type="submit"]').disabled = true;
        say();
        try {
          const result = await api("/api/deposits", {
            method: "POST",
            body: JSON.stringify({
              amount: Number(new FormData(form).get("amount")),
            }),
          });
          transferView(result);
        } catch (error) {
          say(error.message);
          if (form.isConnected)
            form.querySelector('[type="submit"]').disabled = false;
        } finally {
          busy = false;
        }
      });
  }
  function transferView(result) {
    stopPolling();
    say();
    currentDeposit = result.deposit.id;
    const { deposit, bank, qrUrl } = result;
    const transferContent = result.transferContent || deposit.code;
    const pending = deposit.status === "pending" && wallet.paymentsEnabled;
    content.innerHTML = `<button class="button secondary" data-wallet="back">← Quay lại ví</button>
      ${
        pending
          ? `<div class="wallet-transfer"><div class="wallet-qr-wrapper"><img class="wallet-qr" id="wallet-qr-image" src="${safe(qrUrl)}" alt="Mã QR chuyển khoản cho yêu cầu ${safe(deposit.code)}" width="190" height="240"><button type="button" class="wallet-qr-toggle-btn" data-wallet="toggle-qr" title="Bấm để che hoặc hiện mã QR">🙈 Che mã QR</button></div><dl class="wallet-bank">
      <dt>Ngân hàng</dt><dd>${safe(bank.gateway)}</dd><dt>Tài khoản nhận</dt><dd>${safe(bank.accountNumber)} <button data-copy="${safe(bank.accountNumber)}">Sao chép</button></dd><dt>Chủ tài khoản</dt><dd>${safe(bank.accountName)}</dd>
      <dt>Số tiền</dt><dd>${money(deposit.amount)}</dd><dt>Nội dung chuyển khoản</dt><dd class="transfer-code">${safe(transferContent)} <button data-copy="${safe(transferContent)}">Sao chép</button></dd></dl></div>
      <div class="wallet-notice">Chuyển đúng số tiền và giữ nguyên nội dung. Chỉ chuyển một lần cho mỗi yêu cầu. Yêu cầu có hiệu lực đến ${date(deposit.expiresAt)}.</div>`
          : `<div class="wallet-summary"><span>YÊU CẦU ${safe(deposit.code)}</span><strong>${money(deposit.amount)}</strong></div>`
      }
      <p class="wallet-status" id="wallet-transfer-status">${statusText(deposit)}</p>
      <button class="button wallet-blue full-width" data-wallet="refresh">Kiểm tra giao dịch</button>
      <p class="wallet-muted">Nếu số tiền hoặc nội dung không khớp, vui lòng liên hệ shop để đối soát.</p>
      <a class="button secondary" href="https://discord.gg/F3J7hWNRc4" target="_blank" rel="noopener noreferrer">Hỗ trợ trên Discord ↗</a>`;
    if (pending) timer = setInterval(checkDeposit, 4000);
  }
  function statusText(deposit) {
    return (
      {
        pending:
          "Đang chờ hệ thống tự động cộng tiền (tự cập nhật mỗi 4 giây)...",
        credited: "🎉 Nạp tiền thành công! Đã tự động cộng tiền vào ví.",
        review: "Giao dịch cần shop đối soát. Số dư chưa được cộng.",
        expired:
          "Yêu cầu đã hết hạn. Nếu đã chuyển khoản, liên hệ shop để đối soát.",
      }[deposit.status] || "Đang xử lý."
    );
  }
  async function checkDeposit() {
    if (!currentDeposit || !dialog.open || document.hidden || busy) return;
    busy = true;
    try {
      const result = await api(`/api/deposits/${currentDeposit}`);
      wallet.balance = result.balance;
      updateLabel();
      say();
      const statusEl = content.querySelector("#wallet-transfer-status");
      if (statusEl) statusEl.textContent = statusText(result.deposit);
      if (result.deposit.status !== "pending") {
        stopPolling();
        transferView(result);
        if (result.deposit.status === "credited") {
          say(`🎉 Nạp tiền thành công! Đã cộng ${moneyText(result.deposit.amount)} vào ví.`);
        }
      }
    } catch (error) {
      say(error.message);
      if (error.status === 401) stopPolling();
    } finally {
      busy = false;
    }
  }
  function stopPolling() {
    clearInterval(timer);
    timer = null;
  }
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    try {
      if (button.dataset.wallet === "open") {
        closeMenu();
        dialog.showModal();
        content.innerHTML = '<p class="wallet-muted">Đang tải tài khoản…</p>';
        say();
        await loadSession();
        await showWallet();
      }
      if (button.dataset.wallet === "purchase-history") {
        dialog.close();
        if (typeof showOrders === "function") await showOrders();
      }
      if (button.dataset.authMode) {
        wallet.mode = button.dataset.authMode;
        say();
        authView();
      }
      if (button.dataset.wallet === "logout") {
        if (!window.confirm("Bạn có chắc chắn muốn đăng xuất tài khoản?")) return;
        try {
          await api("/api/auth/logout", { method: "POST", body: "{}" });
        } catch {
          // Proceed with clearing local state even if network fails or session was already closed
        }
        Object.assign(wallet, { user: null, csrfToken: null, balance: null });
        updateLabel();
        if (dialog.open) {
          authView();
        }
        if (typeof closeMenu === "function") closeMenu();
        document.dispatchEvent(new CustomEvent("vnl:logout"));
      }
      if (button.dataset.wallet === "back") await showWallet();
      if (button.dataset.wallet === "refresh") await checkDeposit();
      if (button.dataset.wallet === "toggle-qr") {
        const qrImg = dialog.querySelector("#wallet-qr-image");
        if (qrImg) {
          const isBlurred = qrImg.classList.toggle("blurred");
          button.textContent = isBlurred ? "👁 Hiện mã QR" : "🙈 Che mã QR";
        }
      }
      if (button.dataset.amount)
        content.querySelector('[name="amount"]').value = button.dataset.amount;
      if (button.dataset.copy) {
        await navigator.clipboard.writeText(button.dataset.copy);
        button.textContent = "Đã sao chép";
      }
      if (button.dataset.deposit)
        transferView(await api(`/api/deposits/${button.dataset.deposit}`));
    } catch (error) {
      say(error.message);
    }
  });
  dialog.addEventListener("close", stopPolling);
  loadSession();
})();

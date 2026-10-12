const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  box: '<path d="m3 7 9-4 9 4v10l-9 4-9-4Z M3 7l9 4 9-4 M12 11v10 M7.5 5l9 4"/>',
  heart:
    '<path d="M20.8 4.6a5.6 5.6 0 0 0-8.8 1 5.6 5.6 0 0 0-8.8-1C-1 9 6 16 12 21c6-5 13-12 8.8-16.4Z"/>',
  gamepad:
    '<path d="M8 7h8c3 0 4 2 5 6l1 5c.5 3-3 3-5 0l-2-2H9l-2 2c-2 3-5.5 3-5 0l1-5c1-4 2-6 5-6Z M6 10v5 M3.5 12.5h5 M16 11h.01 M19 14h.01"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8Z M2 12l10 5 10-5 M2 16l10 5 10-5"/>',
  sparkles:
    '<path d="m12 3 2.8 6.2L21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8Z M20 2v4 M18 4h4"/>',
  book: '<path d="M12 5c-3-2-7-2-10 0v15c3-2 7-2 10 0 3-2 7-2 10 0V5c-3-2-7-2-10 0Z M12 5v15"/>',
  headphones:
    '<path d="M4 14v-3a8 8 0 0 1 16 0v3 M4 12H3v8h4v-8Z M20 12h1v8h-4v-8Z"/>',
  menu: '<path d="M4 6h16 M4 12h16 M4 18h16"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  bag: '<path d="M5 7h14l2 14H3Z M8 8V6a4 4 0 0 1 8 0v2"/>',
  arrow: '<path d="M4 12h16 M14 6l6 6-6 6"/>',
  shield: '<path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6Z m-4 9 3 3 5-6"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
};

function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.grid}</svg>`;
}

function paintIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((element) => {
    element.innerHTML = icon(element.dataset.icon);
  });
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}

function money(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: storeConfig.currency,
  }).format(value);
}

function getProduct(id) {
  return products.find((product) => product.id === id);
}

function getVariant(product, id) {
  return product.variants.find((variant) => variant.id === id);
}

function loadSavedState() {
  const empty = { cart: [], favorites: [], orders: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(storeConfig.storageKey));
    if (!saved || typeof saved !== "object") return empty;

    const cart = Array.isArray(saved.cart)
      ? saved.cart
          .filter((item) => {
            const product = getProduct(item?.productId);
            return (
              product &&
              getVariant(product, item.variantId) &&
              Number.isInteger(item.quantity) &&
              item.quantity > 0 &&
              item.quantity <= 10
            );
          })
          .slice(0, 40)
      : [];
    const favorites = Array.isArray(saved.favorites)
      ? [...new Set(saved.favorites.filter((id) => getProduct(id)))]
      : [];
    const orders = Array.isArray(saved.orders)
      ? saved.orders
          .filter((order) => {
            return (
              order &&
              typeof order.id === "string" &&
              typeof order.name === "string" &&
              Number.isFinite(order.total) &&
              Array.isArray(order.items) &&
              !Number.isNaN(Date.parse(order.createdAt)) &&
              order.items.every(
                (item) =>
                  typeof item.name === "string" &&
                  typeof item.variant === "string" &&
                  Number.isInteger(item.quantity),
              )
            );
          })
          .slice(0, 20)
      : [];
    return { cart, favorites, orders };
  } catch {
    return empty;
  }
}

const state = {
  ...loadSavedState(),
  category: "all",
  query: "",
  sort: "featured",
  favoritesOnly: false,
};

const grid = document.querySelector("#product-grid");
const search = document.querySelector("#search");
const cartDialog = document.querySelector("#cart-dialog");
const productDialog = document.querySelector("#product-dialog");
const checkoutDialog = document.querySelector("#checkout-dialog");
const infoDialog = document.querySelector("#info-dialog");
let toastTimer;

function notify(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3000);
}

function saveState() {
  const { cart, favorites, orders } = state;
  try {
    localStorage.setItem(
      storeConfig.storageKey,
      JSON.stringify({ cart, favorites, orders }),
    );
  } catch {
    notify(
      "Trình duyệt chưa cho phép lưu. Dữ liệu hiện chỉ có trong phiên này.",
    );
  }
  updateCounts();
}

function updateCounts() {
  document.querySelector("#cart-count").textContent = state.cart.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  document.querySelector("#favorite-count").textContent =
    state.favorites.length;
}

function normalize(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
}

function visibleProducts() {
  const query = normalize(state.query.trim());
  const list = products.filter((product) => {
    const matchesCategory =
      state.category === "all" || product.category === state.category;
    const matchesSearch = normalize(
      `${product.name} ${product.description} ${categoryNames[product.category]}`,
    ).includes(query);
    const matchesFavorites =
      !state.favoritesOnly || state.favorites.includes(product.id);
    return matchesCategory && matchesSearch && matchesFavorites;
  });
  const price = (product) =>
    product.service ? Infinity : product.variants[0].price;
  if (state.sort === "price-asc") list.sort((a, b) => price(a) - price(b));
  if (state.sort === "price-desc")
    list.sort((a, b) => {
      if (a.service || b.service)
        return Number(a.service || false) - Number(b.service || false);
      return price(b) - price(a);
    });
  if (state.sort === "name")
    list.sort((a, b) => a.name.localeCompare(b.name, "vi"));
  return list;
}

function renderProducts() {
  const list = visibleProducts();
  grid.innerHTML = list
    .map((product) => {
      const favorite = state.favorites.includes(product.id);
      const price = product.service
        ? "Liên hệ"
        : money(product.variants[0].price);
      return `<article class="product-card" data-product="${product.id}">
      <div class="product-media">
        <button class="product-open" data-detail="${product.id}" aria-label="Xem chi tiết ${product.name}"><img src="${product.image}" alt="Minh họa ${product.name}" loading="lazy" width="350" height="210"></button>
        <span class="product-badge">${product.badge}</span>
        <button class="favorite-button ${favorite ? "selected" : ""}" data-favorite="${product.id}" aria-pressed="${favorite}" aria-label="${favorite ? "Bỏ yêu thích" : "Yêu thích"} ${product.name}">${icon("heart")}</button>
      </div>
      <div class="product-body">
        <div class="product-category">${categoryNames[product.category].toUpperCase()}</div>
        <button class="product-heading" data-detail="${product.id}">${product.name}</button>
        <p class="product-description">${product.description}</p>
        <ul class="product-features">${product.features.map((feature) => `<li>${icon("check")}<span>${feature}</span></li>`).join("")}</ul>
        <div class="product-bottom">
          <div><span class="price-label">${product.service ? "BÁO GIÁ THEO YÊU CẦU" : "GIÁ MẪU TỪ"}</span><span class="price ${product.service ? "service-price" : ""}">${price}</span></div>
          ${
            product.service
              ? `<button class="add-button" data-detail="${product.id}">Tư vấn ${icon("arrow")}</button>`
              : `<div class="product-card-actions">
                  <button class="add-button" data-add="${product.id}" title="Thêm vào giỏ hàng">${icon("bag")} Thêm giỏ</button>
                  <button class="buy-button" data-buy="${product.id}" title="Mua trực tiếp không cần giỏ">Mua ngay ⚡</button>
                </div>`
          }
        </div>
      </div>
    </article>`;
    })
    .join("");
  document.querySelector("#result-count").textContent =
    `${list.length} sản phẩm & dịch vụ${state.favoritesOnly ? " yêu thích" : ""}`;
  document.querySelector("#empty-state").hidden = list.length > 0;
  document.querySelector("#reset-filters").hidden =
    state.category === "all" && !state.query && !state.favoritesOnly;
  document.querySelectorAll("[data-category]").forEach((button) => {
    const selected = button.dataset.category === state.category;
    button.classList.toggle("active", selected);
    if (button.classList.contains("filter"))
      button.setAttribute("aria-pressed", String(selected));
  });
  document
    .querySelector('[data-action="favorites"]')
    .classList.toggle("active", state.favoritesOnly);
}

function resetFilters() {
  state.category = "all";
  state.query = "";
  state.favoritesOnly = false;
  state.sort = "featured";
  search.value = "";
  document.querySelector("#sort").value = "featured";
  renderProducts();
}

function showProduct(id, isDirectBuy = false) {
  const product = getProduct(id);
  if (!product) return;
  const first = product.variants[0];
  document.querySelector("#product-detail").innerHTML = `
    <div class="detail-layout">
      <img class="detail-image" src="${product.image}" alt="Minh họa ${product.name}">
      <div class="detail-copy" data-product="${product.id}">
        <div class="eyebrow">${categoryNames[product.category].toUpperCase()}</div>
        <h2 id="product-title">${product.name}</h2>
        ${isDirectBuy ? '<div class="direct-buy-banner">⚡ MUA TRỰC TIẾP · Chọn gói bạn muốn để tiến hành thanh toán ngay</div>' : ""}
        <p>${product.detail}</p>
        <ul class="product-features">${product.features.map((feature) => `<li>${icon("check")}${feature}</li>`).join("")}</ul>
        ${
          product.service
            ? `
          <a class="button primary full-width" href="${storeConfig.discordUrl}" target="_blank" rel="noopener noreferrer">Trao đổi trên Discord ${icon("arrow")}</a>
          <p class="fine-print">Báo giá sau khi thống nhất yêu cầu và phạm vi thực hiện.</p>
        `
            : `
          <label for="variant">Chọn gói sản phẩm</label>
          <select id="variant">${product.variants.map((variant) => `<option value="${variant.id}">${variant.name} — ${money(variant.price)}</option>`).join("")}</select>
          <div class="detail-price" id="detail-price">${money(first.price)}</div>
          <div class="detail-actions">
            <button class="button secondary" id="detail-add">${icon("bag")} Thêm giỏ</button>
            <button class="button primary detail-buy-btn" id="detail-buy">Mua ngay ⚡</button>
          </div>
          <p class="fine-print">Thanh toán an toàn qua số dư ví VietNam Legacy.</p>
        `
        }
      </div>
    </div>`;
  if (!product.service) {
    const select = document.querySelector("#variant");
    select.addEventListener("change", () => {
      document.querySelector("#detail-price").textContent = money(
        getVariant(product, select.value).price,
      );
    });
    document.querySelector("#detail-add").addEventListener("click", () => {
      addToCart(id, select.value);
      productDialog.close();
    });
    document.querySelector("#detail-buy").addEventListener("click", () => {
      productDialog.close();
      buyNowDirect(id, select.value);
    });
  }
  productDialog.showModal();
}

function buyNowDirect(productId, variantId) {
  const product = getProduct(productId);
  if (!product || product.service) return;
  const variant = variantId
    ? getVariant(product, variantId)
    : product.variants[0];
  if (!variant) return;

  const directItem = {
    productId: product.id,
    variantId: variant.id,
    name: product.name,
    variant: variant.name,
    price: variant.price,
    quantity: 1,
    deliveryType: variant.deliveryType || "gift",
  };

  startCheckout(directItem);
}


function addToCart(productId, variantId) {
  const product = getProduct(productId);
  if (!product || product.service) return;
  const variant = variantId
    ? getVariant(product, variantId)
    : product.variants[0];
  if (!variant) return;
  const existing = state.cart.find(
    (item) => item.productId === productId && item.variantId === variant.id,
  );
  if (existing?.quantity >= 10)
    return notify("Tối đa 10 gói cùng loại trong một đơn mẫu.");
  if (existing) existing.quantity += 1;
  else state.cart.push({ productId, variantId: variant.id, quantity: 1 });
  saveState();
  notify(`Đã thêm ${product.name} vào giỏ hàng`);
}

function cartTotal() {
  return state.cart.reduce((sum, item) => {
    const variant = getVariant(getProduct(item.productId), item.variantId);
    return sum + variant.price * item.quantity;
  }, 0);
}

function renderCart() {
  const content = document.querySelector("#cart-content");
  if (!state.cart.length) {
    content.innerHTML = `<div class="cart-empty">${icon("bag")}<h3>Giỏ hàng còn trống</h3><p>Chọn một gói bạn thích để bắt đầu.</p><button class="button primary" data-close>Khám phá sản phẩm ${icon("arrow")}</button></div>`;
    return;
  }
  content.innerHTML =
    state.cart
      .map((item, index) => {
        const product = getProduct(item.productId);
        const variant = getVariant(product, item.variantId);
        return `<div class="cart-row">
      <img src="${product.image}" alt="${product.name}">
      <div><div class="cart-row-top"><strong>${product.name}</strong><span>${money(variant.price * item.quantity)}</span></div>
      <small>${variant.name}</small>
      <div class="quantity-controls"><button data-quantity="${index}" data-change="-1" aria-label="Giảm số lượng ${product.name}">−</button><span>${item.quantity}</span><button data-quantity="${index}" data-change="1" aria-label="Tăng số lượng ${product.name}" ${item.quantity >= 10 ? "disabled" : ""}>+</button><button class="remove" data-remove="${index}" aria-label="Xóa ${product.name} khỏi giỏ">Xóa</button></div></div>
    </div>`;
      })
      .join("") +
    `<div class="cart-total"><span>Tổng giá trị mẫu</span><strong>${money(cartTotal())}</strong></div><p class="muted">Giá minh họa. Chưa kết nối thanh toán.</p><button class="button primary full-width" id="start-checkout">Tiếp tục đặt hàng thử ${icon("arrow")}</button>`;
}

let currentDirectItem = null;

async function startCheckout(directItem = null) {
  currentDirectItem = directItem;
  const items = directItem ? [directItem] : state.cart;
  if (!items.length) return;
  cartDialog.close();

  const total = directItem
    ? directItem.price * directItem.quantity
    : cartTotal();
  document.querySelector("#checkout-total").textContent = money(total);

  const hasLog = items.some((item) => {
    if (directItem) return directItem.deliveryType === "log";
    const product = getProduct(item.productId);
    const variant = getVariant(product, item.variantId);
    return variant?.deliveryType === "log";
  });

  const giftNotice = document.querySelector("#checkout-gift-notice");
  const logNotice = document.querySelector("#checkout-log-notice");
  const accInput = document.querySelector("#checkout-discord-account");
  const passInput = document.querySelector("#checkout-discord-password");
  const codesInput = document.querySelector("#checkout-backup-codes");
  const balanceEl = document.querySelector("#checkout-wallet-balance");
  const alertEl = document.querySelector("#checkout-wallet-alert");
  const submitBtn = document.querySelector("#checkout-submit-btn");

  if (hasLog) {
    if (logNotice) logNotice.hidden = false;
    if (giftNotice) giftNotice.hidden = true;
    if (accInput) accInput.required = true;
    if (passInput) passInput.required = true;
    if (codesInput) codesInput.required = true;
  } else {
    if (logNotice) logNotice.hidden = true;
    if (giftNotice) giftNotice.hidden = false;
    if (accInput) accInput.required = false;
    if (passInput) passInput.required = false;
    if (codesInput) codesInput.required = false;
  }

  if (balanceEl) balanceEl.textContent = "Đang kiểm tra...";
  if (alertEl) alertEl.hidden = true;
  if (submitBtn) submitBtn.disabled = false;

  try {
    const res = await fetch("/api/session", { credentials: "same-origin" });
    const sess = await res.json();
    if (sess.user) {
      if (balanceEl) balanceEl.textContent = money(sess.balance || 0);
      const emailInput = document.querySelector('#checkout-form [name="email"]');
      if (emailInput && !emailInput.value) emailInput.value = sess.user.email;

      if ((sess.balance || 0) < total) {
        if (alertEl) {
          alertEl.textContent = `⚠️ Số dư ví không đủ (${money(sess.balance || 0)} < ${money(total)}). Vui lòng nạp thêm tiền vào ví để thanh toán đơn.`;
          alertEl.hidden = false;
        }
      }
    } else {
      if (balanceEl) balanceEl.textContent = "Chưa đăng nhập";
      if (alertEl) {
        alertEl.textContent = "⚠️ Bạn chưa đăng nhập ví. Vui lòng bấm vào nút 'Đăng nhập' ở thanh trên để đăng nhập tài khoản trước khi thanh toán.";
        alertEl.hidden = false;
      }
    }
  } catch {
    if (balanceEl) balanceEl.textContent = "Chưa kết nối máy chủ";
  }

  checkoutDialog.showModal();
}

function showInfo(title, body) {
  document.querySelector("#info-content").innerHTML =
    `<span class="eyebrow">VIETNAM LEGACY</span><h2 id="info-title">${title}</h2>${body}`;
  if (!infoDialog.open) infoDialog.showModal();
}

async function showOrders() {
  showInfo(
    "Đơn hàng của tôi",
    '<p class="muted">Đang tải danh sách đơn hàng từ tài khoản của bạn...</p>',
  );

  let serverOrders = [];
  try {
    const res = await fetch("/api/orders", { credentials: "same-origin" });
    if (res.ok) {
      const data = await res.json();
      serverOrders = data.orders || [];
    }
  } catch {
    // Offline or not logged in
  }

  if (serverOrders.length > 0) {
    const statusLabels = {
      pending: "Chờ xử lý",
      processing: "Đang nạp gói",
      completed: "Đã hoàn thành",
      cancelled: "Đã hủy",
    };

    const ordersHtml = serverOrders
      .map((order) => {
        const dateStr = new Date(order.createdAt).toLocaleString("vi-VN");
        const statusClass = `status-${order.status}`;
        const statusText = statusLabels[order.status] || order.status;

        let claimSection = "";
        if (order.claimLink) {
          claimSection = `
            <div class="order-claim-box">
              <strong>🎁 Link Claim quà tặng Discord của bạn:</strong>
              <div class="claim-link-group">
                <a href="${escapeHtml(order.claimLink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(order.claimLink)}</a>
                <button class="claim-copy-btn" data-copy-link="${escapeHtml(order.claimLink)}">Sao chép</button>
              </div>
            </div>
          `;
        }

        let logNotice = "";
        if (order.hasLogItems) {
          logNotice = `
            <div class="order-log-info">
              🔑 Đơn Nạp Acc: Thông tin tài khoản & mã dự phòng của bạn đã được mã hóa bảo mật tuyệt đối. Shop đang tiến hành nạp gói.
            </div>
          `;
        }

        const itemsHtml = order.items
          .map(
            (item) =>
              `<li>${escapeHtml(item.productName || item.name)} — ${escapeHtml(item.variantName || item.variant)} [${item.deliveryType === "log" ? "LOG" : "GIFT"}] × ${item.quantity} (${money(item.subtotal || item.price * item.quantity)})</li>`,
          )
          .join("");

        return `
          <article class="order-card">
            <div class="order-top">
              <strong>${escapeHtml(order.id)}</strong>
              <span class="order-status-badge ${statusClass}">${statusText}</span>
            </div>
            <p class="muted" style="font-size:11px; margin-bottom: 6px;">
              ${dateStr} · Khách: ${escapeHtml(order.customerName)} (${escapeHtml(order.customerEmail)})
            </p>
            <ul>${itemsHtml}</ul>
            ${claimSection}
            ${logNotice}
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
              <span class="muted" style="font-size:11px;">Thanh toán: Ví VietNam Legacy</span>
              <strong class="order-total" style="color:var(--accent); font-size:15px;">${money(order.total)}</strong>
            </div>
          </article>
        `;
      })
      .join("");

    showInfo("Đơn hàng của tôi", ordersHtml);
    return;
  }

  if (!state.orders.length) {
    showInfo(
      "Đơn hàng của tôi",
      '<p>Bạn chưa có đơn hàng nào. Thêm sản phẩm vào giỏ và thanh toán để xem lịch sử đơn tại đây.</p><button class="button secondary" data-close>Tiếp tục khám phá</button>',
    );
    return;
  }
  showInfo(
    "Đơn hàng của tôi",
    `<p class="muted">Đơn mẫu trên trình duyệt này:</p>${state.orders
      .map(
        (order) => `
    <article class="order-card"><div class="order-top"><strong>${escapeHtml(order.id)}</strong><span class="order-status-badge status-completed">Đơn mẫu</span></div><p style="font-size:11px;">${new Date(order.createdAt).toLocaleString("vi-VN")} · ${escapeHtml(order.name)}</p><ul>${order.items.map((item) => `<li>${escapeHtml(item.name)} — ${escapeHtml(item.variant)} × ${item.quantity}</li>`).join("")}</ul><strong class="order-total" style="color:var(--accent); font-size:15px;">${money(order.total)}</strong></article>
  `,
      )
      .join("")}`,
  );
}


function showSupport() {
  showInfo(
    "Cùng kết nối với Legacy.",
    `
    <p>Cần chọn gói, setup server hoặc phát triển bot? Gửi nhu cầu của bạn trong Discord chính của shop để trao đổi chi tiết.</p>
    <div class="support-card"><strong>Discord VietNam Legacy</strong><p>Link cộng đồng chính do shop cung cấp.</p><a class="button primary" href="${storeConfig.discordUrl}" target="_blank" rel="noopener noreferrer">Mở Discord ${icon("arrow")}</a></div>`,
  );
}

function handleAction(action) {
  closeMenu();
  if (action === "orders") showOrders();
  if (action === "support") showSupport();
  if (action === "favorites") {
    state.favoritesOnly = !state.favoritesOnly;
    state.category = "all";
    state.query = "";
    search.value = "";
    renderProducts();
    document.querySelector("#catalog").scrollIntoView({ behavior: "smooth" });
  }
  if (action === "guide") {
    showInfo(
      "Mua hàng trong 3 bước.",
      `
      <ol class="info-list"><li>Xem sản phẩm và chọn gói phù hợp.</li><li>Thêm vào giỏ, kiểm tra gói và số lượng.</li><li>Thử đặt đơn hoặc liên hệ Discord để hỏi về việc mua thực tế.</li></ol>
      <p>Setup Server và Custom Bot được tư vấn riêng trên Discord. Trang hiện dùng giá mẫu và chưa nhận thanh toán.</p>
      <a class="button primary" href="${storeConfig.discordUrl}" target="_blank" rel="noopener noreferrer">Hỏi shop trên Discord ${icon("arrow")}</a>`,
    );
  }
  if (action === "demo") {
    showInfo(
      "Thông tin bản mẫu",
      "<p>Giao diện tương tác cho VietNam Legacy. Hình minh họa, gói và giá được tạo để trình bày bố cục, chưa phải bảng giá bán thực tế.</p><p>Giỏ hàng, yêu thích và đơn thử lưu trong trình duyệt. Đơn thử chưa dùng số dư ví và chưa có giao hàng tự động. Tài khoản, ví và nạp tiền cần chạy qua máy chủ của shop.</p><p>Discord trong trang là link chính bạn cung cấp. Khi bán thật, shop cần bổ sung giá, điều kiện gói và chính sách hỗ trợ.</p>",
    );
  }
}

function closeMenu() {
  const sidebar = document.querySelector("#sidebar");
  const wasOpen = sidebar.classList.contains("open");
  sidebar.classList.remove("open");
  sidebar.inert = window.matchMedia("(max-width: 760px)").matches;
  document.querySelector(".page-shell").inert = false;
  document.querySelector("#menu-overlay").hidden = true;
  document.querySelector("#open-menu").setAttribute("aria-expanded", "false");
  document.body.classList.remove("menu-open");
  if (wasOpen) document.querySelector("#open-menu").focus();
}

function openMenu() {
  document.querySelector("#sidebar").inert = false;
  document.querySelector("#sidebar").classList.add("open");
  document.querySelector(".page-shell").inert = true;
  document.querySelector("#menu-overlay").hidden = false;
  document.querySelector("#open-menu").setAttribute("aria-expanded", "true");
  document.body.classList.add("menu-open");
  document.querySelector("#close-menu").focus();
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("button, a");
  if (!button) return;
  if (button.hasAttribute("data-close")) button.closest("dialog")?.close();
  if (button.dataset.detail) showProduct(button.dataset.detail);
  if (button.dataset.add) addToCart(button.dataset.add);
  if (button.dataset.buy) showProduct(button.dataset.buy, true);
  if (button.dataset.action) handleAction(button.dataset.action);
  if (button.dataset.favorite) {
    const id = button.dataset.favorite;
    const index = state.favorites.indexOf(id);
    if (index === -1) state.favorites.push(id);
    else state.favorites.splice(index, 1);
    saveState();
    renderProducts();
  }
  if (button.dataset.category) {
    state.category = button.dataset.category;
    state.favoritesOnly = false;
    renderProducts();
    closeMenu();
    document.querySelector("#catalog").scrollIntoView({ behavior: "smooth" });
  }
  if (button.hasAttribute("data-quantity")) {
    const index = Number(button.dataset.quantity);
    const item = state.cart[index];
    if (!item) return;
    item.quantity = Math.min(10, item.quantity + Number(button.dataset.change));
    if (item.quantity <= 0) state.cart.splice(index, 1);
    saveState();
    renderCart();
  }
  if (button.hasAttribute("data-remove")) {
    state.cart.splice(Number(button.dataset.remove), 1);
    saveState();
    renderCart();
  }
  if (button.id === "start-checkout") startCheckout();
  if (button.getAttribute("href") === "#home") {
    resetFilters();
    closeMenu();
  }
});

search.addEventListener("input", () => {
  state.query = search.value;
  renderProducts();
});

document.querySelector("#sort").addEventListener("change", (event) => {
  state.sort = event.target.value;
  renderProducts();
});

document.querySelector("#open-cart").addEventListener("click", () => {
  renderCart();
  cartDialog.showModal();
});
document
  .querySelector("#reset-filters")
  .addEventListener("click", resetFilters);
document.querySelector("#empty-reset").addEventListener("click", resetFilters);
document.querySelector("#open-menu").addEventListener("click", openMenu);
document.querySelector("#close-menu").addEventListener("click", closeMenu);
document.querySelector("#menu-overlay").addEventListener("click", closeMenu);
document.querySelector("#open-menu").setAttribute("aria-expanded", "false");
document.querySelector("#open-menu").setAttribute("aria-controls", "sidebar");

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu();
  if (
    event.key === "Tab" &&
    document.querySelector("#sidebar").classList.contains("open")
  ) {
    const links = [...document.querySelectorAll("#sidebar a, #sidebar button")];
    const first = links[0];
    const last = links[links.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    const outside =
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom;
    if (outside) dialog.close();
  });
});

document.addEventListener("click", async (event) => {
  const copyBtn = event.target.closest("[data-copy-link]");
  if (copyBtn) {
    const text = copyBtn.getAttribute("data-copy-link");
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = "Đã chép!";
      setTimeout(() => {
        copyBtn.textContent = "Sao chép";
      }, 2000);
    } catch {
      notify("Không thể sao chép tự động. Hãy bôi đen link để chép.");
    }
  }
});

document
  .querySelector("#checkout-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const itemsToOrder = currentDirectItem
      ? [currentDirectItem]
      : state.cart.map((item) => {
          const product = getProduct(item.productId);
          const variant = getVariant(product, item.variantId);
          return {
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            price: variant.price,
            deliveryType: variant.deliveryType,
          };
        });

    if (!itemsToOrder.length) return;

    const hasLog = itemsToOrder.some((item) => item.deliveryType === "log");

    const discordAccount = String(data.get("discordAccount") || "").trim();
    const discordPassword = String(data.get("discordPassword") || "").trim();
    const backupCodes = String(data.get("backupCodes") || "").trim();

    if (hasLog) {
      if (!discordAccount) {
        alert("Vui lòng nhập tài khoản Discord (Email hoặc SĐT) để nạp gói.");
        form.elements.discordAccount?.focus();
        return;
      }
      if (!discordPassword) {
        alert("Vui lòng nhập mật khẩu Discord để nạp gói.");
        form.elements.discordPassword?.focus();
        return;
      }
      const codes = backupCodes
        .split(/[\r\n,;\s]+/)
        .map((c) => c.trim())
        .filter(Boolean);
      if (codes.length < 3) {
        alert(
          "Vui lòng nhập tối thiểu 3 mã dự phòng Discord (Backup Codes) cách nhau bởi dấu phẩy.",
        );
        form.elements.backupCodes?.focus();
        return;
      }
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Đang xử lý...";

    try {
      // 1. Check session
      let session = null;
      try {
        const sessRes = await fetch("/api/session", {
          credentials: "same-origin",
        });
        session = await sessRes.json();
      } catch {
        throw new Error("Không thể kết nối máy chủ. Vui lòng thử lại.");
      }

      if (!session || !session.user) {
        throw new Error(
          "Vui lòng đăng nhập tài khoản / ví trước khi đặt hàng (Bấm nút 'Đăng nhập' ở góc phải trên).",
        );
      }

      const total = currentDirectItem
        ? currentDirectItem.price * currentDirectItem.quantity
        : cartTotal();

      if ((session.balance || 0) < total) {
        throw new Error(
          `Số dư ví không đủ (hiện có ${money(session.balance || 0)}, đơn cần ${money(total)}). Vui lòng nạp thêm tiền vào ví.`,
        );
      }

      // 2. Submit order to server
      const payload = {
        name,
        email,
        note,
        paymentMethod: "wallet",
        items: itemsToOrder.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
        discordAccount: hasLog ? discordAccount : undefined,
        discordPassword: hasLog ? discordPassword : undefined,
        backupCodes: hasLog ? backupCodes : undefined,
      };

      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": session.csrfToken,
        },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });

      const resData = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(resData.error || "Không thể tạo đơn hàng.");
      }

      // 3. Clear cart if not direct buy
      if (!currentDirectItem) {
        state.cart = [];
        saveState();
        updateCounts();
      }
      currentDirectItem = null;

      form.reset();
      checkoutDialog.close();

      // Update wallet balance label in topbar
      const walletLabel = document.querySelector("#wallet-label");
      if (walletLabel && typeof resData.balance === "number") {
        walletLabel.textContent = money(resData.balance);
      }

      showInfo(
        "Đặt hàng thành công!",
        `<div class="success-icon">${icon("check")}</div>
        <p>Mã đơn hàng: <strong>${escapeHtml(resData.order.id)}</strong></p>
        <p>Đã thanh toán: <strong>${money(resData.order.total)}</strong> qua Ví VietNam Legacy.</p>
        ${
          resData.order.hasLogItems
            ? '<div class="order-log-info">🔑 <strong>Gói Nạp Acc (Log):</strong> Tài khoản & mã dự phòng của bạn đã được mã hóa bảo mật, chỉ riêng Admin shop mới xem được để đăng nhập nạp gói.</div>'
            : '<div class="gift-notice" style="margin:12px 0; padding:10px; border-radius:6px;">🎁 <strong>Gói Link Gift:</strong> Shop sẽ sớm gửi Link Claim trực tiếp trong mục "Đơn hàng của tôi".</div>'
        }
        <div style="display:flex; gap:10px; margin-top:16px;">
          <button class="button primary" data-action="orders">Xem Đơn hàng của tôi</button>
          <button class="button secondary" data-close>Tiếp tục mua sắm</button>
        </div>`,
      );
    } catch (err) {
      alert(err.message);
      notify(err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Xác nhận thanh toán <span data-icon="arrow"></span>';
      paintIcons();
    }
  });

document
  .querySelector('#checkout-form [name="name"]')
  .addEventListener("input", (event) => {
    event.target.setCustomValidity("");
  });


paintIcons();
updateCounts();
renderProducts();
closeMenu();
window.matchMedia("(max-width: 760px)").addEventListener("change", closeMenu);

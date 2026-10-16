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
  lightbulb:
    '<path d="M9 15c-.6-1.1-.9-2.3-.9-3.5a5.4 5.4 0 1 1 10.8 0c0 1.2-.3 2.4-.9 3.5H9z"/><path d="M10 18h4"/><path d="M10.5 21h3"/><path d="M11.5 8a3 3 0 0 1 3 3"/><line x1="12" y1="2" x2="12" y2="3.8"/><line x1="18.5" y1="4.5" x2="17.2" y2="5.8"/><line x1="21.5" y1="11.5" x2="19.7" y2="11.5"/><line x1="18.5" y1="18.5" x2="17.2" y2="17.2"/><line x1="5.5" y1="18.5" x2="6.8" y2="17.2"/><line x1="2.5" y1="11.5" x2="4.3" y2="11.5"/><line x1="5.5" y1="4.5" x2="6.8" y2="5.8"/>',
  discord: '<path fill="currentColor" stroke="none" d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1568 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>',
  services: '<path fill="currentColor" stroke="none" d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1568 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>',
  creative:
    '<path d="M9 15c-.6-1.1-.9-2.3-.9-3.5a5.4 5.4 0 1 1 10.8 0c0 1.2-.3 2.4-.9 3.5H9z"/><path d="M10 18h4"/><path d="M10.5 21h3"/><path d="M11.5 8a3 3 0 0 1 3 3"/><line x1="12" y1="2" x2="12" y2="3.8"/><line x1="18.5" y1="4.5" x2="17.2" y2="5.8"/><line x1="21.5" y1="11.5" x2="19.7" y2="11.5"/><line x1="18.5" y1="18.5" x2="17.2" y2="17.2"/><line x1="5.5" y1="18.5" x2="6.8" y2="17.2"/><line x1="2.5" y1="11.5" x2="4.3" y2="11.5"/><line x1="5.5" y1="4.5" x2="6.8" y2="5.8"/>',

  book: '<path d="M12 5c-3-2-7-2-10 0v15c3-2 7-2 10 0 3-2 7-2 10 0V5c-3-2-7-2-10 0Z M12 5v15"/>',
  headphones:
    '<path d="M4 14v-3a8 8 0 0 1 16 0v3 M4 12H3v8h4v-8Z M20 12h1v8h-4v-8Z"/>',
  menu: '<path d="M4 6h16 M4 12h16 M4 18h16"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  cart: '<circle cx="9" cy="21" r="1" fill="currentColor"/><circle cx="20" cy="21" r="1" fill="currentColor"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  bag: '<circle cx="9" cy="21" r="1" fill="currentColor"/><circle cx="20" cy="21" r="1" fill="currentColor"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  arrow: '<path d="M4 12h16 M14 6l6 6-6 6"/>',
  shield: '<path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6Z m-4 9 3 3 5-6"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  "chevron-up": '<path d="m18 15-6-6-6 6"/>',
  "arrow-up": '<path d="M12 19V5 M5 12l7-7 7 7"/>',
  diamond: '<path d="M6 3h12l4 6-10 12L2 9l4-6Z M2 9h20 M6 3l4 6 2 12 M18 3l-4 6-2 12"/>',
  crown: '<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7Z"/>',
  fire: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3Z"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z M9 12H4s.55-3.03 2-4.5c1.62-1.63 5-2.5 5-2.5 M15 9V4s3.03.55 4.5 2c1.63 1.62 2.5 5 2.5 5"/>',
  bot: '<rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4 M8 16h.01 M16 16h.01"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
  gift: '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  key: '<path d="m21 2-2 2m-1.5 1.5L16 7l-1.5-1.5L13 7l-1.5-1.5L10 7 4 13a6 6 0 1 0 8.5 8.5L22 12V2h-1Z M7 18a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
};

let revealObserver = null;

function icon(name) {
  if (!name || name === "none") return "";
  if (name === "decor") {
    return '<img src="assets/profile-decor.png" class="decor-cat-icon" alt="" />';
  }
  if (icons[name]) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
  }
  return `<span class="cat-custom-icon" aria-hidden="true">${escapeHtml(name)}</span>`;
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

function formatCurrencyNumber(value) {
  return new Intl.NumberFormat("vi-VN").format(Number(value) || 0);
}

function money(value) {
  return formatCurrencyNumber(value) + ' <img src="assets/wallet-dollar.png" class="currency-icon" alt="$" />';
}

function moneyText(value) {
  return formatCurrencyNumber(value) + " $";
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
  viewMode: "ordered",
};

let storeCategories = [
  { id: "services", name: "Dịch vụ Discord", icon: "discord" },
  { id: "decor", name: "Profile Decor", icon: "decor" },
  { id: "entertainment", name: "Giải trí", icon: "layers" },
  { id: "creative", name: "Sáng tạo", icon: "lightbulb" },
];

function updateCategories(categories) {
  if (Array.isArray(categories) && categories.length) {
    storeCategories = categories;
    categories.forEach((c) => {
      categoryNames[c.id] = c.name;
    });
  }
  renderCategoryFilterPills();
}

function renderCategoryFilterPills() {
  const container = document.querySelector("#catalog-filters");
  if (!container) return;
  const allCats = [...storeCategories];
  products.forEach((p) => {
    if (!allCats.some((c) => c.id === p.category)) {
      allCats.push({ id: p.category, name: categoryNames[p.category] || p.category, icon: "box" });
    }
  });

  const allActive = state.category === "all";
  let html = `
    <button class="filter ${allActive ? "active" : ""}" data-category="all" aria-pressed="${allActive}">
      <span data-icon="grid"></span> Tất cả
    </button>
  `;
  allCats.forEach((cat) => {
    const isSel = state.category === cat.id;
    html += `
      <button class="filter ${isSel ? "active" : ""}" data-category="${escapeHtml(cat.id)}" aria-pressed="${isSel}">
        <span data-icon="${escapeHtml(cat.icon || "box")}"></span> ${escapeHtml(cat.name)}
      </button>
    `;
  });
  container.innerHTML = html;
  paintIcons(container);

  const sideNav = document.querySelector("#sidebar-category-nav");
  if (sideNav) {
    sideNav.innerHTML = allCats.map((cat) => `
      <button class="nav-item ${state.category === cat.id ? "active" : ""}" data-category="${escapeHtml(cat.id)}">
        <span data-icon="${escapeHtml(cat.icon || "box")}"></span> ${escapeHtml(cat.name)}
      </button>
    `).join("");
    paintIcons(sideNav);
  }
}

const grid = document.querySelector("#product-grid");
const search = document.querySelector("#search");
const cartDialog = document.querySelector("#cart-dialog");
const productDialog = document.querySelector("#product-dialog");
const checkoutDialog = document.querySelector("#checkout-dialog");
const infoDialog = document.querySelector("#info-dialog");
let toastTimer;
// Giá hiển thị và bản tính thanh toán được lấy từ cùng một nguồn trên máy chủ.
let catalogReady = false;
let checkoutQuote = null;
let checkoutQuoteRequest = 0;
let checkoutBusy = false;
let checkoutBalance = null;
let appliedCoupon = "";

function variantPriceHtml(variant) {
  if (!catalogReady) return '<span class="price-loading">Đang tải giá...</span>';
  return `${variant.basePrice > variant.price ? `<del class="original-price">${money(variant.basePrice)}</del>` : ""}${money(variant.price)}${variant.sale ? `<small class="sale-caption">${escapeHtml(variant.sale.name)}</small>` : ""}`;
}

async function refreshCatalog() {
  try {
    const response = await fetch("/api/catalog", { cache: "no-store" });
    if (!response.ok) throw new Error();
    const data = await response.json();
    if (Array.isArray(data.categories) && data.categories.length) {
      updateCategories(data.categories);
    }
    const changed = !catalogReady || JSON.stringify(data.products) !== JSON.stringify(products);
    products.splice(0, products.length, ...data.products);
    catalogReady = true;
    document.querySelector("#catalog-price-status").hidden = true;
    if (changed) {
      renderProducts();
      if (cartDialog.open) renderCart();
    }
  } catch {
    const status = document.querySelector("#catalog-price-status");
    status.hidden = false;
    status.textContent = "Chưa cập nhật được giá từ cửa hàng. Vui lòng tải lại trang hoặc thử lại sau.";
  }
}

function checkoutItems() {
  return (currentDirectItem ? [currentDirectItem] : state.cart).map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity }));
}

function syncCheckoutControls() {
  document.querySelector("#checkout-submit-btn").disabled = checkoutBusy || !checkoutQuote;
  document.querySelector("#coupon-apply").disabled = checkoutBusy;
  document.querySelector("#coupon-remove").disabled = checkoutBusy;
  document.querySelector("#checkout-coupon").disabled = checkoutBusy;
}

function paintCheckoutQuote(quote) {
  document.querySelector("#checkout-subtotal").innerHTML = money(quote.subtotal);
  document.querySelector("#checkout-sale-discount").innerHTML = "−" + money(quote.saleDiscount);
  document.querySelector("#checkout-coupon-discount").innerHTML = "−" + money(quote.couponDiscount);
  document.querySelector("#checkout-total").innerHTML = money(quote.total);
  const message = document.querySelector("#coupon-message");
  message.textContent = quote.coupon ? `Đã áp dụng ${quote.coupon.code}: tiết kiệm ${moneyText(quote.couponDiscount)}.` : "Mỗi đơn áp dụng một mã giảm giá.";
  message.classList.remove("is-error");
  document.querySelector("#coupon-remove").hidden = !quote.coupon;
  if (checkoutBalance != null) {
    const alert = document.querySelector("#checkout-wallet-alert");
    alert.hidden = checkoutBalance >= quote.total;
    alert.textContent = `Số dư ví ${moneyText(checkoutBalance)}, cần thanh toán ${moneyText(quote.total)}. Vui lòng nạp thêm tiền.`;
  }
}

async function requestCheckoutQuote(code = appliedCoupon) {
  const request = ++checkoutQuoteRequest;
  checkoutQuote = null;
  syncCheckoutControls();
  const message = document.querySelector("#coupon-message");
  message.textContent = "Đang kiểm tra giá và ưu đãi...";
  try {
    const response = await fetch("/api/quote", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: checkoutItems(), couponCode: code }) });
    const data = await response.json();
    if (request !== checkoutQuoteRequest) return null;
    if (!response.ok) throw new Error(data.error || "Chưa kiểm tra được giá thanh toán.");
    checkoutQuote = data.quote;
    appliedCoupon = data.quote.coupon?.code || "";
    document.querySelector("#checkout-coupon").value = appliedCoupon;
    paintCheckoutQuote(checkoutQuote);
    return checkoutQuote;
  } catch (error) {
    if (request !== checkoutQuoteRequest) return null;
    message.textContent = error.message;
    message.classList.add("is-error");
    document.querySelector("#checkout-total").textContent = "…";
    document.querySelector("#coupon-remove").hidden = !code;
    return null;
  } finally { if (request === checkoutQuoteRequest) syncCheckoutControls(); }
}

document.querySelector("#coupon-apply").addEventListener("click", () => {
  if (!checkoutBusy) requestCheckoutQuote(document.querySelector("#checkout-coupon").value.trim());
});
document.querySelector("#coupon-remove").addEventListener("click", () => {
  if (!checkoutBusy) requestCheckoutQuote("");
});
document.querySelector("#checkout-coupon").addEventListener("input", () => {
  ++checkoutQuoteRequest;
  checkoutQuote = null;
  syncCheckoutControls();
  document.querySelector("#coupon-message").textContent = "Bấm Áp dụng để kiểm tra mã hoặc Bỏ mã để tiếp tục.";
  document.querySelector("#coupon-remove").hidden = false;
});
document.querySelector("#checkout-coupon").addEventListener("keydown", event => {
  if (event.key === "Enter") { event.preventDefault(); document.querySelector("#coupon-apply").click(); }
});



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
    const catLabel = categoryNames[product.category] || product.category || "";
    const matchesSearch = normalize(
      `${product.name} ${product.description} ${catLabel}`,
    ).includes(query);
    const matchesFavorites =
      !state.favoritesOnly || state.favorites.includes(product.id);
    return matchesCategory && matchesSearch && matchesFavorites;
  });
  const price = (product) =>
    product.service ? Infinity : Math.min(...product.variants.map(variant => variant.price));
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

function renderProductCard(product) {
  const favorite = state.favorites.includes(product.id);
  const isOutOfStock = !product.service && product.stock <= 0;
  const price = product.service
    ? "Liên hệ"
    : variantPriceHtml(product.variants.reduce((lowest, variant) => variant.price < lowest.price ? variant : lowest));
  const catUpper = (categoryNames[product.category] || product.category || "CHUNG").toUpperCase();
  return `<article class="product-card" data-product="${product.id}">
  <div class="product-media">
    <button class="product-open" data-detail="${product.id}" aria-label="Xem chi tiết ${escapeHtml(product.name)}"><img src="${escapeHtml(product.image)}" alt="Minh họa ${escapeHtml(product.name)}" loading="lazy" width="350" height="210"></button>
    <span class="product-badge">${escapeHtml(product.badge || catUpper)}</span>
    <button class="favorite-button ${favorite ? "selected" : ""}" data-favorite="${product.id}" aria-pressed="${favorite}" aria-label="${favorite ? "Bỏ yêu thích" : "Yêu thích"} ${escapeHtml(product.name)}">${icon("heart")}</button>
  </div>
  <div class="product-body">
    <div class="product-category">${catUpper}</div>
    <button class="product-heading" data-detail="${product.id}">${escapeHtml(product.name)}</button>
    <p class="product-description">${escapeHtml(product.description)}</p>
    <ul class="product-features">${(product.features || []).map((feature) => `<li>${icon("check")}<span>${escapeHtml(feature)}</span></li>`).join("")}</ul>
    <div class="product-stock-bar" data-product-inventory="${product.id}">
      <span class="stock-badge ${isOutOfStock ? 'is-out' : (product.stock <= 5 && !product.service ? 'is-low' : 'in-stock')}">
        <span class="stock-dot"></span>
        <span class="stock-text">${product.service ? 'Nhận đơn' : (product.stock > 0 ? `Còn: <strong>${product.stock}</strong>` : '<strong>Hết hàng</strong>')}</span>
      </span>
      <span class="sold-badge" title="Đã bán được ${product.soldCount || 0} sản phẩm">
        🔥 Đã bán: <strong>${product.soldCount || 0}</strong>
      </span>
    </div>
    <div class="product-bottom">
      <div><span class="price-label">${product.service ? "BÁO GIÁ THEO YÊU CẦU" : "GIÁ TỪ"}</span><span class="price ${product.service ? "service-price" : ""}">${price}</span></div>
      ${
        product.service
          ? `<button class="add-button" data-detail="${product.id}">Tư vấn ${icon("arrow")}</button>`
          : (isOutOfStock
              ? `<div class="product-card-actions">
                  <button class="add-button is-out-btn" disabled title="Mặt hàng hiện đã hết">${icon("bag")} Hết hàng</button>
                </div>`
              : `<div class="product-card-actions">
                  <button class="add-button" data-add="${product.id}" ${catalogReady ? "" : "disabled"} title="Mua ngay">${icon("cart")} Mua ngay</button>
                </div>`
            )
      }
    </div>
  </div>
</article>`;
}

function renderProducts() {
  const list = visibleProducts();

  if (state.viewMode === "grouped" && state.category === "all" && !state.query && !state.favoritesOnly) {
    const presentCats = [];
    storeCategories.forEach(cat => {
      const prods = list.filter(p => p.category === cat.id);
      if (prods.length > 0) {
        presentCats.push({ ...cat, products: prods });
      }
    });
    list.forEach(p => {
      if (!presentCats.some(c => c.id === p.category)) {
        const catProds = list.filter(x => x.category === p.category);
        presentCats.push({ id: p.category, name: categoryNames[p.category] || p.category, icon: "box", products: catProds });
      }
    });

    grid.className = "catalog-grouped-container";
    grid.innerHTML = presentCats.map(group => `
      <section class="catalog-category-block" data-cat-block="${escapeHtml(group.id)}">
        <div class="category-block-header">
          <div class="category-block-title">
            <span class="category-icon-pill">${icon(group.icon || "box")}</span>
            <div>
              <h3>${escapeHtml(group.name)}</h3>
              <small>${group.products.length} mặt hàng & gói dịch vụ</small>
            </div>
          </div>
          <button type="button" class="category-jump-link" data-category="${escapeHtml(group.id)}" title="Lọc riêng hạng mục này">
            Xem riêng mục này ↗
          </button>
        </div>
        <div class="product-grid">
          ${group.products.map(renderProductCard).join("")}
        </div>
      </section>
    `).join("");
  } else {
    grid.className = "product-grid";
    grid.innerHTML = list.map(renderProductCard).join("");
  }

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
  document.querySelectorAll("[data-view-mode]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.viewMode === state.viewMode);
  });
  document
    .querySelector('[data-action="favorites"]')
    .classList.toggle("active", state.favoritesOnly);
  if (typeof observeScrollReveal === "function") observeScrollReveal();
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
  if (!product.service && !catalogReady) return notify("Đang tải giá sản phẩm, vui lòng thử lại.");
  const first = product.variants[0];
  const catUpper = (categoryNames[product.category] || product.category || "CHUNG").toUpperCase();
  const bgStyle = product.image ? `background-image: url('${String(product.image).replace(/'/g, "\\'")}');` : "";
  document.querySelector("#product-detail").innerHTML = `
    <div class="detail-layout">
      <div class="detail-media">
        <div class="detail-media-backdrop" style="${bgStyle}"></div>
        <img class="detail-image" src="${product.image}" alt="Minh họa ${product.name}">
      </div>
      <div class="detail-copy" data-product="${product.id}">
        <div class="eyebrow">${catUpper}</div>
        <h2 id="product-title">${product.name}</h2>
        ${isDirectBuy ? '<div class="direct-buy-banner">MUA TRỰC TIẾP · Chọn gói bạn muốn để tiến hành thanh toán ngay</div>' : ""}
        <p>${product.detail}</p>
        <ul class="product-features">${product.features.map((feature) => `<li>${icon("check")}${feature}</li>`).join("")}</ul>
        <div class="detail-inventory-bar">
          <span class="detail-stock-pill ${(!product.service && product.stock <= 0) ? 'is-out' : (product.stock <= 5 && !product.service ? 'is-low' : 'in-stock')}">
            <span class="stock-dot"></span>
            ${product.service ? 'Sẵn sàng phục vụ' : (product.stock > 0 ? `Còn trong kho: <strong>${product.stock}</strong>` : '<strong>Tạm thời hết hàng</strong>')}
          </span>
          <span class="detail-sold-pill">🔥 Đã bán: <strong>${product.soldCount || 0}</strong></span>
        </div>
        ${
          product.service
            ? `
          <a class="button primary full-width" href="${storeConfig.discordUrl}" target="_blank" rel="noopener noreferrer">Trao đổi trên Discord ${icon("arrow")}</a>
          <p class="fine-print">Báo giá sau khi thống nhất yêu cầu và phạm vi thực hiện.</p>
        `
            : (product.stock <= 0
              ? `
          <label for="variant">Chọn gói sản phẩm</label>
          <select id="variant">${product.variants.map((variant) => `<option value="${variant.id}">${variant.name}: ${moneyText(variant.price)}</option>`).join("")}</select>
          <div class="detail-price" id="detail-price">${variantPriceHtml(first)}</div>
          <div class="detail-actions">
            <button class="button primary detail-buy-btn is-out-btn full-width" id="detail-buy" disabled>${icon("cart")} Tạm hết</button>
          </div>
          <p class="fine-print" style="color:#f87171;">Mặt hàng này hiện đang tạm hết trong kho. Vui lòng quay lại sau.</p>
        `
              : `
          <label for="variant">Chọn gói sản phẩm</label>
          <select id="variant">${product.variants.map((variant) => `<option value="${variant.id}">${variant.name}: ${moneyText(variant.price)}</option>`).join("")}</select>
          <div class="detail-price" id="detail-price">${variantPriceHtml(first)}</div>
          <div class="detail-actions">
            <button class="button primary detail-buy-btn full-width" id="detail-buy">${icon("cart")} Mua ngay</button>
          </div>
          <p class="fine-print">Thanh toán an toàn qua số dư ví VietNam Legacy.</p>
        `
            )
        }
      </div>
    </div>`;
  if (!product.service && product.stock > 0) {
    const select = document.querySelector("#variant");
    select.addEventListener("change", () => {
      document.querySelector("#detail-price").innerHTML = variantPriceHtml(getVariant(product, select.value));
    });
    document.querySelector("#detail-buy")?.addEventListener("click", () => {
      productDialog.close();
      buyNowDirect(id, select.value);
    });
  }
  const currentScrollY = window.scrollY;
  productDialog.showModal();
  if (window.scrollY !== currentScrollY) {
    window.scrollTo({ top: currentScrollY, behavior: "instant" });
  }
}

function buyNowDirect(productId, variantId) {
  const product = getProduct(productId);
  if (!product || product.service) return;
  if (!catalogReady) return notify("Chưa tải được giá từ cửa hàng.");
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
  if (!catalogReady) return notify("Chưa tải được giá từ cửa hàng.");
  const variant = variantId
    ? getVariant(product, variantId)
    : product.variants[0];
  if (!variant) return;
  const existing = state.cart.find(
    (item) => item.productId === productId && item.variantId === variant.id,
  );
  if (existing?.quantity >= 10)
    return notify("Tối đa 10 gói cùng loại trong một đơn.");
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
    `<div class="cart-total"><span>Tạm tính sau ưu đãi</span><strong>${money(cartTotal())}</strong></div><p class="muted">Bạn có thể nhập mã giảm giá ở bước thanh toán.</p><button class="button primary full-width" id="start-checkout">Tiếp tục thanh toán ${icon("arrow")}</button>`;
}

let currentDirectItem = null;

function isDecorProduct(productId) {
  if (!productId) return false;
  if (productId === "decor" || productId === "decor-gift" || productId === "decor-log") return true;
  const p = getProduct(productId);
  if (p?.category === "decor") return true;
  if (/decor/i.test(productId) || /decor/i.test(p?.name || "")) return true;
  return false;
}

async function startCheckout(directItem = null) {
  if (checkoutBusy) return;
  ++checkoutQuoteRequest;
  checkoutQuote = null;
  checkoutBalance = null;
  appliedCoupon = "";
  document.querySelector("#checkout-coupon").value = "";
  document.querySelector("#coupon-remove").hidden = true;
  currentDirectItem = directItem;
  const items = directItem ? [directItem] : state.cart;
  if (!items.length) return;
  cartDialog.close();

  const total = directItem
    ? directItem.price * directItem.quantity
    : cartTotal();
  document.querySelector("#checkout-total").innerHTML = money(total);

  const hasLog = items.some((item) => {
    if (directItem) return directItem.deliveryType === "log";
    const product = getProduct(item.productId);
    const variant = getVariant(product, item.variantId);
    return variant?.deliveryType === "log";
  });

  const hasBoost = items.some((item) => {
    if (directItem) return directItem.productId === "boost";
    return item.productId === "boost";
  });

  const hasDecor = items.some((item) => {
    const pid = directItem ? directItem.productId : item.productId;
    return isDecorProduct(pid);
  });

  const giftNotice = document.querySelector("#checkout-gift-notice");
  const logNotice = document.querySelector("#checkout-log-notice");
  const boostNotice = document.querySelector("#checkout-boost-notice");
  const decorNotice = document.querySelector("#checkout-decor-notice");
  const accInput = document.querySelector("#checkout-discord-account");
  const passInput = document.querySelector("#checkout-discord-password");
  const codesInput = document.querySelector("#checkout-backup-codes");
  const inviteInput = document.querySelector("#checkout-server-invite");
  const decorFileInput = document.querySelector("#checkout-decor-file");
  const decorImageInput = document.querySelector("#checkout-decor-image-input");
  const decorPreviewWrap = document.querySelector("#checkout-decor-preview-wrap");
  const decorPreviewImg = document.querySelector("#checkout-decor-preview-img");
  const balanceEl = document.querySelector("#checkout-wallet-balance");
  const alertEl = document.querySelector("#checkout-wallet-alert");
  const submitBtn = document.querySelector("#checkout-submit-btn");

  if (hasLog) {
    if (logNotice) logNotice.hidden = false;
    if (accInput) accInput.required = true;
    if (passInput) passInput.required = true;
    if (codesInput) codesInput.required = true;
  } else {
    if (logNotice) logNotice.hidden = true;
    if (accInput) accInput.required = false;
    if (passInput) passInput.required = false;
    if (codesInput) codesInput.required = false;
  }

  if (hasBoost) {
    if (boostNotice) boostNotice.hidden = false;
    if (inviteInput) inviteInput.required = true;
  } else {
    if (boostNotice) boostNotice.hidden = true;
    if (inviteInput) inviteInput.required = false;
  }

  if (hasDecor) {
    if (decorNotice) decorNotice.hidden = false;
  } else {
    if (decorNotice) decorNotice.hidden = true;
  }
  if (decorFileInput) decorFileInput.value = "";
  if (decorImageInput) decorImageInput.value = "";
  if (decorPreviewWrap) decorPreviewWrap.style.display = "none";
  if (decorPreviewImg) decorPreviewImg.src = "";

  const hasDecorGift = items.some((item) => {
    const pid = directItem ? directItem.productId : item.productId;
    const vid = directItem ? directItem.variantId : item.variantId;
    if (pid === "decor-gift") return true;
    if (pid === "decor" && String(vid).includes("gift")) return true;
    const p = getProduct(pid);
    if (p?.id === "decor-gift" || (p?.category === "decor" && /gift/i.test(p?.name || ""))) return true;
    return false;
  });

  const decorGiftProduct = hasDecorGift
    ? items.map(item => {
        const pid = directItem ? directItem.productId : item.productId;
        let p = getProduct(pid);
        if (!p && pid === "decor") {
          p = products.find(prod => prod.variants?.some(v => v.id === (directItem ? directItem.variantId : item.variantId)));
        }
        return p;
      }).find(p => p?.id === "decor-gift" || (p?.category === "decor" && /gift/i.test(p?.name || "")))
    : null;

  const productNotices = document.querySelector('#checkout-product-notices');
  if (productNotices) {
    if (hasDecorGift && decorGiftProduct?.checkoutNotice && (decorGiftProduct.checkoutNotice.title || decorGiftProduct.checkoutNotice.content)) {
      const title = decorGiftProduct.checkoutNotice.title || decorGiftProduct.name;
      const rawContent = decorGiftProduct.checkoutNotice.content || "";
      const contentHtml = escapeHtml(rawContent).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      productNotices.hidden = false;
      productNotices.innerHTML = `<div class="checkout-notice gift-notice">
        <div class="notice-badge">${escapeHtml(title)}</div>
        <p style="white-space:pre-wrap; margin: 4px 0 0;">${contentHtml}</p>
      </div>`;
      if (giftNotice) giftNotice.hidden = true;
    } else {
      productNotices.hidden = true;
      productNotices.innerHTML = "";
      if (giftNotice) giftNotice.hidden = !hasDecorGift;
    }
  } else if (giftNotice) {
    giftNotice.hidden = !hasDecorGift;
  }

  if (balanceEl) balanceEl.textContent = "Đang kiểm tra...";
  if (alertEl) alertEl.hidden = true;
  if (submitBtn) submitBtn.disabled = true;

  try {
    const res = await fetch("/api/session", { credentials: "same-origin" });
    const sess = await res.json();
    if (sess.user) {
      checkoutBalance = sess.balance || 0;
      if (balanceEl) balanceEl.innerHTML = money(sess.balance || 0);
      const emailInput = document.querySelector('#checkout-form [name="email"]');
      if (emailInput && !emailInput.value) emailInput.value = sess.user.email;

      if ((sess.balance || 0) < total) {
        if (alertEl) {
          alertEl.textContent = `⚠️ Số dư ví không đủ (${moneyText(sess.balance || 0)} < ${moneyText(total)}). Vui lòng nạp thêm tiền vào ví để thanh toán đơn.`;
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
  await requestCheckoutQuote("");
}

function showInfo(title, body) {
  document.querySelector("#info-content").innerHTML =
    `<span class="eyebrow">VIETNAM LEGACY</span><h2 id="info-title">${title}</h2>${body}`;
  if (!infoDialog.open) infoDialog.showModal();
}

let ordersRequest = 0;
async function showOrders(offset = 0) {
  const request = ++ordersRequest;
  showInfo(
    "Đơn hàng của tôi",
    '<p class="muted">Đang tải danh sách đơn hàng từ tài khoản của bạn...</p>',
  );

  let data;
  try {
    const res = await fetch("/api/orders?limit=20&offset=" + offset, { credentials: "same-origin", signal: AbortSignal.timeout(15000) });
    data = await res.json();
    if (!res.ok) {
      const error = new Error(data.error || "Không thể tải lịch sử mua hàng.");
      error.status = res.status;
      throw error;
    }
  } catch (error) {
    if (request !== ordersRequest || !infoDialog.open) return;
    showInfo("Lịch sử mua hàng", error.status === 401
      ? '<p class="muted">Đăng nhập để xem số đơn đã mua và lịch sử của tài khoản.</p><button class="button primary" data-wallet="open" data-close>Đăng nhập tài khoản</button>'
      : '<p class="muted">Chưa tải được lịch sử mua hàng. Vui lòng kiểm tra kết nối và thử lại.</p><button class="button secondary" data-action="orders">Thử lại</button>');
    return;
  }
  if (request !== ordersRequest || !infoDialog.open) return;
  const serverOrders = data.orders;
  const userEmail = data.account.email;
  const stats = data.stats;
  const purchaseSummary = `<section class="purchase-summary" aria-label="Thống kê mua hàng">
    <div><span>Đơn đã mua</span><strong>${stats.purchasedOrders}</strong></div>
    <div><span>Đã hoàn tất</span><strong>${stats.completedOrders}</strong></div>
    <div><span>Tổng tiền mua</span><strong>${money(stats.totalSpent)}</strong></div>
  </section><p class="muted purchase-note">Không tính đơn đã hủy hoặc đang chờ thanh toán.</p>`;
  const paging = data.pagination;
  const pager = `<nav class="purchase-pagination" aria-label="Trang lịch sử mua hàng">
    <button class="button secondary" data-orders-offset="${Math.max(0,offset-paging.limit)}" ${offset===0 ? "disabled" : ""}>← Trang trước</button>
    <span>${paging.total ? offset+1 : 0} đến ${offset+serverOrders.length} / ${paging.total} đơn</span>
    <button class="button secondary" data-orders-offset="${offset+paging.limit}" ${paging.hasMore ? "" : "disabled"}>Trang sau →</button>
  </nav>`;

  const accountBarHtml = userEmail
    ? `
    <div class="orders-account-bar">
      <div class="orders-account-info">
        <span class="orders-account-email">👤 ${escapeHtml(userEmail)}</span>
        <span class="orders-account-sub">Tài khoản khách hàng</span>
      </div>
      <button class="orders-logout-btn" data-wallet="logout" type="button" title="Đăng xuất tài khoản">
        <span data-icon="logout"></span> Đăng xuất
      </button>
    </div>
  `
    : "";

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
              <strong>🎁 Link Claim quà tặng / Thông tin nhận hàng của bạn:</strong>
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
              🔑 Đơn Nạp Acc: Shop đang xử lý gói nạp bằng thông tin tài khoản và mã dự phòng bạn đã gửi.
            </div>
          `;
        }

        let boostNotice = "";
        if (order.serverInvite) {
          boostNotice = `
            <div class="order-boost-info" style="margin-top:8px; padding:8px 12px; background:rgba(147, 51, 234, 0.1); border:1px solid rgba(147, 51, 234, 0.3); border-radius:6px; font-size:12px;">
              🚀 <strong>Link Server Discord cần Boost:</strong> <a href="${escapeHtml(order.serverInvite)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent); word-break:break-all;">${escapeHtml(order.serverInvite)}</a>
            </div>
          `;
        }

        let decorSection = "";
        if (order.decorImage) {
          decorSection = `
            <div class="order-decor-info" style="margin-top:8px; padding:8px 12px; background:rgba(59, 130, 246, 0.08); border:1px solid rgba(59, 130, 246, 0.25); border-radius:6px; font-size:12px; display:flex; align-items:center; gap:10px;">
              <a href="${escapeHtml(order.decorImage)}" target="_blank" rel="noopener noreferrer">
                <img src="${escapeHtml(order.decorImage)}" alt="Mẫu Decor" style="width:48px; height:48px; object-fit:cover; border-radius:6px; border:1px solid var(--line); flex-shrink:0;" />
              </a>
              <div>
                <strong>🎨 Ảnh mẫu Decor bạn yêu cầu mua:</strong>
                <div style="margin-top:2px;">
                  <a href="${escapeHtml(order.decorImage)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent); font-size:11px;">Xem ảnh kích thước đầy đủ ↗</a>
                </div>
              </div>
            </div>
          `;
        }

        const itemsHtml = order.items
          .map(
            (item) =>
              `<li>${escapeHtml(item.productName || item.name)}: ${escapeHtml(item.variantName || item.variant)} [${escapeHtml((item.deliveryType || "gift").toUpperCase())}] × ${item.quantity} (${money(item.subtotal || item.price * item.quantity)})</li>`,
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
            ${boostNotice}
            ${decorSection}
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
              <span class="muted" style="font-size:11px;">Thanh toán: Ví VietNam Legacy</span>
              <strong class="order-total" style="color:var(--accent); font-size:15px;">${money(order.total)}</strong>
              ${order.pricing?.coupon ? `<small class="order-discount-note">Mã ${escapeHtml(order.pricing.coupon.code)} · Giảm ${money(order.pricing.couponDiscount)}</small>` : ""}
            </div>
          </article>
        `;
      })
      .join("");

    showInfo("Lịch sử mua hàng", accountBarHtml + purchaseSummary + ordersHtml + pager);
    paintIcons(document.querySelector("#info-content"));
    return;
  }

  showInfo("Lịch sử mua hàng", accountBarHtml + purchaseSummary + '<p class="muted">Chưa có đơn mua hàng nào trong tài khoản này.</p><button class="button secondary" data-close>Khám phá sản phẩm</button>');
  paintIcons(document.querySelector("#info-content"));
}

document.addEventListener("vnl:logout", () => {
  ordersRequest += 1;
  checkoutBalance = null;
  const balanceEl = document.querySelector("#checkout-user-balance");
  if (balanceEl) balanceEl.textContent = "Chưa đăng nhập";
  if (infoDialog && infoDialog.open) {
    infoDialog.close();
  }
  notify("Đã đăng xuất tài khoản thành công.");
});


let cachedGuide = null;
let cachedGuides = [];
let guideStoreFilter = "all";
let guideStoreSearch = "";
let currentGuideDetailId = null;

const guideCategoryLabels = {
  guide: "Hướng dẫn",
  tips: "Mẹo & Thủ thuật",
  news: "Tin tức",
  other: "Khác",
};

async function initHeroGuides() {
  const section = document.querySelector("#hero-guides");
  const grid = document.querySelector("#hero-guides-grid");
  if (!section || !grid) return;

  section.addEventListener("click", (event) => {
    const card = event.target.closest("[data-hero-guide]");
    if (card) void showGuideModal(card.dataset.heroGuide);
  });
  section.addEventListener("error", (event) => {
    const image = event.target;
    if (image.tagName !== "IMG" || image.dataset.fallback) return;
    image.dataset.fallback = "true";
    image.src = "assets/vnl-banner.png";
  }, true);

  try {
    const response = await fetch("/api/guide", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    const published = (Array.isArray(data.guides) ? data.guides : data.guide ? [data.guide] : [])
      .filter(guide => guide && guide.id && guide.isActive !== false);
    if (!published.length) return;
    cachedGuides = published;
    cachedGuide = data.guide || published[0];
    grid.innerHTML = published.slice(0, 4).map(guide => {
      const cover = guide.coverImage || guide.images?.[0] || "assets/vnl-banner.png";
      const category = guideCategoryLabels[guide.category] || "Hướng dẫn";
      return `<button type="button" class="hero-guide-card" data-hero-guide="${escapeHtml(guide.id)}" aria-label="Đọc hướng dẫn: ${escapeHtml(guide.title)}">
        <span class="hero-guide-cover"><img src="${escapeHtml(cover)}" alt="" loading="lazy" /></span>
        <span class="hero-guide-body">
          <span class="hero-guide-category">${escapeHtml(category)}</span>
          <span class="hero-guide-title">${escapeHtml(guide.title)}</span>
          <span class="hero-guide-more">Đọc tiếp →</span>
        </span>
      </button>`;
    }).join("");
    section.hidden = false;
  } catch {
    // Giữ nguyên khu vực giới thiệu nếu chưa tải được hướng dẫn.
  }
}
void initHeroGuides();

function parseGuideVideo(url) {
  if (!url) return null;
  const trimmed = String(url).trim();
  const ytMatch = trimmed.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  );
  if (ytMatch) {
    return {
      type: "youtube",
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`,
      id: ytMatch[1],
    };
  }
  if (/\.(mp4|webm|ogg)($|\?)/i.test(trimmed)) {
    return {
      type: "direct",
      src: trimmed,
    };
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return {
      type: "iframe",
      src: trimmed,
    };
  }
  return null;
}

function renderGuideCardItem(g) {
  const cover = g.coverImage || (g.images && g.images[0]) || "assets/vnl-banner.png";
  const catLabel = guideCategoryLabels[g.category] || g.category || "Hướng dẫn";
  const dateStr = new Date(g.createdAt || g.updatedAt || Date.now()).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `
    <article class="guide-store-card" data-guide-open="${escapeHtml(g.id)}" tabindex="0" role="button" aria-label="Xem chi tiết: ${escapeHtml(g.title)}">
      <div class="guide-store-card-media">
        <img src="${escapeHtml(cover)}" alt="${escapeHtml(g.title)}" loading="lazy" onerror="this.src='assets/vnl-banner.png'" />
        <span class="guide-card-badge badge-${escapeHtml(g.category)}">${escapeHtml(catLabel)}</span>
      </div>
      <div class="guide-store-card-body">
        <div class="guide-store-card-meta">
          <span>📅 ${dateStr}</span>
          <span>👁 ${(g.views || 0).toLocaleString()} lượt xem</span>
        </div>
        <h3 class="guide-store-card-title">${escapeHtml(g.title)}</h3>
        <p class="guide-store-card-excerpt">${escapeHtml(g.subtitle || g.content || "")}</p>
        <div class="guide-store-card-footer">
          <span class="guide-read-more">Đọc tiếp →</span>
        </div>
      </div>
    </article>
  `;
}

function renderGuideGridView() {
  const filtered = cachedGuides.filter(g => {
    if (guideStoreFilter !== "all" && g.category !== guideStoreFilter) return false;
    if (guideStoreSearch) {
      const s = guideStoreSearch.toLowerCase();
      const matchTitle = (g.title || "").toLowerCase().includes(s);
      const matchSubtitle = (g.subtitle || "").toLowerCase().includes(s);
      const matchCategory = (guideCategoryLabels[g.category] || g.category || "").toLowerCase().includes(s);
      const matchContent = (g.content || "").toLowerCase().includes(s);
      if (!matchTitle && !matchSubtitle && !matchCategory && !matchContent) return false;
    }
    return true;
  });

  const cardsHtml = filtered.length
    ? filtered.map(renderGuideCardItem).join("")
    : `
      <div class="guide-empty-grid">
        <span style="font-size: 28px;">🔍</span>
        <p>Không tìm thấy bài viết hoặc hướng dẫn nào phù hợp.</p>
      </div>
    `;

  return `
    <div class="guide-store-top-controls">
      <div class="guide-store-filter-tabs" role="tablist">
        <button type="button" class="guide-store-tab ${guideStoreFilter === 'all' ? 'active' : ''}" data-guide-tab="all">Tất cả (${cachedGuides.length})</button>
        <button type="button" class="guide-store-tab ${guideStoreFilter === 'guide' ? 'active' : ''}" data-guide-tab="guide">Hướng dẫn (${cachedGuides.filter(g => g.category === 'guide').length})</button>
        <button type="button" class="guide-store-tab ${guideStoreFilter === 'tips' ? 'active' : ''}" data-guide-tab="tips">Mẹo & Thủ thuật (${cachedGuides.filter(g => g.category === 'tips').length})</button>
        <button type="button" class="guide-store-tab ${guideStoreFilter === 'news' ? 'active' : ''}" data-guide-tab="news">Tin tức (${cachedGuides.filter(g => g.category === 'news').length})</button>
      </div>
      <div class="guide-store-search-box">
        <span class="search-icon">🔍</span>
        <input type="search" id="guide-store-search-input" placeholder="Tìm kiếm bài viết..." value="${escapeHtml(guideStoreSearch)}" />
      </div>
    </div>
    <div class="guide-cards-grid" id="guide-cards-grid">
      ${cardsHtml}
    </div>
  `;
}

function renderGuideReaderView(guide) {
  const catLabel = guideCategoryLabels[guide.category] || guide.category || "Hướng dẫn";
  const dateStr = new Date(guide.createdAt || guide.updatedAt || Date.now()).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const videoEmbed = parseGuideVideo(guide.videoUrl);
  const images = Array.isArray(guide.images) ? guide.images.filter(Boolean) : [];
  const steps = Array.isArray(guide.steps) ? guide.steps : [];

  let videoHtml = "";
  if (videoEmbed) {
    if (videoEmbed.type === "youtube") {
      videoHtml = `
        <div class="guide-video-wrapper">
          <iframe src="${escapeHtml(videoEmbed.embedUrl)}" title="${escapeHtml(guide.title)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>
        </div>
      `;
    } else if (videoEmbed.type === "direct") {
      videoHtml = `
        <div class="guide-video-wrapper">
          <video src="${escapeHtml(videoEmbed.src)}" controls playsinline preload="metadata"></video>
        </div>
      `;
    } else if (videoEmbed.type === "iframe") {
      videoHtml = `
        <div class="guide-video-wrapper">
          <iframe src="${escapeHtml(videoEmbed.src)}" title="${escapeHtml(guide.title)}" frameborder="0" allowfullscreen loading="lazy"></iframe>
        </div>
      `;
    }
  }

  let imagesHtml = "";
  if (images.length) {
    imagesHtml = `
      <div class="guide-gallery-section">
        <h4 class="guide-section-heading"><span data-icon="sparkles"></span> Hình ảnh minh họa</h4>
        <div class="guide-gallery">
          ${images
            .map(
              (img) => `
            <a class="guide-gallery-item" href="${escapeHtml(img)}" target="_blank" rel="noopener noreferrer" title="Bấm để xem ảnh phóng to">
              <img src="${escapeHtml(img)}" alt="Hình ảnh hướng dẫn" loading="lazy" onerror="this.parentElement.style.display='none'" />
              <span class="guide-gallery-zoom">🔍 Phóng to</span>
            </a>
          `,
            )
            .join("")}
        </div>
      </div>
    `;
  }

  let stepsHtml = "";
  if (steps.length) {
    stepsHtml = `
      <div class="guide-steps-section">
        <h4 class="guide-section-heading"><span data-icon="book"></span> Các bước thực hiện</h4>
        <div class="guide-steps-list">
          ${steps
            .map(
              (s, idx) => `
            <div class="guide-step-card">
              <div class="guide-step-badge">${idx + 1}</div>
              <div class="guide-step-body">
                <h5>${escapeHtml(s.title || `Bước ${idx + 1}`)}</h5>
                <p>${escapeHtml(s.description || "")}</p>
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `;
  }

  let contentHtml = "";
  if (guide.content) {
    contentHtml = `
      <div class="guide-note-box">
        <p>${escapeHtml(guide.content)}</p>
      </div>
    `;
  }

  return `
    <div class="guide-reader-view">
      <button type="button" class="guide-back-button" data-guide-back>
        ← Quay lại danh sách bài viết
      </button>

      <div class="guide-reader-header">
        <div class="guide-reader-meta">
          <span class="guide-card-badge badge-${escapeHtml(guide.category)}">${escapeHtml(catLabel)}</span>
          <span>📅 ${dateStr}</span>
          <span>👁 ${(guide.views || 0).toLocaleString()} lượt xem</span>
        </div>
        <h2 class="guide-reader-title">${escapeHtml(guide.title)}</h2>
        ${guide.subtitle ? `<p class="guide-reader-subtitle">${escapeHtml(guide.subtitle)}</p>` : ""}
      </div>

      ${videoHtml}
      ${stepsHtml}
      ${imagesHtml}
      ${contentHtml}

      <div class="guide-dialog-actions">
        <button class="button secondary" type="button" data-guide-back>
          ← Xem bài viết khác
        </button>
        <a class="button primary" href="${storeConfig.discordUrl}" target="_blank" rel="noopener noreferrer">
          Hỏi shop trên Discord ${icon("arrow")}
        </a>
      </div>
    </div>
  `;
}

async function showGuideModal(targetId = null) {
  const guideDialog = document.querySelector("#guide-dialog");
  const guideBody = document.querySelector("#guide-dialog-body");
  const guideTitle = document.querySelector("#guide-dialog-title");

  if (!guideDialog || !guideBody) {
    showInfo("Hướng dẫn & Tin tức", "<p>Đang tải hướng dẫn...</p>");
    return;
  }

  if (!guideDialog.open) guideDialog.showModal();

  if (!cachedGuides.length) {
    guideBody.innerHTML = `<p class="muted" style="text-align:center; padding: 28px 0;">Đang tải danh sách bài viết & hướng dẫn...</p>`;
    try {
      const res = await fetch("/api/guide");
      if (res.ok) {
        const data = await res.json();
        if (data.guide) cachedGuide = data.guide;
        if (Array.isArray(data.guides) && data.guides.length) cachedGuides = data.guides;
        else if (data.guide) cachedGuides = [data.guide];
      }
    } catch {
      // Offline fallback
    }
  }

  if (!cachedGuides.length) {
    const fallback = cachedGuide || {
      id: "main",
      title: "Hướng dẫn mua hàng tại VietNam Legacy",
      subtitle: "Chọn sản phẩm, nạp tiền vào ví và theo dõi đơn hàng",
      category: "guide",
      coverImage: "assets/vnl-banner.png",
      videoUrl: "",
      images: ["assets/vnl-banner.png"],
      steps: [
        { title: "Bước 1: Chọn sản phẩm & Gói cần mua", description: "Duyệt qua danh mục Discord Nitro, Decor hoặc dịch vụ bạn cần." },
        { title: "Bước 2: Nạp tiền ví qua mã QR ngân hàng", description: "Mở Ví cá nhân tại góc trên trang web, quét mã VietQR tự động." },
        { title: "Bước 3: Đặt đơn và nhận hàng", description: "Bấm 'Mua ngay' hoặc 'Thanh toán' giỏ hàng." },
      ],
      content: "Bạn cần setup server hoặc làm bot Discord riêng? Nhắn shop trên Discord để trao đổi yêu cầu và báo giá.",
      isActive: true,
      views: 1250,
    };
    cachedGuides = [fallback];
    cachedGuide = fallback;
  }

  if (targetId) {
    currentGuideDetailId = targetId;
    const targetGuide = cachedGuides.find(g => g.id === targetId) || cachedGuides[0];
    if (guideTitle) guideTitle.textContent = targetGuide.title || "Hướng dẫn & Tin tức";
    guideBody.innerHTML = renderGuideReaderView(targetGuide);
    fetch(`/api/guide/${encodeURIComponent(targetId)}`)
      .then(r => r.json())
      .then(d => {
        if (d.guide) {
          const idx = cachedGuides.findIndex(g => g.id === targetId);
          if (idx !== -1) cachedGuides[idx] = d.guide;
        }
      })
      .catch(() => {});
  } else {
    currentGuideDetailId = null;
    if (guideTitle) guideTitle.textContent = "Tin Tức & Hướng Dẫn";
    guideBody.innerHTML = renderGuideGridView();
  }
}
window.showGuideModal = showGuideModal;

// Guide Dialog Event Listeners
const guideDialogEl = document.querySelector("#guide-dialog");
if (guideDialogEl) {
  guideDialogEl.addEventListener("click", (e) => {
    const card = e.target.closest("[data-guide-open]");
    if (card) {
      const id = card.dataset.guideOpen;
      if (id) showGuideModal(id);
      return;
    }
    const backBtn = e.target.closest("[data-guide-back]");
    if (backBtn) {
      showGuideModal(null);
      return;
    }
    const tab = e.target.closest("[data-guide-tab]");
    if (tab) {
      guideStoreFilter = tab.dataset.guideTab;
      const body = document.querySelector("#guide-dialog-body");
      if (body) body.innerHTML = renderGuideGridView();
      return;
    }
    const exploreBtn = e.target.closest("[data-guide-explore]");
    if (exploreBtn) {
      guideDialogEl.close();
      smoothScrollTo("#catalog");
    }
  });

  guideDialogEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      const card = e.target.closest("[data-guide-open]");
      if (card) {
        e.preventDefault();
        const id = card.dataset.guideOpen;
        if (id) showGuideModal(id);
      }
    }
  });

  guideDialogEl.addEventListener("input", (e) => {
    if (e.target.id === "guide-store-search-input") {
      guideStoreSearch = e.target.value.trim().toLowerCase();
      const grid = document.querySelector("#guide-cards-grid");
      if (grid) {
        const filtered = cachedGuides.filter(g => {
          if (guideStoreFilter !== "all" && g.category !== guideStoreFilter) return false;
          if (guideStoreSearch) {
            const s = guideStoreSearch;
            const matchTitle = (g.title || "").toLowerCase().includes(s);
            const matchSubtitle = (g.subtitle || "").toLowerCase().includes(s);
            const matchCategory = (guideCategoryLabels[g.category] || g.category || "").toLowerCase().includes(s);
            const matchContent = (g.content || "").toLowerCase().includes(s);
            if (!matchTitle && !matchSubtitle && !matchCategory && !matchContent) return false;
          }
          return true;
        });
        grid.innerHTML = filtered.length
          ? filtered.map(renderGuideCardItem).join("")
          : `<div class="guide-empty-grid"><span style="font-size: 28px;">🔍</span><p>Không tìm thấy bài viết nào phù hợp.</p></div>`;
      }
    }
  });
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
    smoothScrollTo("#catalog");
  }
  if (action === "guide") {
    showGuideModal();
  }
  if (action === "demo" || action === "about") {
    showInfo(
      "Thông tin cửa hàng",
      "<p><strong>VietNam Legacy</strong> bán Nitro, Decor, Boost Server và các gói giải trí, công cụ sáng tạo.</p><p>Bạn có thể thanh toán bằng ví VietNam Legacy và nạp tiền qua mã VietQR ngân hàng. Theo dõi trạng thái đơn và nhận link quà tặng trong mục Đơn hàng của tôi.</p><p>Để hỏi về gói dịch vụ, đơn hàng hoặc bảo hành, hãy nhắn shop trên Discord chính thức.</p>",
    );
  }
}

function closeMenu() {
  const sidebar = document.querySelector("#sidebar");
  if (!sidebar) return;
  const wasOpen = sidebar.classList.contains("open");
  sidebar.classList.remove("open");
  sidebar.inert = window.matchMedia("(max-width: 760px)").matches;
  const pageShell = document.querySelector(".page-shell");
  if (pageShell) pageShell.inert = false;
  const overlay = document.querySelector("#menu-overlay");
  if (overlay) overlay.hidden = true;
  const openBtn = document.querySelector("#open-menu");
  if (openBtn) openBtn.setAttribute("aria-expanded", "false");
  document.body.classList.remove("menu-open");
  if (wasOpen && window.matchMedia("(any-hover: hover)").matches) {
    openBtn?.focus();
  }
}
window.closeMenu = closeMenu;

function openMenu() {
  const sidebar = document.querySelector("#sidebar");
  if (!sidebar) return;
  sidebar.inert = false;
  sidebar.classList.add("open");
  const pageShell = document.querySelector(".page-shell");
  if (pageShell) pageShell.inert = true;
  const overlay = document.querySelector("#menu-overlay");
  if (overlay) overlay.hidden = false;
  const openBtn = document.querySelector("#open-menu");
  if (openBtn) openBtn.setAttribute("aria-expanded", "true");
  document.body.classList.add("menu-open");
  if (window.matchMedia("(any-hover: hover)").matches) {
    document.querySelector("#close-menu")?.focus();
  }
}
window.openMenu = openMenu;

document.addEventListener("click", (event) => {
  const button = event.target.closest("button, a");
  if (!button) return;
  if (button.dataset.ordersOffset !== undefined) {
    void showOrders(Number(button.dataset.ordersOffset));
  }
  if (button.hasAttribute("data-close")) button.closest("dialog")?.close();
  if (button.hasAttribute("data-guide-explore")) {
    document.querySelector("#guide-dialog")?.close();
    smoothScrollTo("#catalog");
  }
  if (button.dataset.detail) {
    event.preventDefault();
    showProduct(button.dataset.detail);
  }
  if (button.dataset.add) {
    event.preventDefault();
    const p = getProduct(button.dataset.add);
    if (!p || p.service) return;
    if (p.variants && p.variants.length > 1) {
      showProduct(p.id, true);
    } else {
      buyNowDirect(p.id, p.variants[0]?.id);
    }
  }
  if (button.dataset.buy) {
    event.preventDefault();
    showProduct(button.dataset.buy, true);
  }
  if (button.dataset.action) handleAction(button.dataset.action);
  if (button.dataset.favorite) {
    const id = button.dataset.favorite;
    const index = state.favorites.indexOf(id);
    if (index === -1) state.favorites.push(id);
    else state.favorites.splice(index, 1);
    saveState();
    renderProducts();
  }
  if (button.dataset.viewMode) {
    state.viewMode = button.dataset.viewMode;
    renderProducts();
  }
  if (button.dataset.category) {
    state.category = button.dataset.category;
    state.favoritesOnly = false;
    renderProducts();
    closeMenu();
    smoothScrollTo("#catalog");
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
  if (button.getAttribute("href") === "#catalog") {
    closeMenu();
  }
  if (button.closest("#sidebar") && button.id !== "close-menu" && window.matchMedia("(max-width: 760px)").matches) {
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

document.querySelector("#open-cart")?.addEventListener("click", () => {
  renderCart();
  cartDialog.showModal();
});
document
  .querySelector("#reset-filters")
  .addEventListener("click", resetFilters);
document.querySelector("#empty-reset").addEventListener("click", resetFilters);

const openMenuBtn = document.querySelector("#open-menu");
const closeMenuBtn = document.querySelector("#close-menu");
const menuOverlay = document.querySelector("#menu-overlay");

if (openMenuBtn) {
  openMenuBtn.addEventListener("click", openMenu);
  openMenuBtn.setAttribute("aria-expanded", "false");
  openMenuBtn.setAttribute("aria-controls", "sidebar");
}

if (closeMenuBtn) {
  closeMenuBtn.addEventListener("click", (e) => {
    e.preventDefault();
    closeMenu();
  });
  closeMenuBtn.addEventListener("touchend", (e) => {
    e.preventDefault();
    closeMenu();
  }, { passive: false });
}

if (menuOverlay) {
  menuOverlay.addEventListener("click", (e) => {
    e.preventDefault();
    closeMenu();
  });
  menuOverlay.addEventListener("touchend", (e) => {
    e.preventDefault();
    closeMenu();
  }, { passive: false });
}

// Click / touch outside sidebar closes drawer on mobile
document.addEventListener("pointerdown", (event) => {
  const sidebar = document.querySelector("#sidebar");
  if (!sidebar || !sidebar.classList.contains("open")) return;
  if (!window.matchMedia("(max-width: 760px)").matches) return;
  if (sidebar.contains(event.target) || openMenuBtn?.contains(event.target)) return;
  closeMenu();
});

// Touch swipe-left to close sidebar
(() => {
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let isSwiping = false;
  const sidebar = document.querySelector("#sidebar");
  if (!sidebar) return;

  function onTouchStart(e) {
    if (!sidebar.classList.contains("open")) return;
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
    isSwiping = true;
  }

  function onTouchEnd(e) {
    if (!isSwiping || !sidebar.classList.contains("open")) return;
    isSwiping = false;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    const duration = Date.now() - touchStartTime;

    if (Math.abs(deltaX) > Math.abs(deltaY) * 1.2 && deltaX < -35) {
      if (deltaX < -60 || (deltaX < -35 && duration < 280)) {
        closeMenu();
      }
    }
  }

  sidebar.addEventListener("touchstart", onTouchStart, { passive: true });
  sidebar.addEventListener("touchend", onTouchEnd, { passive: true });
  menuOverlay?.addEventListener("touchstart", onTouchStart, { passive: true });
  menuOverlay?.addEventListener("touchend", onTouchEnd, { passive: true });
})();

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
    if (checkoutBusy || !checkoutQuote) return;
    const confirmedFingerprint = checkoutQuote.fingerprint;
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

    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const note = String(data.get("note") || "").trim();
    const submitBtn = document.querySelector("#checkout-submit-btn");

    if (!name) {
      form.elements.name?.setCustomValidity("Vui lòng nhập tên người nhận.");
      form.elements.name?.reportValidity();
      return;
    }

    const hasLog = itemsToOrder.some((item) => item.deliveryType === "log");
    const hasBoost = itemsToOrder.some((item) => item.productId === "boost");
    const hasDecor = itemsToOrder.some((item) => isDecorProduct(item.productId));

    const discordAccount = String(data.get("discordAccount") || "").trim();
    const discordPassword = String(data.get("discordPassword") || "").trim();
    const backupCodes = String(data.get("backupCodes") || "").trim();
    const serverInvite = String(data.get("serverInvite") || "").trim();
    const decorImage = String(data.get("decorImage") || "").trim();

    if (hasDecor) {
      if (!decorImage) {
        alert("Vui lòng tải lên ảnh chụp màn hình hoặc nhập link ảnh mẫu Decor bạn cần mua để shop biết và giao đúng mẫu.");
        const textInput = document.querySelector("#checkout-decor-image-input");
        if (textInput) textInput.focus();
        return;
      }
    }

    if (hasBoost) {
      if (!serverInvite) {
        alert("Vui lòng nhập link mời vô thời hạn của server Discord cần Boost.");
        form.elements.serverInvite?.focus();
        return;
      }
      const invitePattern =
        /^(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discord(?:app)?\.com\/invite)\/[a-zA-Z0-9_-]+$/i;
      if (!invitePattern.test(serverInvite)) {
        alert(
          "Link mời server Discord không hợp lệ. Vui lòng cung cấp link mời dạng https://discord.gg/abcxyz hoặc discord.gg/abcxyz",
        );
        form.elements.serverInvite?.focus();
        return;
      }
    }

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

    checkoutBusy = true;
    syncCheckoutControls();
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

      checkoutBalance = session.balance || 0;
      const latestQuote = await requestCheckoutQuote(appliedCoupon);
      if (!latestQuote) throw new Error("Hãy kiểm tra lại giá hoặc mã giảm giá trước khi thanh toán.");
      if (latestQuote.fingerprint !== confirmedFingerprint) throw new Error("Giá hoặc ưu đãi đã thay đổi. Tổng mới đã hiện trên đơn; hãy kiểm tra rồi bấm xác nhận lại.");
      const total = latestQuote.total;

      if ((session.balance || 0) < total) {
        throw new Error(
          `Số dư ví không đủ (hiện có ${moneyText(session.balance || 0)}, đơn cần ${moneyText(total)}). Vui lòng nạp thêm tiền vào ví.`,
        );
      }

      // 2. Submit order to server
      const payload = {
        name,
        email,
        note,
        paymentMethod: "wallet",
        couponCode: appliedCoupon,
        quoteFingerprint: latestQuote.fingerprint,
        items: itemsToOrder.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
        discordAccount: hasLog ? discordAccount : undefined,
        discordPassword: hasLog ? discordPassword : undefined,
        backupCodes: hasLog ? backupCodes : undefined,
        serverInvite: hasBoost ? serverInvite : undefined,
        decorImage: decorImage || undefined,
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
        if (orderRes.status === 409 || orderRes.status === 400) await requestCheckoutQuote(appliedCoupon);
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
      refreshCatalog();
      syncInventoryRealtime();

      // Update wallet balance label in topbar
      const walletLabel = document.querySelector("#wallet-label");
      if (walletLabel && typeof resData.balance === "number") {
        walletLabel.textContent = formatCurrencyNumber(resData.balance);
      }

      showInfo(
        "Đặt hàng thành công!",
        `<div class="success-icon">${icon("check")}</div>
        <p>Mã đơn hàng: <strong>${escapeHtml(resData.order.id)}</strong></p>
        <p>Đã thanh toán: <strong>${money(resData.order.total)}</strong> qua Ví VietNam Legacy.</p>
        ${
          resData.order.decorImage
            ? `<div class="decor-notice" style="margin:10px 0; padding:10px; border-radius:6px; display:flex; align-items:center; gap:10px;">
                <img src="${escapeHtml(resData.order.decorImage)}" alt="Mẫu Decor" style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid rgba(255,255,255,0.2);" />
                <div>
                  🎨 <strong>Mẫu Decor:</strong> Đã lưu ảnh mẫu Decor bạn yêu cầu gửi cho shop.
                </div>
              </div>`
            : ""
        }
        ${
          resData.order.serverInvite
            ? '<div class="boost-notice" style="margin:12px 0; padding:10px; border-radius:6px; background:rgba(147, 51, 234, 0.1); border:1px solid rgba(147, 51, 234, 0.3);">🚀 <strong>Gói Boost Server:</strong> Shop sẽ tham gia server theo link mời bạn cung cấp để thực hiện Boost.</div>'
            : resData.order.hasLogItems
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
      checkoutBusy = false;
      syncCheckoutControls();
      submitBtn.innerHTML = 'Xác nhận thanh toán <span data-icon="arrow"></span>';
      paintIcons();
    }
  });

function initDecorCheckout() {
  const decorFileInput = document.querySelector("#checkout-decor-file");
  const decorImageInput = document.querySelector("#checkout-decor-image-input");
  const decorPreviewWrap = document.querySelector("#checkout-decor-preview-wrap");
  const decorPreviewImg = document.querySelector("#checkout-decor-preview-img");
  const decorRemoveBtn = document.querySelector("#checkout-decor-remove-img");

  if (decorFileInput) {
    decorFileInput.addEventListener("change", () => {
      const file = decorFileInput.files && decorFileInput.files[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        alert("Vui lòng chọn tệp hình ảnh (JPG, PNG, WEBP...)");
        decorFileInput.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const max = 600;
          let { width, height } = img;
          if (width > max || height > max) {
            if (width > height) {
              height = Math.round((height * max) / width);
              width = max;
            } else {
              width = Math.round((width * max) / height);
              height = max;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/webp", 0.82);
          if (decorImageInput) decorImageInput.value = dataUrl;
          if (decorPreviewImg) decorPreviewImg.src = dataUrl;
          if (decorPreviewWrap) decorPreviewWrap.style.display = "flex";
        };
        img.onerror = () => {
          alert("Không thể đọc tệp ảnh. Vui lòng chọn ảnh khác.");
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  if (decorImageInput) {
    decorImageInput.addEventListener("input", () => {
      const val = decorImageInput.value.trim();
      if (val) {
        if (decorPreviewImg) decorPreviewImg.src = val;
        if (decorPreviewWrap) decorPreviewWrap.style.display = "flex";
      } else {
        if (decorPreviewWrap) decorPreviewWrap.style.display = "none";
        if (decorPreviewImg) decorPreviewImg.src = "";
      }
    });
  }

  if (decorRemoveBtn) {
    decorRemoveBtn.addEventListener("click", () => {
      if (decorFileInput) decorFileInput.value = "";
      if (decorImageInput) decorImageInput.value = "";
      if (decorPreviewWrap) decorPreviewWrap.style.display = "none";
      if (decorPreviewImg) decorPreviewImg.src = "";
    });
  }
}
initDecorCheckout();

document
  .querySelector('#checkout-form [name="name"]')
  .addEventListener("input", (event) => {
    event.target.setCustomValidity("");
  });


paintIcons();
updateCounts();
renderProducts();
refreshCatalog();
setInterval(() => { if (!document.hidden) refreshCatalog(); }, 60000);
window.addEventListener("focus", refreshCatalog);

async function syncInventoryRealtime() {
  try {
    const res = await fetch("/api/inventory", { cache: "no-store" });
    if (!res.ok) return;
    const { inventory } = await res.json();
    if (!inventory) return;

    let hasChanged = false;
    products.forEach(p => {
      const inv = inventory[p.id];
      if (inv) {
        if (p.stock !== inv.stock || p.soldCount !== inv.soldCount) {
          p.stock = inv.stock;
          p.soldCount = inv.soldCount;
          hasChanged = true;
          const stockBar = document.querySelector(`[data-product-inventory="${p.id}"]`);
          if (stockBar) {
            const isOutOfStock = !p.service && p.stock <= 0;
            const stockBadge = stockBar.querySelector(".stock-badge");
            if (stockBadge) {
              stockBadge.className = `stock-badge ${isOutOfStock ? 'is-out' : (p.stock <= 5 && !p.service ? 'is-low' : 'in-stock')}`;
            }
            const stockText = stockBar.querySelector(".stock-text");
            if (stockText) {
              stockText.innerHTML = p.service ? "Nhận đơn" : (p.stock > 0 ? `Còn: <strong>${p.stock}</strong>` : "<strong>Hết hàng</strong>");
            }
            const soldText = stockBar.querySelector(".sold-badge");
            if (soldText) {
              soldText.innerHTML = `🔥 Đã bán: <strong>${p.soldCount || 0}</strong>`;
            }
          }
        }
      }
    });

    if (hasChanged && productDialog?.open) {
      const openProdId = document.querySelector(".detail-copy")?.dataset?.product;
      if (openProdId) showProduct(openProdId);
    }
  } catch {}
}

setInterval(() => { if (!document.hidden) syncInventoryRealtime(); }, 15000);
window.addEventListener("focus", syncInventoryRealtime);
closeMenu();
window.matchMedia("(max-width: 760px)").addEventListener("change", closeMenu);


/* Đồng bộ thanh thông báo */
function initAnnouncement() {
  const banner = document.querySelector("#announcement-bar");
  const track = document.querySelector("#announcement-track");
  const contentEl = document.querySelector("#announcement-content");
  const duplicateEl = document.querySelector("#announcement-content-duplicate");
  if (!banner || !track || !contentEl || !duplicateEl) return;

  let requestId = 0;
  let previous = null;
  async function refreshAnnouncement() {
    const current = ++requestId;
    try {
      const response = await fetch("/api/announcement", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      // Một phản hồi cũ không được ghi đè thông báo vừa lưu.
      if (current !== requestId || !data.announcement) return;
      const { content, is_active } = data.announcement;
      const next = JSON.stringify([content, Boolean(is_active)]);
      if (next === previous) return;
      previous = next;
      banner.style.display = is_active && content ? "flex" : "none";
      contentEl.textContent = content || "";
      duplicateEl.textContent = content || "";
      const speed = window.innerWidth < 760 ? 0.32 : 0.24;
      track.style.animationDuration = `${Math.max(20, Math.min(65, (content || "").length * speed))}s`;
      // Chạy lại từ đầu để khách đọc được nội dung mới ngay khi thông báo đổi.
      track.getAnimations?.().forEach(animation => { animation.currentTime = 0; });
    } catch {
      // Mất mạng tạm thời thì giữ nội dung gần nhất, thử lại ở lần đồng bộ tiếp theo.
    }
  }

  if (typeof BroadcastChannel === "function") {
    try {
      const channel = new BroadcastChannel("vnl-announcements");
      channel.addEventListener("message", refreshAnnouncement);
    } catch { /* Trình duyệt không hỗ trợ kênh chung thì dùng sự kiện lưu trữ. */ }
  }
  window.addEventListener("storage", event => {
    if (event.key === "vnl-announcement-updated") refreshAnnouncement();
  });
  window.addEventListener("focus", refreshAnnouncement);
  window.addEventListener("pageshow", refreshAnnouncement);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshAnnouncement();
  });
  setInterval(() => { if (!document.hidden) refreshAnnouncement(); }, 15000);
  refreshAnnouncement();
}


/* Cuộn quán tính và điều hướng */
class SmoothInertiaScroll {
  constructor() {
    this.enabled = false;
    if (window.matchMedia("(hover: none), (pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    this.currentY = window.scrollY;
    this.targetY = window.scrollY;
    this.isScrolling = false;
    this.maxScroll = 0;
    this.rafId = null;
    this.lastTime = 0;

    this.onWheel = this.onWheel.bind(this);
    this.onKey = this.onKey.bind(this);
    this.render = this.render.bind(this);
    this.updateBounds = this.updateBounds.bind(this);

    this.enabled = true;
    this.init();
  }

  updateBounds() {
    this.maxScroll = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight,
    );
  }

  init() {
    this.updateBounds();
    document.documentElement.classList.add("smooth-scroll-active");

    window.addEventListener("resize", this.updateBounds, { passive: true });

    window.addEventListener(
      "scroll",
      () => {
        if (!this.isScrolling) {
          this.currentY = window.scrollY;
          this.targetY = window.scrollY;
        }
      },
      { passive: true },
    );

    window.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("keydown", this.onKey);
  }

  onWheel(e) {
    if (
      document.body.classList.contains("modal-open") ||
      document.querySelector("dialog[open]")
    ) {
      return;
    }

    let el = e.target;
    while (el && el !== document.body && el !== document.documentElement) {
      const style = window.getComputedStyle(el);
      if (
        (style.overflowY === "auto" || style.overflowY === "scroll") &&
        el.scrollHeight > el.clientHeight
      ) {
        const canScrollUp = e.deltaY < 0 && el.scrollTop > 0;
        const canScrollDown =
          e.deltaY > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1;
        if (canScrollUp || canScrollDown) return;
      }
      el = el.parentElement;
    }

    e.preventDefault();
    this.updateBounds();

    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 36;
    else if (e.deltaMode === 2) delta *= window.innerHeight;

    const step = Math.sign(delta) * Math.min(Math.abs(delta) * 1.1, 140);
    this.targetY = Math.max(0, Math.min(this.targetY + step, this.maxScroll));

    if (!this.isScrolling) {
      this.isScrolling = true;
      this.lastTime = performance.now();
      this.rafId = requestAnimationFrame(this.render);
    }
  }

  onKey(e) {
    if (
      document.body.classList.contains("modal-open") ||
      document.querySelector("dialog[open]")
    ) {
      return;
    }
    if (
      ["INPUT", "TEXTAREA", "SELECT"].includes(
        document.activeElement?.tagName,
      )
    ) {
      return;
    }

    let delta = 0;
    if (e.key === "ArrowDown") delta = 90;
    else if (e.key === "ArrowUp") delta = -90;
    else if (e.key === "PageDown" || (e.key === " " && !e.shiftKey))
      delta = window.innerHeight * 0.8;
    else if (e.key === "PageUp" || (e.key === " " && e.shiftKey))
      delta = -window.innerHeight * 0.8;
    else if (e.key === "Home") delta = -this.targetY;
    else if (e.key === "End") delta = this.maxScroll - this.targetY;

    if (delta !== 0) {
      e.preventDefault();
      this.updateBounds();
      this.targetY = Math.max(
        0,
        Math.min(this.targetY + delta, this.maxScroll),
      );
      if (!this.isScrolling) {
        this.isScrolling = true;
        this.lastTime = performance.now();
        this.rafId = requestAnimationFrame(this.render);
      }
    }
  }

  scrollTo(targetY) {
    if (!this.enabled) return;
    this.updateBounds();
    this.targetY = Math.max(0, Math.min(targetY, this.maxScroll));
    if (!this.isScrolling) {
      this.isScrolling = true;
      this.lastTime = performance.now();
      this.rafId = requestAnimationFrame(this.render);
    }
  }

  render(time) {
    if (!this.lastTime) this.lastTime = time;
    const dt = Math.min((time - this.lastTime) / 16.67, 3);
    this.lastTime = time;

    const factor = 1 - Math.pow(1 - 0.088, dt);
    this.currentY += (this.targetY - this.currentY) * factor;

    if (Math.abs(this.targetY - this.currentY) < 0.6) {
      this.currentY = this.targetY;
      window.scrollTo(0, this.currentY);
      this.isScrolling = false;
      this.lastTime = 0;
      return;
    }

    window.scrollTo(0, this.currentY);
    this.rafId = requestAnimationFrame(this.render);
  }
}

function smoothScrollTo(target, offset = 85) {
  let targetY = 0;
  if (typeof target === "number") {
    targetY = target;
  } else if (typeof target === "string") {
    if (target === "#home" || target === "#") {
      targetY = 0;
    } else {
      const el = document.querySelector(target);
      if (!el) return;
      targetY = el.getBoundingClientRect().top + window.scrollY - offset;
    }
  } else if (target instanceof HTMLElement) {
    targetY = target.getBoundingClientRect().top + window.scrollY - offset;
  }

  // Chỉ gọi bộ cuộn khi đã khởi tạo; mobile và giảm chuyển động dùng cuộn chuẩn.
  if (window.__smoothScroll?.enabled) {
    window.__smoothScroll.scrollTo(targetY);
  } else {
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    window.scrollTo({ top: Math.max(0, targetY), behavior });
  }
}

function initScrollFeatures() {
  const scrollTopBtn = document.querySelector("#scroll-top");
  const topbar = document.querySelector(".topbar");

  function onScroll() {
    const y = window.scrollY;
    if (scrollTopBtn) {
      scrollTopBtn.classList.toggle("visible", y > 300);
    }
    if (topbar) {
      topbar.classList.toggle("scrolled", y > 20);
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (scrollTopBtn) {
    scrollTopBtn.addEventListener("click", () => {
      smoothScrollTo(0);
    });
  }

  document.addEventListener("click", (e) => {
    const anchor = e.target.closest('a[href^="#"]');
    if (anchor) {
      const href = anchor.getAttribute("href");
      if (href && href !== "#") {
        const targetEl = document.querySelector(href);
        if (targetEl) {
          e.preventDefault();
          smoothScrollTo(targetEl);
        }
      }
    }
  });
}

function initScrollReveal() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    {
      root: null,
      rootMargin: "0px 0px -30px 0px",
      threshold: 0.05,
    },
  );

  observeScrollReveal();
}

function observeScrollReveal() {
  if (!revealObserver) return;
  const elements = document.querySelectorAll(
    ".section-heading, .catalog-controls, .product-card:not(.revealed), .bottom-banner, footer",
  );
  elements.forEach((el, index) => {
    if (
      !el.classList.contains("scroll-reveal") &&
      !el.classList.contains("revealed")
    ) {
      el.classList.add("scroll-reveal");
      if (el.classList.contains("product-card")) {
        el.style.setProperty("--reveal-index", index % 6);
      }
      revealObserver.observe(el);
    }
  });
}

function renderContactIcon(platform) {
  const p = String(platform || "").toLowerCase();
  if (p === "zalo") {
    return '<span class="contact-icon-glyph zalo" aria-hidden="true">Z</span>';
  }
  if (p === "facebook") {
    return '<span class="contact-icon-glyph facebook" aria-hidden="true">f</span>';
  }
  if (p === "telegram") {
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';
  }
  if (p === "discord") {
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>';
  }
  if (p === "phone") {
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>';
  }
  if (p === "messenger") {
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.91 1.455 5.512 3.735 7.185v3.557l3.418-1.876c.905.251 1.86.387 2.847.387 5.523 0 10-4.145 10-9.253C22 6.145 17.523 2 12 2zm1.004 12.448l-2.56-2.73-5 2.73 5.498-5.836 2.623 2.73 4.939-2.73-5.5 5.836z"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';
}

function getContactBadgeClass(badge) {
  const b = String(badge || "").trim().toUpperCase();
  if (b === "CN") return "badge-cn";
  if (b === "GR") return "badge-gr";
  if (b === "VIP") return "badge-vip";
  if (b === "24/7" || b === "HOT") return "badge-hot";
  return "badge-default";
}

async function initFloatingContacts() {
  const container = document.getElementById("floating-contacts");
  if (!container) return;

  try {
    const res = await fetch("/api/contacts");
    if (!res.ok) return;
    const data = await res.json();
    if (!data.enabled || !Array.isArray(data.items) || data.items.length === 0) {
      container.innerHTML = "";
      return;
    }

    const itemsHtml = data.items
      .map((item) => {
        const badgeClass = getContactBadgeClass(item.badge);
        const badgeHtml = item.badge
          ? `<span class="contact-badge ${badgeClass}">${escapeHtml(item.badge)}</span>`
          : "";
        return `
          <a href="${escapeHtml(item.url)}"
             target="_blank"
             rel="noopener noreferrer"
             class="floating-contact-btn platform-${escapeHtml(item.platform || "other")}"
             aria-label="${escapeHtml(item.name)}">
            <span class="contact-icon">${renderContactIcon(item.platform)}</span>
            ${badgeHtml}
            <span class="contact-tooltip">
              <span class="tooltip-title">${escapeHtml(item.name)}</span>
              <span class="tooltip-sub">Nhấn để kết nối ↗</span>
            </span>
          </a>
        `;
      })
      .join("");

    container.innerHTML = `
      <div class="floating-contacts-dock">
        <div class="floating-dock-badge" title="Đội ngũ hỗ trợ trực tuyến">
          <span class="floating-pulse-dot" aria-hidden="true"></span>
          <span>HỖ TRỢ</span>
        </div>
        <div class="floating-contacts-stack">
          ${itemsHtml}
        </div>
      </div>
    `;
  } catch (err) {
    console.warn("Could not load contact buttons:", err);
  }
}


// Initialize components
initAnnouncement();
window.__smoothScroll = new SmoothInertiaScroll();
initScrollFeatures();
initScrollReveal();
initFloatingContacts();


// Giao diện giá và ưu đãi dùng chung phiên đăng nhập của trang quản trị.
window.initAdminPricing = (() => {
  let api, notify, products = [], promotions = [], currentView = "orders", initialized = false, loaded = false;
  const $ = (selector) => document.querySelector(selector);
  const money = n => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const statuses = { active: "Đang áp dụng", scheduled: "Sắp diễn ra", expired: "Đã kết thúc", disabled: "Đã tắt", exhausted: "Hết lượt dùng" };
  const formatDate = value => value == null ? "Không giới hạn" : new Date(value).toLocaleString("vi-VN");
  const inputDate = value => value == null ? "" : new Date(value - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  async function load() {
    const panel = $("#admin-pricing-view");
    try {
      const data = await api("/api/admin/pricing");
      loaded = true;
      products = data.products;
      promotions = data.promotions;
      render();
    } catch (error) {
      panel.innerHTML = `<p class="admin-error-msg" role="alert">${esc(error.message)}</p><button type="button" class="button secondary" data-pricing-reload>Tải lại dữ liệu</button>`;
    }
  }

  function switchView(view) {
    currentView = view;
    $("#admin-orders-view").hidden = view !== "orders";
    $("#admin-pricing-view").hidden = view === "orders";
    document.querySelectorAll("[data-admin-view]").forEach(button => {
      button.classList.toggle("active", button.dataset.adminView === view);
      button.setAttribute("aria-pressed", String(button.dataset.adminView === view));
    });
    if (view !== "orders") render();
  }

  function render() {
    const panel = $("#admin-pricing-view");
    if (currentView === "orders") return;
    if (!loaded) { panel.innerHTML = '<p class="pricing-hint">Đang tải giá và ưu đãi...</p><button type="button" class="button secondary" data-pricing-reload>Tải lại dữ liệu</button>'; return; }
    if (currentView === "prices") {
      panel.innerHTML = `<header class="pricing-heading"><div><span class="pricing-eyebrow">DANH MỤC CỬA HÀNG</span><h2>Giá sản phẩm</h2><p>Chỉnh giá niêm yết từng gói. Các đợt giảm giá sẽ tự tính trên mức giá này.</p></div></header>
        <form id="admin-prices-form"><div class="price-product-grid">${products.filter(p => !p.service).map(p => `<section class="pricing-card"><h3>${esc(p.name)}</h3>
          ${p.variants.map(v => `<label class="price-variant"><span>${esc(v.name)}<small>Giá đang bán: ${money(v.price)}${v.sale ? " · " + esc(v.sale.name) : ""}</small></span>
            <span class="price-input-wrap"><input type="number" min="0" max="1000000000" step="1" required value="${v.basePrice}" data-price-product="${p.id}" data-price-variant="${v.id}" aria-label="Giá ${esc(p.name + ' ' + v.name)}"><span>₫</span></span></label>`).join("")}</section>`).join("")}</div>
          <div class="pricing-savebar"><p>Giá mới áp dụng cho đơn tạo sau khi lưu. Đơn đã thanh toán giữ nguyên.</p><button class="button primary" type="submit">Lưu bảng giá</button></div>
          <p class="pricing-form-message" role="status"></p></form>`;
      return;
    }
    const coupon = currentView === "coupons", kind = coupon ? "coupon" : "campaign";
    const rows = promotions.filter(p => p.kind === kind);
    panel.innerHTML = `<header class="pricing-heading"><div><span class="pricing-eyebrow">ƯU ĐÃI CỬA HÀNG</span><h2>${coupon ? "Mã giảm giá" : "Đợt giảm giá"}</h2>
      <p>${coupon ? "Tạo mã riêng cho khách, giới hạn lượt dùng và chọn sản phẩm áp dụng." : "Lên lịch ưu đãi tự động. Nếu nhiều đợt trùng nhau, khách nhận mức giảm tốt nhất cho từng gói."}</p></div>
      <button class="button primary" type="button" data-promotion-new="${kind}">${coupon ? "+ Tạo mã giảm giá" : "+ Tạo đợt giảm giá"}</button></header>
      <div id="promotion-editor"></div><div class="promotion-list">${rows.length ? rows.map(p => `<article class="pricing-card promotion-card">
        <div class="promotion-title"><div>${coupon ? `<code>${esc(p.code)}</code>` : ""}<h3>${esc(p.name)}</h3></div><span class="promotion-status is-${p.status}">${statuses[p.status]}</span></div>
        <strong class="promotion-value">Giảm ${p.type === "percent" ? p.value + "%" : money(p.value)} <small>${coupon ? "/ đơn đủ điều kiện" : "/ gói sản phẩm"}</small></strong>
        <p>${p.productIds.length ? p.productIds.map(id => esc(products.find(x => x.id === id)?.name || id)).join(", ") : "Tất cả sản phẩm có giá bán"}</p>
        <dl class="promotion-details"><div><dt>Bắt đầu</dt><dd>${formatDate(p.startsAt)}</dd></div><div><dt>Kết thúc</dt><dd>${formatDate(p.endsAt)}</dd></div>
        ${coupon ? `<div><dt>Lượt đã dùng</dt><dd>${p.used} / ${p.usageLimit ?? "không giới hạn"}</dd></div><div><dt>Mỗi khách</dt><dd>${p.perUserLimit == null ? "Không giới hạn" : p.perUserLimit + " lượt"}</dd></div><div><dt>Đơn tối thiểu</dt><dd>${money(p.minOrder)}</dd></div><div><dt>Giảm tối đa</dt><dd>${p.maxDiscount == null ? "Không giới hạn" : money(p.maxDiscount)}</dd></div><div><dt>Kết hợp đợt giảm giá</dt><dd>${p.stackWithSale ? "Có" : "Không"}</dd></div>` : ""}</dl>
        <div class="pricing-actions"><button class="button secondary btn-small" type="button" data-promotion-edit="${p.id}">Chỉnh sửa</button>
          <button class="button secondary btn-small" type="button" data-promotion-toggle="${p.id}">${p.enabled ? "Tắt ưu đãi" : "Bật ưu đãi"}</button></div></article>`).join("") : `<div class="pricing-empty"><span>${coupon ? "✦" : "◷"}</span><h3>${coupon ? "Chưa có mã giảm giá" : "Chưa có đợt giảm giá"}</h3><p>Tạo ưu đãi đầu tiên khi cửa hàng sẵn sàng.</p></div>`}</div>`;
  }

  function openEditor(kind, id = null) {
    const p = promotions.find(p => p.id === id) || { kind, name: "", code: "", enabled: true, type: "percent", value: 10, productIds: [], minOrder: 0, stackWithSale: true, perUserLimit: 1 };
    const coupon = kind === "coupon";
    $("#promotion-editor").innerHTML = `<form id="promotion-form" class="pricing-card promotion-form" data-id="${id || ""}" data-kind="${kind}">
      <div class="promotion-title"><h3>${id ? "Chỉnh sửa" : "Tạo"} ${coupon ? "mã giảm giá" : "đợt giảm giá"}</h3><button type="button" class="button secondary btn-small" data-promotion-close>Đóng</button></div>
      <div class="pricing-form-grid">
        <label>Tên ưu đãi<input name="name" required maxlength="100" placeholder="Ví dụ: Ưu đãi cuối tuần" value="${esc(p.name)}"></label>
        ${coupon ? `<label>Mã khách nhập<input name="code" required minlength="3" maxlength="32" pattern="[A-Za-z0-9_-]{3,32}" placeholder="Ví dụ: VNL10" value="${esc(p.code)}"></label>` : ""}
        <label>Kiểu giảm<select name="type"><option value="percent" ${p.type === "percent" ? "selected" : ""}>Phần trăm (%)</option><option value="fixed" ${p.type === "fixed" ? "selected" : ""}>Số tiền (VND)</option></select></label>
        <label>Mức giảm<input name="value" type="number" min="1" max="${p.type === 'percent' ? 100 : 1000000000}" step="1" required value="${p.value}"><small>${coupon ? "Giảm trên tổng các sản phẩm đủ điều kiện trong đơn." : "Giảm trên mỗi gói sản phẩm."}</small></label>
        <label>Bắt đầu<input name="startsAt" type="datetime-local" value="${inputDate(p.startsAt)}"><small>Để trống để áp dụng ngay.</small></label>
        <label>Kết thúc<input name="endsAt" type="datetime-local" value="${inputDate(p.endsAt)}"><small>Để trống nếu chưa có ngày kết thúc.</small></label>
        ${coupon ? `<label>Đơn tối thiểu (VND)<input name="minOrder" type="number" min="0" max="1000000000000" step="1" required value="${p.minOrder}"><small>Tính sau các đợt giảm giá sản phẩm.</small></label>
          <label>Giảm tối đa (VND)<input name="maxDiscount" type="number" min="1" max="1000000000" step="1" placeholder="Không giới hạn" value="${p.maxDiscount ?? ''}"></label>
          <label>Tổng lượt sử dụng<input name="usageLimit" type="number" min="1" max="1000000" step="1" placeholder="Không giới hạn" value="${p.usageLimit ?? ''}"></label>
          <label>Lượt dùng mỗi khách<input name="perUserLimit" type="number" min="1" max="1000000" step="1" placeholder="Không giới hạn" value="${p.perUserLimit ?? ''}"></label>` : ""}
      </div>
      <p class="pricing-hint">Thời gian theo thiết bị: ${esc(Intl.DateTimeFormat().resolvedOptions().timeZone)}.</p>
      <fieldset class="promotion-scope"><legend>Sản phẩm áp dụng</legend><p>Không chọn mục nào để áp dụng tất cả sản phẩm có giá bán.</p><div>${products.filter(p => !p.service).map(product => `<label><input type="checkbox" name="productIds" value="${product.id}" ${p.productIds.includes(product.id) ? "checked" : ""}>${esc(product.name)}</label>`).join("")}</div></fieldset>
      <label class="pricing-check"><input name="enabled" type="checkbox" ${p.enabled ? "checked" : ""}>Bật ưu đãi theo lịch đã chọn</label>
      ${coupon ? `<label class="pricing-check"><input name="stackWithSale" type="checkbox" ${p.stackWithSale ? "checked" : ""}>Cho phép kết hợp với đợt giảm giá sản phẩm</label><p class="pricing-hint">Mỗi đơn dùng một mã. Đơn đã hủy sẽ trả lại lượt sử dụng.</p>` : ""}
      <p class="pricing-form-message" role="status"></p><button class="button primary" type="submit">Lưu ${coupon ? "mã giảm giá" : "đợt giảm giá"}</button>
    </form>`;
    $("#promotion-form [name=name]").focus();
  }

  async function submit(event) {
    const form = event.target;
    if (!["admin-prices-form", "promotion-form"].includes(form.id)) return;
    event.preventDefault();
    const button = form.querySelector('[type="submit"]'), message = form.querySelector(".pricing-form-message");
    if (button.disabled) return;
    button.disabled = true;
    message.textContent = "Đang lưu...";
    try {
      if (form.id === "admin-prices-form") {
        const prices = [...form.querySelectorAll("[data-price-product]")].map(input => ({ productId: input.dataset.priceProduct, variantId: input.dataset.priceVariant, price: Number(input.value) }));
        await api("/api/admin/prices", { method: "PUT", body: JSON.stringify({ prices }) });
      } else {
        const data = new FormData(form);
        const optional = name => data.get(name) ? Number(data.get(name)) : null;
        const body = { kind: form.dataset.kind, name: data.get("name"), code: data.get("code"), type: data.get("type"), value: Number(data.get("value")),
          startsAt: data.get("startsAt") ? new Date(data.get("startsAt")).getTime() : null, endsAt: data.get("endsAt") ? new Date(data.get("endsAt")).getTime() : null,
          productIds: data.getAll("productIds"), enabled: data.has("enabled"), stackWithSale: data.has("stackWithSale"),
          minOrder: Number(data.get("minOrder") || 0), maxDiscount: optional("maxDiscount"), usageLimit: optional("usageLimit"), perUserLimit: optional("perUserLimit") };
        await api("/api/admin/promotions" + (form.dataset.id ? "/" + form.dataset.id : ""), { method: form.dataset.id ? "PUT" : "POST", body: JSON.stringify(body) });
      }
      notify("Đã lưu. Giá và ưu đãi đã được cập nhật cho cửa hàng.");
      await load();
    } catch (error) { message.textContent = error.message; }
    finally { button.disabled = false; }
  }

  return async function init(options) {
    ({ api, notify } = options);
    loaded = false;
    if (currentView !== "orders") render();
    if (!initialized) {
      initialized = true;
      document.addEventListener("submit", submit);
      document.addEventListener("change", event => {
        if (event.target.matches('#promotion-form [name="type"]')) $("#promotion-form [name=value]").max = event.target.value === "percent" ? "100" : "1000000000";
      });
      document.addEventListener("click", async event => {
        const button = event.target.closest("button");
        if (!button) return;
        if (button.dataset.adminView) switchView(button.dataset.adminView);
        if (button.hasAttribute("data-pricing-reload")) await load();
        if (button.dataset.promotionNew) openEditor(button.dataset.promotionNew);
        if (button.dataset.promotionEdit) openEditor(promotions.find(p => p.id === button.dataset.promotionEdit).kind, button.dataset.promotionEdit);
        if (button.hasAttribute("data-promotion-close")) $("#promotion-editor").replaceChildren();
        if (button.dataset.promotionToggle) {
          button.disabled = true;
          try {
            const rule = promotions.find(p => p.id === button.dataset.promotionToggle);
            await api("/api/admin/promotions/" + rule.id, { method: "PATCH", body: JSON.stringify({ enabled: !rule.enabled }) });
            await load();
            notify(rule.enabled ? "Đã tắt ưu đãi." : "Đã bật ưu đãi theo lịch.");
          } catch (error) { notify(error.message); }
          finally { button.disabled = false; }
        }
      });
    }
    await load();
  };
})();

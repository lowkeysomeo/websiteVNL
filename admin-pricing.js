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
      panel.innerHTML = `<header class="pricing-heading">
        <div>
          <span class="pricing-eyebrow">DANH MỤC CỬA HÀNG</span>
          <h2>Giá & Mặt hàng</h2>
          <p>Tùy chỉnh danh mục: thêm mới, bỏ bán (ẩn) hoặc chỉnh giá niêm yết từng gói.</p>
        </div>
        <div class="pricing-actions">
          <button type="button" class="button primary" data-product-new>+ Thêm mặt hàng mới</button>
        </div>
      </header>
      <div id="catalog-editor"></div>
      <form id="admin-prices-form">
        <div class="price-product-grid">
          ${products.filter(p => !p.service).map(p => `
            <section class="pricing-card product-manage-card ${p.isActive ? "" : "is-inactive"}">
              <div class="product-card-top">
                <div>
                  <div class="product-title-row">
                    <h3>${esc(p.name)}</h3>
                    ${p.isCustom ? '<span class="status-badge custom">Tự tạo</span>' : ""}
                    ${p.isActive ? '<span class="status-badge active">Đang bán</span>' : '<span class="status-badge disabled">Đã ẩn / Bỏ bán</span>'}
                  </div>
                  <p class="product-desc-snippet">${esc(p.description || "Chưa có mô tả.")}</p>
                </div>
                <div class="product-card-actions">
                  <button type="button" class="button secondary btn-small" data-variant-new="${p.id}">+ Thêm gói</button>
                  <button type="button" class="button secondary btn-small" data-product-toggle="${p.id}">${p.isActive ? "Bỏ bán (Ẩn)" : "Mở bán lại"}</button>
                  ${p.isCustom ? `<button type="button" class="button secondary btn-small btn-danger" data-product-delete="${p.id}" title="Xóa mặt hàng này">Xóa</button>` : ""}
                </div>
              </div>
              <div class="variants-container">
                ${(p.variants || []).length ? p.variants.map(v => `
                  <div class="price-variant ${v.isActive ? "" : "is-inactive"}">
                    <div class="variant-meta">
                      <div class="variant-name-row">
                        <strong>${esc(v.name)}</strong>
                        ${v.isCustom ? '<span class="status-badge custom-sm">Tự tạo</span>' : ""}
                        ${v.isActive ? "" : '<span class="status-badge disabled-sm">Đã ẩn</span>'}
                      </div>
                      <small>Giá đang bán: ${money(v.price)}${v.sale ? " · " + esc(v.sale.name) : ""}${v.note ? " · " + esc(v.note) : ""}</small>
                    </div>
                    <div class="variant-controls">
                      <span class="price-input-wrap">
                        <input type="number" min="0" max="1000000000" step="1" required value="${v.basePrice}" data-price-product="${p.id}" data-price-variant="${v.id}" aria-label="Giá ${esc(p.name + ' ' + v.name)}" ${v.isActive ? "" : "disabled"}>
                        <span>₫</span>
                      </span>
                      <button type="button" class="button secondary btn-xs" data-variant-toggle="${p.id}:${v.id}" title="${v.isActive ? "Bỏ gói này khỏi cửa hàng" : "Mở lại gói này"}">${v.isActive ? "Ẩn" : "Hiện"}</button>
                      ${v.isCustom ? `<button type="button" class="button secondary btn-xs btn-danger" data-variant-delete="${p.id}:${v.id}" title="Xóa gói này">✕</button>` : ""}
                    </div>
                  </div>
                `).join("") : '<p class="empty-variants-hint">Chưa có gói sản phẩm nào. Bấm "+ Thêm gói" để tạo gói đầu tiên.</p>'}
              </div>
            </section>
          `).join("")}
        </div>
        <div class="pricing-savebar">
          <p>Giá mới áp dụng cho đơn tạo sau khi lưu. Đơn đã thanh toán giữ nguyên.</p>
          <button class="button primary" type="submit">Lưu bảng giá</button>
        </div>
        <p class="pricing-form-message" role="status"></p>
      </form>`;
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

  function openProductEditor() {
    $("#catalog-editor").innerHTML = `<form id="product-create-form" class="pricing-card promotion-form">
      <div class="promotion-title"><h3>+ Thêm mặt hàng mới vào cửa hàng</h3><button type="button" class="button secondary btn-small" data-catalog-close>Đóng</button></div>
      <div class="pricing-form-grid">
        <label>Tên mặt hàng *<input name="name" required maxlength="100" placeholder="Ví dụ: Spotify Premium, Canva Pro..."></label>
        <label>Danh mục *<select name="category" required>
          <option value="discord">Discord</option>
          <option value="entertainment" selected>Giải trí & Premium</option>
          <option value="creative">Sáng tạo & Công cụ</option>
          <option value="services">Setup Server & Bot</option>
        </select></label>
        <label>Huy hiệu / Badge (Góc ảnh)<input name="badge" maxlength="50" placeholder="Ví dụ: MUSIC / VIP, DESIGN / PRO..."></label>
        <label>Ảnh minh họa (Icon)<select name="image">
          <option value="assets/nitro.svg">Biểu tượng Nitro (Sấm sét)</option>
          <option value="assets/youtube.svg">Biểu tượng YouTube / Video</option>
          <option value="assets/netflix.svg">Biểu tượng Phim ảnh / Rạp chiếu</option>
          <option value="assets/capcut.svg">Biểu tượng Biên tập / Sáng tạo</option>
          <option value="assets/decor.svg">Biểu tượng Decor / Khung avatar</option>
          <option value="assets/boost.svg">Biểu tượng Boost Server</option>
          <option value="assets/server.svg">Biểu tượng Server Discord</option>
          <option value="assets/bot.svg">Biểu tượng Custom Bot</option>
        </select></label>
        <label style="grid-column: 1 / -1;">Mô tả ngắn *<input name="description" required maxlength="300" placeholder="Mô tả quyền lợi và tính năng của mặt hàng..."></label>
      </div>
      <fieldset class="promotion-scope" style="margin-top: 18px;">
        <legend>Gói bán đầu tiên (Tùy chọn)</legend>
        <div class="pricing-form-grid" style="margin-top: 10px;">
          <label>Tên gói đầu tiên<input name="variantName" placeholder="Ví dụ: 🎁 [Gift] Spotify · 1 tháng"></label>
          <label>Giá niêm yết (VND)<input name="variantPrice" type="number" min="0" max="1000000000" step="1000" placeholder="Ví dụ: 35000"></label>
          <label>Hình thức nhận hàng<select name="deliveryType">
            <option value="gift">🎁 Link quà tặng (Gift)</option>
            <option value="log">🔑 Đăng nhập nạp (Log)</option>
            <option value="service">🛠️ Tư vấn riêng</option>
          </select></label>
          <label>Ghi chú gói<input name="variantNote" placeholder="Ví dụ: Nâng cấp chính chủ email..."></label>
        </div>
      </fieldset>
      <p class="pricing-form-message" role="status"></p>
      <button class="button primary" type="submit">Lưu và tạo mặt hàng</button>
    </form>`;
    $("#product-create-form [name=name]").focus();
  }

  function openVariantEditor(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    $("#catalog-editor").innerHTML = `<form id="variant-create-form" class="pricing-card promotion-form" data-product-id="${productId}">
      <div class="promotion-title"><h3>+ Thêm gói bán cho: ${esc(product.name)}</h3><button type="button" class="button secondary btn-small" data-catalog-close>Đóng</button></div>
      <div class="pricing-form-grid">
        <label>Tên gói *<input name="name" required maxlength="100" placeholder="Ví dụ: 🎁 [Gift] ${esc(product.name)} · 6 tháng"></label>
        <label>Giá niêm yết (VND) *<input name="price" type="number" min="0" max="1000000000" step="1000" required placeholder="Ví dụ: 199000"></label>
        <label>Hình thức nhận hàng<select name="deliveryType">
          <option value="gift">🎁 Link quà tặng (Gift)</option>
          <option value="log">🔑 Đăng nhập nạp (Log)</option>
          <option value="service">🛠️ Tư vấn riêng</option>
        </select></label>
        <label>Ghi chú gói<input name="note" placeholder="Ví dụ: Nhận link claim trực tiếp..."></label>
      </div>
      <p class="pricing-form-message" role="status"></p>
      <button class="button primary" type="submit">Thêm gói này</button>
    </form>`;
    $("#variant-create-form [name=name]").focus();
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
    if (!["admin-prices-form", "promotion-form", "product-create-form", "variant-create-form"].includes(form.id)) return;
    event.preventDefault();
    const button = form.querySelector('[type="submit"]'), message = form.querySelector(".pricing-form-message");
    if (button.disabled) return;
    button.disabled = true;
    message.textContent = "Đang lưu...";
    try {
      if (form.id === "admin-prices-form") {
        const prices = [...form.querySelectorAll("[data-price-product]:not(:disabled)")].map(input => ({ productId: input.dataset.priceProduct, variantId: input.dataset.priceVariant, price: Number(input.value) }));
        await api("/api/admin/prices", { method: "PUT", body: JSON.stringify({ prices }) });
        notify("Đã lưu bảng giá sản phẩm.");
      } else if (form.id === "product-create-form") {
        const data = new FormData(form);
        const name = data.get("name").trim();
        const category = data.get("category");
        const badge = data.get("badge").trim();
        const description = data.get("description").trim();
        const image = data.get("image") || "assets/nitro.svg";
        const variantName = (data.get("variantName") || "").trim();
        const variantPrice = data.get("variantPrice") ? Number(data.get("variantPrice")) : null;
        const deliveryType = data.get("deliveryType") || "gift";
        const variantNote = (data.get("variantNote") || "").trim();
        const variants = variantName && variantPrice !== null ? [{ name: variantName, price: variantPrice, deliveryType, note: variantNote }] : [];
        await api("/api/admin/products", { method: "POST", body: JSON.stringify({ name, category, badge, description, image, variants }) });
        notify("Đã thêm mặt hàng mới.");
        $("#catalog-editor").replaceChildren();
      } else if (form.id === "variant-create-form") {
        const data = new FormData(form);
        const productId = form.dataset.productId;
        const name = data.get("name").trim();
        const price = Number(data.get("price"));
        const deliveryType = data.get("deliveryType") || "gift";
        const note = (data.get("note") || "").trim();
        await api("/api/admin/products/" + productId + "/variants", { method: "POST", body: JSON.stringify({ name, price, deliveryType, note }) });
        notify("Đã thêm gói sản phẩm mới.");
        $("#catalog-editor").replaceChildren();
      } else {
        const data = new FormData(form);
        const optional = name => data.get(name) ? Number(data.get(name)) : null;
        const body = { kind: form.dataset.kind, name: data.get("name"), code: data.get("code"), type: data.get("type"), value: Number(data.get("value")),
          startsAt: data.get("startsAt") ? new Date(data.get("startsAt")).getTime() : null, endsAt: data.get("endsAt") ? new Date(data.get("endsAt")).getTime() : null,
          productIds: data.getAll("productIds"), enabled: data.has("enabled"), stackWithSale: data.has("stackWithSale"),
          minOrder: Number(data.get("minOrder") || 0), maxDiscount: optional("maxDiscount"), usageLimit: optional("usageLimit"), perUserLimit: optional("perUserLimit") };
        await api("/api/admin/promotions" + (form.dataset.id ? "/" + form.dataset.id : ""), { method: form.dataset.id ? "PUT" : "POST", body: JSON.stringify(body) });
        notify("Đã lưu ưu đãi.");
      }
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
        if (button.hasAttribute("data-product-new")) openProductEditor();
        if (button.dataset.variantNew) openVariantEditor(button.dataset.variantNew);
        if (button.hasAttribute("data-catalog-close")) $("#catalog-editor").replaceChildren();
        if (button.dataset.productToggle) {
          button.disabled = true;
          try {
            const product = products.find(p => p.id === button.dataset.productToggle);
            await api("/api/admin/products/" + product.id + "/toggle", { method: "PATCH", body: JSON.stringify({ isActive: !product.isActive }) });
            await load();
            notify(product.isActive ? "Đã ẩn mặt hàng khỏi cửa hàng." : "Đã mở bán lại mặt hàng.");
          } catch (error) { notify(error.message); }
          finally { button.disabled = false; }
        }
        if (button.dataset.productDelete) {
          if (!confirm("Bạn có chắc chắn muốn xóa vĩnh viễn mặt hàng này?")) return;
          button.disabled = true;
          try {
            await api("/api/admin/products/" + button.dataset.productDelete, { method: "DELETE" });
            await load();
            notify("Đã xóa mặt hàng.");
          } catch (error) { notify(error.message); }
          finally { button.disabled = false; }
        }
        if (button.dataset.variantToggle) {
          button.disabled = true;
          try {
            const [pId, vId] = button.dataset.variantToggle.split(":");
            const product = products.find(p => p.id === pId);
            const variant = product?.variants?.find(v => v.id === vId);
            await api("/api/admin/products/" + pId + "/variants/" + vId + "/toggle", { method: "PATCH", body: JSON.stringify({ isActive: !variant.isActive }) });
            await load();
            notify(variant.isActive ? "Đã ẩn gói này khỏi cửa hàng." : "Đã mở lại gói sản phẩm.");
          } catch (error) { notify(error.message); }
          finally { button.disabled = false; }
        }
        if (button.dataset.variantDelete) {
          if (!confirm("Bạn có chắc chắn muốn xóa vĩnh viễn gói này?")) return;
          button.disabled = true;
          try {
            const [pId, vId] = button.dataset.variantDelete.split(":");
            await api("/api/admin/products/" + pId + "/variants/" + vId, { method: "DELETE" });
            await load();
            notify("Đã xóa gói sản phẩm.");
          } catch (error) { notify(error.message); }
          finally { button.disabled = false; }
        }
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

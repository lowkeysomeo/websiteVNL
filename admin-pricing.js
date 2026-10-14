// Giao diện giá, ưu đãi và nạp tiền QR dùng chung phiên đăng nhập của trang quản trị.
window.initAdminPricing = (() => {
  let api, notify, products = [], promotions = [], bankSettings = { bank: {}, isActive: false }, depositsList = [], depositFilter = "all", depositSearch = "", guideData = null, guidesList = [], guideFilter = "all", guideSearch = "", currentView = "orders", initialized = false, loaded = false;
  const guideCategoryLabels = { guide: "Hướng dẫn", tips: "Mẹo & Thủ thuật", news: "Tin tức", other: "Khác" };
  const $ = (selector) => document.querySelector(selector);
  const money = n => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const statuses = { active: "Đang áp dụng", scheduled: "Sắp diễn ra", expired: "Đã kết thúc", disabled: "Đã tắt", exhausted: "Hết lượt dùng" };
  const depositStatusLabels = { pending: "Chờ chuyển khoản", credited: "Đã cộng tiền", review: "Cần đối soát", expired: "Hết hạn / Hủy" };
  const formatDate = value => value == null ? "Không giới hạn" : new Date(value).toLocaleString("vi-VN");
  const inputDate = value => value == null ? "" : new Date(value - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  function parseVideoEmbed(url) {
    if (!url) return null;
    const trimmed = String(url).trim();
    const ytMatch = trimmed.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
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

  function renderVideoPreviewHtml(videoEmbed) {
    if (!videoEmbed) {
      return `<div class="guide-media-empty"><span>📹</span><p>Chưa có video. Dán link YouTube vào ô trên để xem trước tại đây.</p></div>`;
    }
    if (videoEmbed.type === "youtube") {
      return `
        <div class="guide-video-embed-preview">
          <iframe src="${esc(videoEmbed.embedUrl)}" title="Xem trước video hướng dẫn" frameborder="0" allowfullscreen></iframe>
        </div>
        <small class="video-preview-badge">✓ Đã nhận diện video YouTube</small>
      `;
    }
    if (videoEmbed.type === "direct") {
      return `
        <div class="guide-video-embed-preview">
          <video src="${esc(videoEmbed.src)}" controls preload="metadata"></video>
        </div>
        <small class="video-preview-badge">✓ Đã nhận diện video MP4</small>
      `;
    }
    return `
      <div class="guide-video-embed-preview">
        <iframe src="${esc(videoEmbed.src)}" title="Xem trước video hướng dẫn" frameborder="0"></iframe>
      </div>
    `;
  }

  function renderImagesPreviewHtml(images) {
    const valid = (images || []).filter(url => Boolean(url && url.trim()));
    if (!valid.length) {
      return `<div class="guide-media-empty"><span>🖼️</span><p>Chưa có hình ảnh. Nhập link ảnh vào ô trên để xem trước tại đây.</p></div>`;
    }
    return `
      <div class="guide-images-grid-preview">
        ${valid.map(img => `
          <div class="guide-image-preview-item">
            <img src="${esc(img.trim())}" alt="Xem trước ảnh" onerror="this.parentElement.innerHTML='<span class=img-err>Ảnh lỗi</span>'" />
          </div>
        `).join("")}
      </div>
      <small class="image-preview-badge">✓ Hiển thị ${valid.length} hình ảnh</small>
    `;
  }

  const VIETNAM_BANKS = [
    { code: "MB", gateway: "MB Bank", name: "MB Bank (Ngân hàng Quân Đội)" },
    { code: "VCB", gateway: "Vietcombank", name: "Vietcombank (Ngoại Thương Việt Nam)" },
    { code: "TCB", gateway: "Techcombank", name: "Techcombank (Kỹ Thương Việt Nam)" },
    { code: "ICB", gateway: "VietinBank", name: "VietinBank (Công Thương Việt Nam)" },
    { code: "ACB", gateway: "ACB", name: "ACB (Á Châu)" },
    { code: "BIDV", gateway: "BIDV", name: "BIDV (Đầu tư & Phát triển)" },
    { code: "VPB", gateway: "VPBank", name: "VPBank (Việt Nam Thịnh Vượng)" },
    { code: "TPB", gateway: "TPBank", name: "TPBank (Tiên Phong)" },
    { code: "VBA", gateway: "Agribank", name: "Agribank (Nông Nghiệp & PTNT)" },
    { code: "STB", gateway: "Sacombank", name: "Sacombank (Sài Gòn Thương Tín)" },
    { code: "HDB", gateway: "HDBank", name: "HDBank (Phát triển TP.HCM)" },
    { code: "OCB", gateway: "OCB", name: "OCB (Phương Đông)" },
    { code: "MSB", gateway: "MSB", name: "MSB (Hàng Hải Việt Nam)" },
    { code: "SHB", gateway: "SHB", name: "SHB (Sài Gòn - Hà Nội)" },
    { code: "VIB", gateway: "VIB", name: "VIB (Quốc Tế Việt Nam)" },
    { code: "SEAB", gateway: "SeABank", name: "SeABank (Đông Nam Á)" },
    { code: "CAKE", gateway: "Cake by VPBank", name: "Cake by VPBank" },
    { code: "TIMO", gateway: "Timo", name: "Timo by BanViet" },
  ];

  async function load() {
    const panel = $("#admin-pricing-view");
    try {
      const [pricingData, bankData, depositsData, guideRes] = await Promise.all([
        api("/api/admin/pricing"),
        api("/api/admin/bank").catch(() => ({ settings: { bank: {}, isActive: false } })),
        api("/api/admin/deposits?limit=100").catch(() => ({ deposits: [] })),
        api("/api/admin/guide").catch(() => ({ guide: null, guides: [] })),
      ]);
      loaded = true;
      products = pricingData.products;
      promotions = pricingData.promotions;
      bankSettings = bankData.settings || { bank: {}, isActive: false };
      depositsList = depositsData.deposits || [];
      guideData = guideRes.guide || null;
      guidesList = Array.isArray(guideRes.guides) ? guideRes.guides : (guideData ? [guideData] : []);
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
                  <button type="button" class="button secondary btn-small" data-product-edit="${p.id}" title="Chỉnh sửa thông tin mặt hàng">✏️ Sửa</button>
                  <button type="button" class="button secondary btn-small" data-product-toggle="${p.id}">${p.isActive ? "Bỏ bán (Ẩn)" : "Mở bán lại"}</button>
                  <button type="button" class="button secondary btn-small btn-danger" data-product-delete="${p.id}" title="Xóa vĩnh viễn mặt hàng này">✕ Xóa</button>
                </div>
              </div>
              <div class="variants-container">
                ${(p.variants || []).length ? p.variants.map(v => `
                  <div class="price-variant ${v.isActive ? "" : "is-inactive"}">
                    <div class="variant-meta">
                      <div class="variant-name-row">
                        <strong>${esc(v.name)}</strong>
                        ${v.deliveryType === 'log' ? '<span class="status-badge log-sm">🔑 Log</span>' : v.deliveryType === 'service' ? '<span class="status-badge service-sm">🛠️ Service</span>' : '<span class="status-badge gift-sm">🎁 Gift</span>'}
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
                      <button type="button" class="button secondary btn-xs" data-variant-edit="${p.id}:${v.id}" title="Chỉnh sửa chi tiết gói này">✏️ Sửa</button>
                      <button type="button" class="button secondary btn-xs" data-variant-toggle="${p.id}:${v.id}" title="${v.isActive ? "Bỏ gói này khỏi cửa hàng" : "Mở lại gói này"}">${v.isActive ? "Ẩn" : "Hiện"}</button>
                      <button type="button" class="button secondary btn-xs btn-danger" data-variant-delete="${p.id}:${v.id}" title="Xóa vĩnh viễn gói này">✕</button>
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
    if (currentView === "deposits") {
      const filtered = depositsList.filter(d => {
        if (depositFilter !== "all" && d.status !== depositFilter) return false;
        if (depositSearch) {
          const matchCode = d.code.toLowerCase().includes(depositSearch);
          const matchEmail = (d.userEmail || "").toLowerCase().includes(depositSearch);
          if (!matchCode && !matchEmail) return false;
        }
        return true;
      });

      const bank = bankSettings.bank || {};
      const previewQrUrl = (bank.code && bank.accountNumber)
        ? `https://img.vietqr.io/image/${encodeURIComponent(bank.code)}-${encodeURIComponent(bank.accountNumber)}-compact2.png?amount=50000&addInfo=VNLTEST&accountName=${encodeURIComponent(bank.accountName || "")}`
        : "";

      panel.innerHTML = `
        <header class="pricing-heading">
          <div>
            <span class="pricing-eyebrow">THANH TOÁN & VÍ TIỀN</span>
            <h2>Nạp tiền bằng QR Ngân hàng (VietQR)</h2>
            <p>Cài đặt tài khoản ngân hàng nhận tiền, cấp mã VietQR tự động và quản lý duyệt cộng tiền vào ví cho khách hàng.</p>
          </div>
          <div class="pricing-actions">
            <button type="button" class="button secondary" data-deposits-reload>Làm mới ↻</button>
          </div>
        </header>

        <div id="catalog-editor"></div>

        <section class="pricing-card bank-config-card">
          <div class="card-header-row">
            <div>
              <h3>🏦 Thông tin Tài khoản Nhận & Bật/Tắt QR</h3>
              <p>Khách hàng quét mã VietQR trên ứng dụng ngân hàng sẽ tự động điền đúng Số tài khoản, Ngân hàng, Số tiền và Nội dung nạp tiền.</p>
            </div>
            <div class="announcement-toggle-group">
              <label class="switch-label">
                <input type="checkbox" id="bank-active-toggle" ${bankSettings.isActive ? "checked" : ""} aria-label="Bật nạp tiền QR" />
                <span class="switch-slider"></span>
              </label>
              <span id="bank-status-text" class="${bankSettings.isActive ? "status-active" : "status-inactive"}">
                ${bankSettings.isActive ? "Đang bật nạp QR" : "Đang tắt nạp QR"}
              </span>
            </div>
          </div>

          <form id="admin-bank-form" class="bank-form-layout">
            <div class="bank-form-fields">
              <label>
                Chọn nhanh ngân hàng phổ biến
                <select id="bank-preset-select">
                  <option value="">-- Chọn ngân hàng để tự điền mã và tên --</option>
                  ${VIETNAM_BANKS.map(b => `<option value="${b.code}" ${b.code === bank.code ? "selected" : ""}>${esc(b.name)}</option>`).join("")}
                </select>
              </label>

              <div class="pricing-form-grid">
                <label>
                  Mã ngân hàng VietQR (BIN hoặc Code)
                  <input name="bankCode" required placeholder="VD: MB, VCB, TCB, ICB, ACB, 970422..." value="${esc(bank.code || "")}" />
                  <small>Mã chuẩn VietQR của ngân hàng (VD: MB, VCB, TCB, ICB) hoặc mã 6 số BIN.</small>
                </label>
                <label>
                  Tên hiển thị ngân hàng
                  <input name="bankGateway" required placeholder="VD: MB Bank, Vietcombank..." value="${esc(bank.gateway || "")}" />
                  <small>Tên ngân hàng hiển thị cho khách hàng xem khi chọn nạp tiền.</small>
                </label>
              </div>

              <div class="pricing-form-grid">
                <label>
                  Số tài khoản nhận tiền
                  <input name="accountNumber" required pattern="\\d+" placeholder="VD: 0123456789" value="${esc(bank.accountNumber || "")}" />
                  <small>Số tài khoản ngân hàng nhận tiền chuyển khoản (chỉ nhập số).</small>
                </label>
                <label>
                  Tên chủ tài khoản (In hoa không dấu)
                  <input name="accountName" required placeholder="VD: NGUYEN VAN A" value="${esc(bank.accountName || "")}" />
                  <small>Tên người thụ hưởng như trên ứng dụng ngân hàng.</small>
                </label>
              </div>

              <div class="bank-form-footer">
                <p id="bank-form-message" class="pricing-form-message"></p>
                <button type="submit" class="button primary">Lưu cấu hình ngân hàng 💾</button>
              </div>
            </div>

            <div class="bank-qr-preview-box">
              <h4>Xem trước mã QR của shop</h4>
              <p>Mã thử nghiệm mẫu (50.000₫ · VNLTEST)</p>
              ${previewQrUrl ? `
                <div class="preview-qr-wrap">
                  <img src="${esc(previewQrUrl)}" alt="VietQR Preview" width="180" height="230" />
                </div>
                <small class="preview-qr-note">Dùng app ngân hàng quét thử mã này để kiểm tra đúng tên và tài khoản!</small>
              ` : `
                <div class="preview-qr-placeholder">
                  <span>📱</span>
                  <p>Nhập thông tin ngân hàng và bấm "Lưu cấu hình" để hiển thị mã QR tại đây.</p>
                </div>
              `}
            </div>
          </form>
        </section>

        <section class="pricing-card deposit-history-card">
          <div class="deposit-history-top">
            <div>
              <h3>📋 Danh sách Yêu cầu Nạp tiền</h3>
              <p>Theo dõi các giao dịch nạp tiền qua QR. Bấm <strong>"Duyệt cộng tiền"</strong> để xác nhận và cộng ngay số dư vào ví cho khách.</p>
            </div>
          </div>

          <div class="admin-controls deposit-controls">
            <div class="admin-tabs deposit-filter-tabs" role="tablist">
              <button class="admin-tab ${depositFilter === 'all' ? 'active' : ''}" data-deposit-filter="all">Tất cả (${depositsList.length})</button>
              <button class="admin-tab ${depositFilter === 'pending' ? 'active' : ''}" data-deposit-filter="pending">Chờ chuyển (${depositsList.filter(d => d.status === 'pending').length})</button>
              <button class="admin-tab ${depositFilter === 'credited' ? 'active' : ''}" data-deposit-filter="credited">Đã cộng tiền (${depositsList.filter(d => d.status === 'credited').length})</button>
              <button class="admin-tab ${depositFilter === 'review' ? 'active' : ''}" data-deposit-filter="review">Cần đối soát (${depositsList.filter(d => d.status === 'review').length})</button>
              <button class="admin-tab ${depositFilter === 'expired' ? 'active' : ''}" data-deposit-filter="expired">Hết hạn / Hủy (${depositsList.filter(d => d.status === 'expired').length})</button>
            </div>
            <div class="admin-search-group">
              <input type="search" id="deposit-search-input" placeholder="Tìm theo mã nạp (VNL...), email khách..." value="${esc(depositSearch)}" />
            </div>
          </div>

          <div class="deposits-table-wrap" id="deposit-cards-container">
            ${renderDepositCardsHtml(filtered, bank)}
          </div>
        </section>
      `;
      return;
    }
    if (currentView === "guide") {
      const filtered = guidesList.filter(g => {
        if (guideFilter !== "all" && g.category !== guideFilter) return false;
        if (guideSearch) {
          const s = guideSearch.toLowerCase();
          const matchTitle = (g.title || "").toLowerCase().includes(s);
          const matchSubtitle = (g.subtitle || "").toLowerCase().includes(s);
          const matchCategory = (guideCategoryLabels[g.category] || g.category || "").toLowerCase().includes(s);
          if (!matchTitle && !matchSubtitle && !matchCategory) return false;
        }
        return true;
      });

      panel.innerHTML = `
        <header class="pricing-heading">
          <div>
            <span class="pricing-eyebrow">HƯỚNG DẪN & TIN TỨC</span>
            <h2>Quản lý Bài viết & Hướng dẫn</h2>
            <p>Đăng nhiều bài viết hướng dẫn, mẹo sử dụng và tin tức kèm video YouTube/MP4 và các bước chi tiết cho khách hàng.</p>
          </div>
          <div class="pricing-actions">
            <button type="button" class="button primary" data-guide-new>+ Thêm bài viết mới</button>
            <a href="/" target="_blank" class="button secondary" rel="noopener noreferrer">Mở cửa hàng kiểm tra ↗</a>
          </div>
        </header>

        <div id="catalog-editor"></div>

        <div class="admin-controls guide-controls">
          <div class="admin-tabs guide-filter-tabs" role="tablist">
            <button class="admin-tab ${guideFilter === 'all' ? 'active' : ''}" data-guide-filter="all">Tất cả (${guidesList.length})</button>
            <button class="admin-tab ${guideFilter === 'guide' ? 'active' : ''}" data-guide-filter="guide">Hướng dẫn (${guidesList.filter(g => g.category === 'guide').length})</button>
            <button class="admin-tab ${guideFilter === 'tips' ? 'active' : ''}" data-guide-filter="tips">Mẹo & Thủ thuật (${guidesList.filter(g => g.category === 'tips').length})</button>
            <button class="admin-tab ${guideFilter === 'news' ? 'active' : ''}" data-guide-filter="news">Tin tức (${guidesList.filter(g => g.category === 'news').length})</button>
          </div>
          <div class="admin-search-group">
            <input type="search" id="guide-search-input" placeholder="Tìm theo tiêu đề, danh mục..." value="${esc(guideSearch)}" />
          </div>
        </div>

        <div class="guide-admin-cards-list" id="guide-admin-cards-container">
          ${renderAdminGuideCardsHtml(filtered)}
        </div>
      `;
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

  function openProductEditor(productId = null) {
    if (productId) {
      const p = products.find(x => x.id === productId);
      if (!p) return;
      $("#catalog-editor").innerHTML = `<form id="product-edit-form" class="pricing-card promotion-form" data-product-id="${p.id}">
        <div class="promotion-title"><h3>✏️ Chỉnh sửa mặt hàng: ${esc(p.name)}</h3><button type="button" class="button secondary btn-small" data-catalog-close>Đóng</button></div>
        <div class="pricing-form-grid">
          <label>Tên mặt hàng *<input name="name" required maxlength="100" value="${esc(p.name)}"></label>
          <label>Danh mục *<select name="category" required>
            <option value="discord" ${p.category === "discord" ? "selected" : ""}>Discord</option>
            <option value="entertainment" ${p.category === "entertainment" ? "selected" : ""}>Giải trí & Premium</option>
            <option value="creative" ${p.category === "creative" ? "selected" : ""}>Sáng tạo & Công cụ</option>
            <option value="services" ${p.category === "services" ? "selected" : ""}>Setup Server & Bot</option>
          </select></label>
          <label>Huy hiệu / Badge (Góc ảnh)<input name="badge" maxlength="50" placeholder="Ví dụ: DISCORD / NITRO BOOST" value="${esc(p.badge || "")}"></label>
          <label>Ảnh minh họa (Icon)<select name="image">
            <option value="assets/nitro.svg" ${p.image === "assets/nitro.svg" ? "selected" : ""}>Biểu tượng Nitro (Sấm sét)</option>
            <option value="assets/youtube.svg" ${p.image === "assets/youtube.svg" ? "selected" : ""}>Biểu tượng YouTube / Video</option>
            <option value="assets/netflix.svg" ${p.image === "assets/netflix.svg" ? "selected" : ""}>Biểu tượng Phim ảnh / Rạp chiếu</option>
            <option value="assets/capcut.svg" ${p.image === "assets/capcut.svg" ? "selected" : ""}>Biểu tượng Biên tập / Sáng tạo</option>
            <option value="assets/decor.svg" ${p.image === "assets/decor.svg" ? "selected" : ""}>Biểu tượng Decor / Khung avatar</option>
            <option value="assets/boost.svg" ${p.image === "assets/boost.svg" ? "selected" : ""}>Biểu tượng Boost Server</option>
            <option value="assets/server.svg" ${p.image === "assets/server.svg" ? "selected" : ""}>Biểu tượng Server Discord</option>
            <option value="assets/bot.svg" ${p.image === "assets/bot.svg" ? "selected" : ""}>Biểu tượng Custom Bot</option>
          </select></label>
          <label style="grid-column: 1 / -1;">Mô tả ngắn *<input name="description" required maxlength="300" value="${esc(p.description || "")}"></label>
        </div>
        <p class="pricing-form-message" role="status"></p>
        <button class="button primary" type="submit">Lưu thay đổi mặt hàng</button>
      </form>`;
      $("#product-edit-form [name=name]").focus();
      return;
    }

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

  function openVariantEditor(productId, variantId = null) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    if (variantId) {
      const v = product.variants?.find(x => x.id === variantId);
      if (!v) return;
      $("#catalog-editor").innerHTML = `<form id="variant-edit-form" class="pricing-card promotion-form" data-product-id="${productId}" data-variant-id="${variantId}">
        <div class="promotion-title"><h3>✏️ Chỉnh sửa gói: ${esc(v.name)}</h3><button type="button" class="button secondary btn-small" data-catalog-close>Đóng</button></div>
        <div class="pricing-form-grid">
          <label>Tên gói *<input name="name" required maxlength="100" value="${esc(v.name)}"></label>
          <label>Giá niêm yết (VND) *<input name="price" type="number" min="0" max="1000000000" step="1000" required value="${v.basePrice ?? v.price}"></label>
          <label>Hình thức nhận hàng<select name="deliveryType">
            <option value="gift" ${v.deliveryType === "gift" ? "selected" : ""}>🎁 Link quà tặng (Gift)</option>
            <option value="log" ${v.deliveryType === "log" ? "selected" : ""}>🔑 Đăng nhập nạp (Log)</option>
            <option value="service" ${v.deliveryType === "service" ? "selected" : ""}>🛠️ Tư vấn riêng</option>
          </select></label>
          <label>Ghi chú gói<input name="note" placeholder="Ví dụ: Nhận link claim trực tiếp..." value="${esc(v.note || "")}"></label>
        </div>
        <p class="pricing-form-message" role="status"></p>
        <button class="button primary" type="submit">Lưu gói sản phẩm</button>
      </form>`;
      $("#variant-edit-form [name=name]").focus();
      return;
    }

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

  function renderDepositCardsHtml(filtered, bank) {
    if (filtered.length === 0) {
      return '<p class="admin-empty-text">Không có yêu cầu nạp tiền nào phù hợp với bộ lọc.</p>';
    }
    return `
      <div class="deposit-cards-list">
        ${filtered.map(d => {
          const qrUrl = (bank.code && bank.accountNumber)
            ? `https://img.vietqr.io/image/${encodeURIComponent(bank.code)}-${encodeURIComponent(bank.accountNumber)}-compact2.png?amount=${d.amount}&addInfo=${encodeURIComponent(d.code)}&accountName=${encodeURIComponent(bank.accountName || "")}`
            : "";
          return `
            <div class="deposit-item-card status-${esc(d.status)}">
              <div class="deposit-item-main">
                <div class="deposit-item-header">
                  <span class="deposit-code"><code>${esc(d.code)}</code></span>
                  <span class="deposit-badge badge-${esc(d.status)}">${depositStatusLabels[d.status] || d.status}</span>
                  <span class="deposit-date">${new Date(d.createdAt).toLocaleString("vi-VN")}</span>
                </div>
                <div class="deposit-item-details">
                  <div class="deposit-user">
                    <small>Khách hàng:</small>
                    <strong>${esc(d.userEmail)}</strong>
                  </div>
                  <div class="deposit-amount">
                    <small>Số tiền nạp:</small>
                    <strong class="amount-val">${money(d.amount)}</strong>
                  </div>
                  ${d.creditedAt ? `
                    <div class="deposit-credited">
                      <small>Đã cộng lúc:</small>
                      <span>${new Date(d.creditedAt).toLocaleString("vi-VN")}</span>
                    </div>
                  ` : `
                    <div class="deposit-expires">
                      <small>Hết hạn lúc:</small>
                      <span>${new Date(d.expiresAt).toLocaleString("vi-VN")}</span>
                    </div>
                  `}
                </div>
              </div>
              <div class="deposit-item-actions">
                ${(d.status === "pending" || d.status === "review") ? `
                  <button type="button" class="button primary btn-small btn-credit" data-deposit-credit="${esc(d.id)}" data-deposit-code="${esc(d.code)}" data-deposit-amount="${d.amount}">
                    ✓ Duyệt cộng tiền
                  </button>
                  <button type="button" class="button secondary btn-small btn-danger" data-deposit-cancel="${esc(d.id)}">
                    ✕ Hủy
                  </button>
                ` : ""}
                ${qrUrl ? `
                  <button type="button" class="button secondary btn-small" data-deposit-qr="${esc(d.id)}" data-qr-url="${esc(qrUrl)}" data-qr-code="${esc(d.code)}" data-qr-amount="${d.amount}">
                    Xem QR ↗
                  </button>
                ` : ""}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function openQrModal(qrUrl, code, amount) {
    const editor = $("#catalog-editor");
    if (!editor) return;
    editor.innerHTML = `
      <div class="admin-modal-overlay">
        <div class="admin-modal-box">
          <div class="admin-modal-header">
            <h3>Mã VietQR: <code>${esc(code)}</code></h3>
            <button type="button" class="button secondary btn-small" data-modal-close>Đóng ✕</button>
          </div>
          <div class="admin-modal-body">
            <div class="preview-qr-wrap" style="display:block; margin: 0 auto; text-align: center;">
              <img src="${esc(qrUrl)}" alt="VietQR" width="220" height="280" style="margin: 0 auto; display: block;" />
            </div>
            <p style="text-align: center; margin-top: 14px; font-size: 13px; color: var(--text);">
              Số tiền: <strong style="color: var(--accent); font-size: 16px;">${money(amount)}</strong><br>
              Nội dung chuyển khoản: <code style="font-size: 15px;">${esc(code)}</code>
            </p>
          </div>
        </div>
      </div>
    `;
  }

  function renderAdminGuideCardsHtml(list) {
    if (!list.length) {
      return `
        <div class="pricing-empty">
          <span>📚</span>
          <h3>Không tìm thấy bài viết nào</h3>
          <p>Bấm "+ Thêm bài viết mới" để tạo bài viết đầu tiên cho cửa hàng.</p>
          <button type="button" class="button primary btn-small" data-guide-new>+ Thêm bài viết mới</button>
        </div>
      `;
    }
    return `
      <div class="guide-admin-grid">
        ${list.map(g => {
          const cover = g.coverImage || (g.images && g.images[0]) || "assets/vnl-banner.png";
          const catLabel = guideCategoryLabels[g.category] || g.category || "Hướng dẫn";
          return `
            <article class="pricing-card guide-admin-card ${g.isActive ? '' : 'is-inactive'}">
              <div class="guide-admin-thumb-wrap">
                <img src="${esc(cover)}" alt="" onerror="this.src='assets/vnl-banner.png'" />
                <span class="guide-badge-category category-${esc(g.category)}">${esc(catLabel)}</span>
                <span class="guide-badge-status ${g.isActive ? 'status-active' : 'status-inactive'}">
                  ${g.isActive ? '● Hiển thị' : '○ Tạm ẩn'}
                </span>
              </div>
              <div class="guide-admin-body">
                <div class="guide-admin-meta">
                  <span>📅 ${new Date(g.createdAt || g.updatedAt).toLocaleDateString("vi-VN")}</span>
                  <span>👁 ${g.views || 0} lượt xem</span>
                </div>
                <h3 class="guide-admin-title" title="${esc(g.title)}">${esc(g.title)}</h3>
                <p class="guide-admin-subtitle">${esc(g.subtitle || '')}</p>
                <div class="guide-admin-extras">
                  ${g.videoUrl ? '<span class="extra-badge">🎬 Video</span>' : ''}
                  ${(g.steps && g.steps.length) ? `<span class="extra-badge">📋 ${g.steps.length} bước</span>` : ''}
                  ${(g.images && g.images.length) ? `<span class="extra-badge">🖼️ ${g.images.length} ảnh</span>` : ''}
                </div>
              </div>
              <div class="guide-admin-actions">
                <button type="button" class="button secondary btn-small" data-guide-edit="${esc(g.id)}">✏️ Sửa</button>
                <button type="button" class="button secondary btn-small" data-guide-toggle="${esc(g.id)}">${g.isActive ? 'Ẩn' : 'Hiện'}</button>
                <button type="button" class="button secondary btn-small btn-danger" data-guide-delete="${esc(g.id)}" title="Xóa bài viết">✕ Xóa</button>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    `;
  }

  function openGuideEditor(guideId = null) {
    const editor = $("#catalog-editor");
    if (!editor) return;
    const g = guideId ? (guidesList.find(x => x.id === guideId) || guideData) : null;
    const isNew = !g;

    const title = g ? g.title : "";
    const subtitle = g ? (g.subtitle || "") : "";
    const category = g ? (g.category || "guide") : "guide";
    const coverImage = g ? (g.coverImage || "") : "";
    const videoUrl = g ? (g.videoUrl || "") : "";
    const imagesList = g && Array.isArray(g.images) ? g.images : [];
    const stepsList = g && Array.isArray(g.steps) && g.steps.length ? g.steps : [
      { title: "Bước 1: ", description: "" },
    ];
    const content = g ? (g.content || "") : "";
    const isActive = g ? Boolean(g.isActive) : true;
    const videoEmbed = parseVideoEmbed(videoUrl);

    editor.innerHTML = `
      <form id="admin-guide-form" class="pricing-card promotion-form guide-modal-form" data-guide-id="${isNew ? 'new' : esc(g.id)}">
        <div class="promotion-title">
          <h3>${isNew ? '+ Thêm bài viết hướng dẫn / tin tức mới' : '✏️ Chỉnh sửa bài viết: ' + esc(title)}</h3>
          <button type="button" class="button secondary btn-small" data-catalog-close>Đóng ✕</button>
        </div>

        <div class="pricing-form-grid">
          <label style="grid-column: 1 / -1;">
            Tiêu đề bài viết *
            <input name="title" required maxlength="200" value="${esc(title)}" placeholder="VD: Hướng dẫn mua hàng tại VietNam Legacy..." />
          </label>

          <label>
            Danh mục bài viết *
            <select name="category" required>
              <option value="guide" ${category === "guide" ? "selected" : ""}>📘 Hướng dẫn</option>
              <option value="tips" ${category === "tips" ? "selected" : ""}>💡 Mẹo & Thủ thuật</option>
              <option value="news" ${category === "news" ? "selected" : ""}>📢 Tin tức</option>
              <option value="other" ${category === "other" ? "selected" : ""}>✨ Khác</option>
            </select>
          </label>

          <label>
            Ảnh bìa (Cover Image URL)
            <input name="coverImage" value="${esc(coverImage)}" placeholder="VD: assets/vnl-banner.png hoặc link ảnh..." />
          </label>

          <label style="grid-column: 1 / -1;">
            Tóm tắt ngắn (Subtitle / Excerpt)
            <input name="subtitle" maxlength="300" value="${esc(subtitle)}" placeholder="VD: Đơn giản · Nhanh chóng · Nhận hàng tự động & Hỗ trợ 24/7..." />
          </label>
        </div>

        <div class="guide-media-section" style="margin-top: 14px;">
          <div class="guide-media-col">
            <label>
              🎬 Link Video (YouTube / MP4)
              <input id="guide-video-input" name="videoUrl" value="${esc(videoUrl)}" placeholder="VD: https://www.youtube.com/watch?v=... hoặc .mp4" />
              <small>Dán link YouTube (hoặc MP4). Hệ thống tự nhận diện phát video.</small>
            </label>
            <div class="guide-preview-video-box" id="guide-preview-video-box">
              ${renderVideoPreviewHtml(videoEmbed)}
            </div>
          </div>

          <div class="guide-media-col">
            <label>
              🖼️ Link Hình ảnh minh họa (Mỗi dòng 1 link)
              <textarea id="guide-images-input" name="images" rows="4" placeholder="VD:&#10;assets/vnl-banner.png&#10;https://i.imgur.com/example.png">${esc(imagesList.join("\n"))}</textarea>
              <small>Hình ảnh minh họa từng bước hoặc banner.</small>
            </label>
            <div class="guide-preview-images-box" id="guide-preview-images-box">
              ${renderImagesPreviewHtml(imagesList)}
            </div>
          </div>
        </div>

        <fieldset class="guide-steps-fieldset" style="margin-top: 14px;">
          <legend>📋 Các bước thực hiện</legend>
          <p class="fieldset-desc">Tạo các bước rõ ràng giúp khách dễ dàng làm theo.</p>
          <div id="guide-steps-container" class="guide-steps-container">
            ${stepsList.map((step, idx) => `
              <div class="guide-step-editor-row" data-step-index="${idx}">
                <span class="step-num-badge">${idx + 1}</span>
                <div class="step-fields">
                  <input name="stepTitle[]" required placeholder="Tên bước (VD: Bước ${idx + 1}: Chọn gói sản phẩm)" value="${esc(step.title)}" />
                  <textarea name="stepDesc[]" rows="2" placeholder="Chi tiết bước này...">${esc(step.description)}</textarea>
                </div>
                <button type="button" class="button secondary btn-small btn-danger" data-remove-step title="Xóa bước này">✕</button>
              </div>
            `).join("")}
          </div>
          <div class="guide-steps-actions">
            <button type="button" class="button secondary btn-small" id="btn-add-guide-step">+ Thêm bước tiếp theo</button>
          </div>
        </fieldset>

        <div class="guide-notes-section" style="margin-top: 14px;">
          <label>
            💬 Nội dung chi tiết hoặc Lời dặn hỗ trợ
            <textarea name="content" rows="4" placeholder="Nội dung chi tiết bài viết, lưu ý bảo hành hoặc thông tin liên hệ...">${esc(content)}</textarea>
          </label>
        </div>

        <div style="display:flex; align-items:center; gap: 12px; margin: 16px 0;">
          <label class="switch-label">
            <input type="checkbox" name="isActive" id="admin-guide-active" ${isActive ? "checked" : ""} />
            <span class="switch-slider"></span>
          </label>
          <span id="admin-guide-active-label" class="${isActive ? "status-active" : "status-inactive"}">
            ${isActive ? "Đang bật hiển thị trên cửa hàng" : "Tạm ẩn (Khách không thấy)"}
          </span>
        </div>

        <div class="guide-form-footer">
          <p class="pricing-form-message" role="status"></p>
          <button type="submit" class="button primary">${isNew ? 'Đăng bài viết mới 💾' : 'Lưu thay đổi bài viết 💾'}</button>
        </div>
      </form>
    `;
    $("#admin-guide-form [name=title]").focus();
  }

  async function submit(event) {
    const form = event.target;
    if (!["admin-prices-form", "promotion-form", "product-create-form", "product-edit-form", "variant-create-form", "variant-edit-form", "admin-bank-form", "admin-guide-form"].includes(form.id)) return;
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
      } else if (form.id === "admin-guide-form") {
        const data = new FormData(form);
        const guideId = form.dataset.guideId || "new";
        const title = (data.get("title") || "").trim();
        const category = data.get("category") || "guide";
        const coverImage = (data.get("coverImage") || "").trim();
        const subtitle = (data.get("subtitle") || "").trim();
        const videoUrl = (data.get("videoUrl") || "").trim();
        const content = (data.get("content") || "").trim();
        const isActive = form.querySelector("[name='isActive']") ? form.querySelector("[name='isActive']").checked : true;
        const imagesRaw = data.get("images") || "";
        const images = imagesRaw.split("\n").map(s => s.trim()).filter(Boolean);
        const stepTitleEls = form.querySelectorAll("[name='stepTitle[]']");
        const stepDescEls = form.querySelectorAll("[name='stepDesc[]']");
        const steps = [];
        for (let i = 0; i < stepTitleEls.length; i++) {
          const st = (stepTitleEls[i].value || "").trim();
          const sd = (stepDescEls[i].value || "").trim();
          if (st || sd) steps.push({ title: st, description: sd });
        }
        const payload = {
          id: guideId,
          title,
          category,
          coverImage,
          subtitle,
          videoUrl,
          images,
          steps,
          content,
          isActive,
        };
        const url = (guideId && guideId !== "new") ? `/api/admin/guide/${guideId}` : "/api/admin/guide";
        const method = (guideId && guideId !== "new") ? "PUT" : "POST";
        const res = await api(url, {
          method,
          body: JSON.stringify(payload),
        });
        guideData = res.guide;
        notify(guideId === "new" ? "Đã đăng bài viết mới thành công!" : "Đã lưu cập nhật bài viết!");
        $("#catalog-editor").replaceChildren();
      } else if (form.id === "admin-bank-form") {
        const data = new FormData(form);
        const isActive = $("#bank-active-toggle") ? $("#bank-active-toggle").checked : true;
        const bankCode = (data.get("bankCode") || "").trim().toUpperCase();
        const bankGateway = (data.get("bankGateway") || "").trim();
        const accountNumber = (data.get("accountNumber") || "").trim().replace(/\s+/g, "");
        const accountName = (data.get("accountName") || "").trim().toUpperCase();

        const res = await api("/api/admin/bank", {
          method: "PUT",
          body: JSON.stringify({ bankCode, bankGateway, accountNumber, accountName, isActive }),
        });
        bankSettings = res.settings;
        notify(isActive ? "Đã lưu thông tin ngân hàng và bật nạp QR." : "Đã lưu thông tin ngân hàng (đang tắt nạp QR).");
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
      } else if (form.id === "product-edit-form") {
        const data = new FormData(form);
        const productId = form.dataset.productId;
        const name = data.get("name").trim();
        const category = data.get("category");
        const badge = data.get("badge").trim();
        const description = data.get("description").trim();
        const image = data.get("image") || "assets/nitro.svg";
        await api("/api/admin/products/" + productId, {
          method: "PUT",
          body: JSON.stringify({ name, category, badge, description, image }),
        });
        notify("Đã cập nhật thông tin mặt hàng.");
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
      } else if (form.id === "variant-edit-form") {
        const data = new FormData(form);
        const productId = form.dataset.productId;
        const variantId = form.dataset.variantId;
        const name = data.get("name").trim();
        const price = Number(data.get("price"));
        const deliveryType = data.get("deliveryType") || "gift";
        const note = (data.get("note") || "").trim();
        await api("/api/admin/products/" + productId + "/variants/" + variantId, {
          method: "PUT",
          body: JSON.stringify({ name, price, deliveryType, note }),
        });
        notify("Đã cập nhật gói sản phẩm.");
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
        if (event.target.id === "bank-preset-select") {
          const selected = VIETNAM_BANKS.find(b => b.code === event.target.value);
          if (selected) {
            const codeInput = document.querySelector('#admin-bank-form [name="bankCode"]');
            const nameInput = document.querySelector('#admin-bank-form [name="bankGateway"]');
            if (codeInput) codeInput.value = selected.code;
            if (nameInput) nameInput.value = selected.gateway;
          }
        }
        if (event.target.id === "bank-active-toggle") {
          const statusText = document.querySelector("#bank-status-text");
          if (statusText) {
            statusText.textContent = event.target.checked ? "Đang bật nạp QR" : "Đang tắt nạp QR";
            statusText.className = event.target.checked ? "status-active" : "status-inactive";
          }
        }
        if (event.target.id === "admin-guide-active") {
          const statusText = document.querySelector("#admin-guide-active-label");
          if (statusText) {
            statusText.textContent = event.target.checked ? "Đang bật hiển thị" : "Tạm ẩn";
            statusText.className = event.target.checked ? "status-active" : "status-inactive";
          }
        }
      });
      document.addEventListener("input", event => {
        if (event.target.id === "guide-video-input") {
          const box = document.querySelector("#guide-preview-video-box");
          if (box) {
            const embed = parseVideoEmbed(event.target.value);
            box.innerHTML = renderVideoPreviewHtml(embed);
          }
        }
        if (event.target.id === "guide-images-input") {
          const box = document.querySelector("#guide-preview-images-box");
          if (box) {
            const imgs = event.target.value.split("\n").map(s => s.trim()).filter(Boolean);
            box.innerHTML = renderImagesPreviewHtml(imgs);
          }
        }
        if (event.target.id === "deposit-search-input") {
          depositSearch = event.target.value.trim().toLowerCase();
          const container = document.querySelector("#deposit-cards-container");
          if (container) {
            const filtered = depositsList.filter(d => {
              if (depositFilter !== "all" && d.status !== depositFilter) return false;
              if (depositSearch) {
                const matchCode = d.code.toLowerCase().includes(depositSearch);
                const matchEmail = (d.userEmail || "").toLowerCase().includes(depositSearch);
                if (!matchCode && !matchEmail) return false;
              }
              return true;
            });
            container.innerHTML = renderDepositCardsHtml(filtered, bankSettings.bank || {});
          }
        }
        if (event.target.id === "guide-search-input") {
          guideSearch = event.target.value.trim().toLowerCase();
          const container = document.querySelector("#guide-admin-cards-container");
          if (container) {
            const filtered = guidesList.filter(g => {
              if (guideFilter !== "all" && g.category !== guideFilter) return false;
              if (guideSearch) {
                const s = guideSearch;
                const matchTitle = (g.title || "").toLowerCase().includes(s);
                const matchSubtitle = (g.subtitle || "").toLowerCase().includes(s);
                const matchCategory = (guideCategoryLabels[g.category] || g.category || "").toLowerCase().includes(s);
                if (!matchTitle && !matchSubtitle && !matchCategory) return false;
              }
              return true;
            });
            container.innerHTML = renderAdminGuideCardsHtml(filtered);
          }
        }
      });
      document.addEventListener("click", async event => {
        const button = event.target.closest("button");
        if (!button) return;
        if (button.hasAttribute("data-guide-new")) openGuideEditor(null);
        if (button.dataset.guideEdit) openGuideEditor(button.dataset.guideEdit);
        if (button.dataset.guideFilter) {
          guideFilter = button.dataset.guideFilter;
          render();
        }
        if (button.dataset.guideToggle) {
          const gId = button.dataset.guideToggle;
          const target = guidesList.find(x => x.id === gId);
          if (!target) return;
          button.disabled = true;
          try {
            await api(`/api/admin/guide/${gId}/toggle`, {
              method: "PATCH",
              body: JSON.stringify({ isActive: !target.isActive }),
            });
            notify(target.isActive ? "Đã ẩn bài viết khỏi cửa hàng." : "Đã bật hiển thị bài viết.");
            await load();
          } catch (err) {
            notify(err.message);
          } finally {
            button.disabled = false;
          }
        }
        if (button.dataset.guideDelete) {
          const gId = button.dataset.guideDelete;
          if (!confirm("Bạn có chắc chắn muốn xóa bài viết này?")) return;
          button.disabled = true;
          try {
            await api(`/api/admin/guide/${gId}`, { method: "DELETE" });
            notify("Đã xóa bài viết.");
            await load();
          } catch (err) {
            notify(err.message);
          } finally {
            button.disabled = false;
          }
        }
        if (button.id === "btn-add-guide-step") {
          const container = document.querySelector("#guide-steps-container");
          if (container) {
            const nextIdx = container.querySelectorAll(".guide-step-editor-row").length;
            const row = document.createElement("div");
            row.className = "guide-step-editor-row";
            row.dataset.stepIndex = nextIdx;
            row.innerHTML = `
              <span class="step-num-badge">${nextIdx + 1}</span>
              <div class="step-fields">
                <input name="stepTitle[]" required placeholder="Tên bước (VD: Bước ${nextIdx + 1}: ...)" value="Bước ${nextIdx + 1}: " />
                <textarea name="stepDesc[]" rows="2" placeholder="Chi tiết bước này..."></textarea>
              </div>
              <button type="button" class="button secondary btn-small btn-danger" data-remove-step title="Xóa bước này">✕</button>
            `;
            container.appendChild(row);
            row.querySelector("input").focus();
          }
        }
        if (button.hasAttribute("data-remove-step")) {
          const row = button.closest(".guide-step-editor-row");
          if (row) {
            const container = document.querySelector("#guide-steps-container");
            row.remove();
            if (container) {
              container.querySelectorAll(".guide-step-editor-row").forEach((r, idx) => {
                r.dataset.stepIndex = idx;
                const badge = r.querySelector(".step-num-badge");
                if (badge) badge.textContent = idx + 1;
              });
            }
          }
        }
        if (button.dataset.adminView) switchView(button.dataset.adminView);
        if (button.hasAttribute("data-pricing-reload")) await load();
        if (button.hasAttribute("data-deposits-reload")) await load();
        if (button.dataset.depositFilter) {
          depositFilter = button.dataset.depositFilter;
          render();
        }
        if (button.dataset.depositCredit) {
          const dId = button.dataset.depositCredit;
          const dCode = button.dataset.depositCode;
          const dAmount = Number(button.dataset.depositAmount);
          if (!confirm(`Xác nhận đã nhận đủ ${money(dAmount)} cho mã ${dCode}?\nTiền sẽ được cộng ngay lập tức vào ví của khách hàng.`)) return;
          button.disabled = true;
          try {
            await api(`/api/admin/deposits/${dId}/credit`, { method: "POST" });
            notify(`Đã duyệt và cộng ${money(dAmount)} vào ví thành công!`);
            await load();
          } catch (err) {
            notify(err.message);
          } finally {
            button.disabled = false;
          }
        }
        if (button.dataset.depositCancel) {
          const dId = button.dataset.depositCancel;
          if (!confirm("Bạn có chắc chắn muốn hủy yêu cầu nạp này?")) return;
          button.disabled = true;
          try {
            await api(`/api/admin/deposits/${dId}/cancel`, { method: "POST" });
            notify("Đã hủy yêu cầu nạp.");
            await load();
          } catch (err) {
            notify(err.message);
          } finally {
            button.disabled = false;
          }
        }
        if (button.dataset.depositQr) {
          openQrModal(button.dataset.qrUrl, button.dataset.qrCode, Number(button.dataset.qrAmount));
        }
        if (button.hasAttribute("data-modal-close")) {
          $("#catalog-editor").replaceChildren();
        }
        if (button.hasAttribute("data-product-new")) openProductEditor();
        if (button.dataset.productEdit) openProductEditor(button.dataset.productEdit);
        if (button.dataset.variantNew) openVariantEditor(button.dataset.variantNew);
        if (button.dataset.variantEdit) {
          const [pId, vId] = button.dataset.variantEdit.split(":");
          openVariantEditor(pId, vId);
        }
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

// Giao diện giá, ưu đãi và nạp tiền QR dùng chung phiên đăng nhập của trang quản trị.
window.initAdminPricing = (() => {
  let api, notify, products = [], promotions = [], bankSettings = { bank: {}, isActive: false }, depositsList = [], depositFilter = "all", depositSearch = "", guideData = null, guidesList = [], guideFilter = "all", guideSearch = "", categoriesList = [
    { id: "discord", name: "Discord", icon: "gamepad" },
    { id: "entertainment", name: "Giải trí", icon: "layers" },
    { id: "creative", name: "Sáng tạo", icon: "sparkles" },
  ], partnersList = [], currentUser = { role: "admin", email: "", name: "" }, adminCategoryFilter = "all", currentView = "orders", initialized = false, loaded = false, editingCategoryId = null, returnToProductId = null;
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
      const [pricingData, bankData, depositsData, guideRes, partnersRes] = await Promise.all([
        api("/api/admin/pricing"),
        api("/api/admin/bank").catch(() => ({ settings: { bank: {}, isActive: false } })),
        api("/api/admin/deposits?limit=100").catch(() => ({ deposits: [] })),
        api("/api/admin/guide").catch(() => ({ guide: null, guides: [] })),
        api("/api/admin/partners").catch(() => ({ partners: [] })),
      ]);
      loaded = true;
      products = pricingData.products;
      promotions = pricingData.promotions;
      if (pricingData.caller) {
        currentUser = pricingData.caller;
      }
      if (Array.isArray(pricingData.categories) && pricingData.categories.length) {
        categoriesList = pricingData.categories;
      }
      bankSettings = bankData.settings || { bank: {}, isActive: false };
      depositsList = depositsData.deposits || [];
      guideData = guideRes.guide || null;
      guidesList = Array.isArray(guideRes.guides) ? guideRes.guides : (guideData ? [guideData] : []);
      partnersList = Array.isArray(partnersRes?.partners) ? partnersRes.partners : [];
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

  function slugify(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
  }

  function getCategoryDisplayName(catId) {
    const found = categoriesList.find(c => c.id === catId);
    if (found) return found.name;
    if (catId === "discord") return "Discord";
    if (catId === "decor") return "Profile Decor";
    if (catId === "entertainment") return "Giải trí";
    if (catId === "creative") return "Sáng tạo";
    if (catId === "services") return "Dịch vụ Discord";
    return catId || "Chung";
  }

  async function moveProduct(productId, direction) {
    const idx = products.findIndex(p => p.id === productId);
    if (idx === -1) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= products.length) return;
    const item = products.splice(idx, 1)[0];
    products.splice(targetIdx, 0, item);
    render();
    try {
      const res = await api("/api/admin/catalog/reorder", {
        method: "PUT",
        body: JSON.stringify({ productIds: products.map(p => p.id) }),
      });
      if (res?.products) products = res.products;
      notify(`Đã chuyển vị trí "${item.name}" thành công!`);
    } catch (err) {
      notify("Lỗi cập nhật vị trí: " + err.message);
      await load();
    }
  }

  async function setProductPosition(productId, targetIdx) {
    const idx = products.findIndex(p => p.id === productId);
    if (idx === -1 || targetIdx < 0 || targetIdx >= products.length || idx === targetIdx) return;
    const item = products.splice(idx, 1)[0];
    products.splice(targetIdx, 0, item);
    render();
    try {
      const res = await api("/api/admin/catalog/reorder", {
        method: "PUT",
        body: JSON.stringify({ productIds: products.map(p => p.id) }),
      });
      if (res?.products) products = res.products;
      notify(`Đã chuyển "${item.name}" tới vị trí #${targetIdx + 1}!`);
    } catch (err) {
      notify("Lỗi cập nhật vị trí: " + err.message);
      await load();
    }
  }

  function openCategoriesManager(fromProductId = null) {
    if (fromProductId) returnToProductId = fromProductId;
    const isPartner = currentUser && currentUser.role === "partner";
    const partnerEmail = isPartner ? (currentUser.email || "").toLowerCase() : null;

    $("#catalog-editor").innerHTML = `
      <div class="pricing-card categories-manager-card">
        <div class="promotion-title">
          <div>
            <h3>⚙️ Quản lý & Chỉnh sửa Hạng mục</h3>
            <p class="admin-cat-help" style="font-size:12px; color:var(--muted); margin:4px 0 0;">
              ${isPartner
                ? "Tự tạo thêm hạng mục mới cho dịch vụ của bạn hoặc chỉnh sửa/xóa hạng mục do bạn tạo. Hạng mục hệ thống cũ được bảo vệ và không thể xóa."
                : "Tự tạo thêm hạng mục mới, đổi tên hoặc sắp xếp lại thứ tự các hạng mục hiển thị trên cửa hàng."}
            </p>
          </div>
          <button type="button" class="button secondary btn-small" data-cat-mgr-close>Đóng ✕</button>
        </div>

        <div class="cat-list-wrap" style="margin-top:16px;">
          <h4 style="font-size:13px; margin-bottom:8px; color:var(--accent);">Danh sách hạng mục hiện có (${categoriesList.length}):</h4>
          <div class="cat-rows-container">
            ${categoriesList.map((cat, idx) => {
              const count = products.filter(p => p.category === cat.id).length;
              const isCatPartner = Boolean(cat.partnerEmail);
              const isOwned = isPartner ? Boolean(cat.partnerEmail && cat.partnerEmail.toLowerCase() === partnerEmail) : true;

              let ownerBadge = "";
              if (!isCatPartner) {
                ownerBadge = `<span class="status-badge" style="background:#1f2937; color:#9ca3af; font-size:10px; border:1px solid #374151;">🔒 Mặc định</span>`;
              } else if (isPartner && isOwned) {
                ownerBadge = `<span class="status-badge" style="background:#1b382b; color:#34d399; font-size:10px; border:1px solid rgba(52,211,153,0.3);">🤝 Của bạn</span>`;
              } else {
                ownerBadge = `<span class="status-badge" style="background:#262338; color:#a78bfa; font-size:10px; border:1px solid rgba(167,139,250,0.3);" title="Hạng mục của ${esc(cat.partnerEmail)}">🤝 ${esc(cat.partnerEmail)}</span>`;
              }

              if (editingCategoryId === cat.id && isOwned) {
                return `
                  <div class="cat-manager-row cat-editing-row" style="background:rgba(217,119,6,0.12); border:1px solid var(--accent); padding:10px 14px; border-radius:8px; display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:8px;">
                    <span class="cat-index-badge">#${idx + 1}</span>
                    <div style="flex:1; min-width:180px;">
                      <label style="font-size:10px; color:var(--accent); font-weight:600; display:block; margin-bottom:3px;">TÊN HẠNG MỤC *</label>
                      <input id="cat-edit-name-input" value="${esc(cat.name)}" required maxlength="50" style="width:100%; padding:6px 10px; font-size:13px; background:var(--bg-card); color:var(--text); border:1px solid var(--line); border-radius:6px;" />
                    </div>
                    <div style="width:170px;">
                      <label style="font-size:10px; color:var(--accent); font-weight:600; display:block; margin-bottom:3px;">BIỂU TƯỢNG (ICON)</label>
                      <select id="cat-edit-icon-select" style="width:100%; padding:6px 10px; font-size:12px; background:var(--bg-card); color:var(--text); border:1px solid var(--line); border-radius:6px;">
                        <option value="gamepad" ${cat.icon === "gamepad" ? "selected" : ""}>🎮 Tay cầm Game</option>
                        <option value="layers" ${cat.icon === "layers" ? "selected" : ""}>🎬 Phim ảnh / Gói</option>
                        <option value="sparkles" ${cat.icon === "sparkles" ? "selected" : ""}>✨ Ngôi sao / Sáng tạo</option>
                        <option value="box" ${cat.icon === "box" ? "selected" : ""}>📦 Hộp quà / Dịch vụ</option>
                        <option value="grid" ${cat.icon === "grid" ? "selected" : ""}>🔲 Lưới / Tổng hợp</option>
                        <option value="headphones" ${cat.icon === "headphones" ? "selected" : ""}>🎧 Âm nhạc</option>
                        <option value="book" ${cat.icon === "book" ? "selected" : ""}>📖 Sách / Hướng dẫn</option>
                      </select>
                    </div>
                    <div style="display:flex; gap:6px; align-self:flex-end;">
                      <button type="button" class="button primary btn-xs" data-cat-save="${esc(cat.id)}">💾 Lưu</button>
                      <button type="button" class="button secondary btn-xs" data-cat-cancel>Hủy</button>
                    </div>
                  </div>
                `;
              }
              return `
                <div class="cat-manager-row">
                  <div class="cat-row-info">
                    <span class="cat-index-badge">#${idx + 1}</span>
                    <strong class="cat-name-display">${esc(cat.name)}</strong>
                    <code class="cat-id-code">[${esc(cat.id)}]</code>
                    <span class="status-badge" style="background:#26181b; font-size:10px;">${count} sản phẩm</span>
                    ${ownerBadge}
                  </div>
                  <div class="cat-row-actions">
                    ${isOwned
                      ? `<button type="button" class="button secondary btn-xs" data-cat-edit="${esc(cat.id)}" title="Sửa tên hoặc icon hạng mục của bạn">✏️ Sửa</button>`
                      : `<button type="button" class="button secondary btn-xs" disabled title="Hạng mục cũ / hệ thống - Đối tác không thể chỉnh sửa" style="opacity:0.45; cursor:not-allowed;">🔒 Khóa</button>`
                    }
                    ${!isPartner
                      ? `<button type="button" class="button secondary btn-xs" data-cat-up="${esc(cat.id)}" ${idx === 0 ? "disabled" : ""} title="Đưa lên trên">▲ Lên</button>
                         <button type="button" class="button secondary btn-xs" data-cat-down="${esc(cat.id)}" ${idx === categoriesList.length - 1 ? "disabled" : ""} title="Đưa xuống dưới">▼ Xuống</button>`
                      : ""
                    }
                    ${isOwned
                      ? `<button type="button" class="button secondary btn-xs btn-danger" data-cat-delete="${esc(cat.id)}" ${count > 0 ? 'disabled title="Còn sản phẩm thuộc hạng mục này, không thể xóa"' : 'title="Xóa hạng mục của bạn"'}>✕ Xóa</button>`
                      : `<button type="button" class="button secondary btn-xs btn-danger" disabled title="Hạng mục cũ / hệ thống - Đối tác không thể xóa" style="opacity:0.4; cursor:not-allowed;">🔒 Khóa</button>`
                    }
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>

        <form id="category-add-form" class="category-add-form" style="margin-top:20px; padding-top:16px; border-top:1px solid var(--line);">
          <h4 style="font-size:13px; margin-bottom:12px; color:var(--accent);">+ Tự tạo thêm hạng mục mới:</h4>
          <div class="pricing-form-grid">
            <label>Tên hiển thị hạng mục *<input name="catName" required maxlength="50" placeholder="Ví dụ: Game Bản Quyền, AI & Đồ Họa, Thiết Kế..."></label>
            <label>Mã hạng mục (Tùy chọn)<input name="catId" maxlength="30" placeholder="Để trống sẽ tự tạo từ tên..."></label>
            <label>Biểu tượng (Icon)<select name="catIcon">
              <option value="gamepad">🎮 Tay cầm Game / Giải trí (gamepad)</option>
              <option value="layers">🎬 Phim ảnh / Gói xếp lớp (layers)</option>
              <option value="sparkles">✨ Ngôi sao / Sáng tạo (sparkles)</option>
              <option value="box" selected>📦 Hộp quà / Dịch vụ (box)</option>
              <option value="grid">🔲 Lưới / Tổng hợp (grid)</option>
              <option value="headphones">🎧 Âm nhạc / Hỗ trợ (headphones)</option>
              <option value="book">📖 Sách / Hướng dẫn (book)</option>
            </select></label>
          </div>
          <p class="pricing-form-message" role="status"></p>
          <button type="submit" class="button primary" style="margin-top:10px;">+ Tạo hạng mục này</button>
        </form>
      </div>
    `;
    if (editingCategoryId) {
      const inp = $("#cat-edit-name-input");
      if (inp) { inp.focus(); inp.select(); }
    } else {
      $("#category-add-form [name=catName]").focus();
    }
  }

  function render() {
    const panel = $("#admin-pricing-view");
    if (currentView === "orders") return;
    if (!loaded) { panel.innerHTML = '<p class="pricing-hint">Đang tải giá và ưu đãi...</p><button type="button" class="button secondary" data-pricing-reload>Tải lại dữ liệu</button>'; return; }
    if (currentView === "partners") {
      panel.innerHTML = `
        <header class="pricing-heading">
          <div>
            <span class="pricing-eyebrow">ĐỐI TÁC CỬA HÀNG</span>
            <h2>Quản lý Đối tác (Partners)</h2>
            <p>Cấp role đối tác cho Gmail, cho phép đối tác đăng nhập trang admin để đăng bán và quản lý dịch vụ riêng.</p>
          </div>
          <div class="pricing-actions">
            <button type="button" class="button primary" data-partner-new>+ Cấp quyền đối tác mới</button>
          </div>
        </header>

        <div id="catalog-editor"></div>

        <div class="partners-stats-grid">
          <div class="pricing-card partner-stat-box">
            <span class="stat-label">TỔNG ĐỐI TÁC</span>
            <strong>${partnersList.length}</strong>
          </div>
          <div class="pricing-card partner-stat-box">
            <span class="stat-label">ĐANG HOẠT ĐỘNG</span>
            <strong style="color:var(--success);">${partnersList.filter(p => p.isActive).length}</strong>
          </div>
          <div class="pricing-card partner-stat-box">
            <span class="stat-label">TỔNG DỊCH VỤ ĐỐI TÁC</span>
            <strong>${partnersList.reduce((acc, p) => acc + (p.productsCount || 0), 0)}</strong>
          </div>
        </div>

        <div class="partners-list-container">
          ${partnersList.length === 0 ? `
            <div class="pricing-card" style="text-align:center; padding: 40px 20px;">
              <span style="font-size:36px; display:block; margin-bottom:12px;">🤝</span>
              <h3 style="margin:0 0 8px;">Chưa có đối tác nào</h3>
              <p style="color:var(--muted); font-size:12px; margin:0 0 16px;">Bấm nút bên dưới để cấp quyền đối tác cho một địa chỉ Gmail.</p>
              <button type="button" class="button primary" data-partner-new>+ Cấp quyền đối tác đầu tiên</button>
            </div>
          ` : `
            <div class="partner-cards-grid">
              ${partnersList.map(pt => `
                <div class="pricing-card partner-card ${pt.isActive ? '' : 'is-inactive'}">
                  <div class="partner-card-header">
                    <div class="partner-avatar">🤝</div>
                    <div class="partner-info">
                      <h4>${esc(pt.name)}</h4>
                      <p class="partner-email">${esc(pt.email)}</p>
                    </div>
                    <span class="partner-status-tag ${pt.isActive ? 'active' : 'locked'}">
                      ${pt.isActive ? '🟢 Hoạt động' : '🔒 Đã khóa'}
                    </span>
                  </div>

                  <div class="partner-metrics">
                    <div class="metric-item">
                      <small>Dịch vụ / Gói</small>
                      <strong>${pt.productsCount || 0}</strong>
                    </div>
                    <div class="metric-item">
                      <small>Đơn hàng</small>
                      <strong>${pt.ordersCount || 0}</strong>
                    </div>
                    <div class="metric-item">
                      <small>Doanh số</small>
                      <strong>${money(pt.revenue || 0)}</strong>
                    </div>
                  </div>

                  <div class="partner-meta">
                    <small>Cấp quyền: ${new Date(pt.createdAt).toLocaleDateString('vi-VN')}</small>
                  </div>

                  <div class="partner-card-actions">
                    <button type="button" class="button secondary btn-small" data-partner-toggle="${pt.id}" data-active="${pt.isActive ? 0 : 1}">
                      ${pt.isActive ? 'Khóa đối tác' : 'Mở khóa'}
                    </button>
                    <button type="button" class="button danger btn-small" data-partner-delete="${pt.id}" data-name="${esc(pt.name)}" data-email="${esc(pt.email)}">
                      Gỡ quyền ✕
                    </button>
                  </div>
                </div>
              `).join("")}
            </div>
          `}
        </div>
      `;
      return;
    }
    if (currentView === "prices") {
      const isPartner = currentUser.role === "partner";
      const displayedProducts = products.filter(p => {
        if (isPartner) {
          return String(p.partnerEmail || "").toLowerCase() === currentUser.email.toLowerCase();
        }
        if (adminCategoryFilter !== "all" && p.category !== adminCategoryFilter) return false;
        return true;
      });

      panel.innerHTML = `<header class="pricing-heading">
        <div>
          <span class="pricing-eyebrow">${isPartner ? "DỊCH VỤ CỦA TÔI" : "DANH MỤC CỬA HÀNG"}</span>
          <h2>${isPartner ? "Dịch vụ & Mặt hàng của bạn" : "Giá, Vị trí & Mặt hàng"}</h2>
          <p>${isPartner
            ? `Bạn đang quản lý ${displayedProducts.length} mặt hàng / dịch vụ được ủy quyền bán trên VietNam Legacy.`
            : "Tùy chỉnh thứ tự vị trí hiển thị, phân chia các hạng mục, thêm mới, sửa hoặc ẩn/hiện từng gói."
          }</p>
        </div>
        <div class="pricing-actions">
          ${!isPartner ? '<button type="button" class="button secondary" data-categories-manage>⚙️ Quản lý hạng mục</button>' : ''}
          <button type="button" class="button primary" data-product-new>+ Thêm ${isPartner ? "dịch vụ mới" : "mặt hàng mới"}</button>
        </div>
      </header>

      ${!isPartner ? `
      <div class="admin-category-filter-bar">
        <span class="cat-filter-label" style="font-size:11px; color:var(--muted); align-self:center; margin-right:4px;">Lọc hạng mục:</span>
        <button type="button" class="admin-cat-pill ${adminCategoryFilter === 'all' ? 'active' : ''}" data-filter-cat="all">Tất cả (${products.length})</button>
        ${categoriesList.map(cat => {
          const count = products.filter(p => p.category === cat.id).length;
          return `<button type="button" class="admin-cat-pill ${adminCategoryFilter === cat.id ? 'active' : ''}" data-filter-cat="${esc(cat.id)}">${esc(cat.name)} (${count})</button>`;
        }).join("")}
      </div>
      ` : ''}

      <div id="catalog-editor"></div>
      <form id="admin-prices-form">
        <div class="price-product-grid">
          ${displayedProducts.map(p => {
            const globalIdx = products.findIndex(x => x.id === p.id);
            const totalProds = products.length;
            return `
            <section class="pricing-card product-manage-card ${p.isActive ? "" : "is-inactive"}">
              <div class="product-card-top">
                <div>
                  <div class="product-title-row">
                    ${!isPartner ? `<span class="product-pos-badge" title="Thứ tự vị trí hiển thị trên cửa hàng">#${globalIdx + 1}</span>` : ""}
                    <img src="${esc(p.image || 'assets/nitro.svg')}" style="width:24px; height:24px; object-fit:contain; border-radius:4px; vertical-align:middle; background:#11080a; border:1px solid #382428;" alt="" />
                    <h3>${esc(p.name)}</h3>
                    <span class="product-category-chip">${esc(getCategoryDisplayName(p.category))}</span>
                    ${p.partnerEmail ? `<span class="product-partner-badge" title="Mặt hàng do đối tác quản lý">🤝 ${esc(p.partnerEmail)}</span>` : ""}
                    ${p.service ? '<span class="status-badge service-sm">🛠️ Dịch vụ</span>' : ""}
                    ${p.isCustom ? '<span class="status-badge custom">Tự tạo</span>' : ""}
                    ${p.isActive ? '<span class="status-badge active">Đang bán</span>' : '<span class="status-badge disabled">Đã ẩn / Bỏ bán</span>'}
                  </div>
                  <p class="product-desc-snippet">${esc(p.description || "Chưa có mô tả.")}</p>
                </div>
                <div class="product-card-actions">
                  ${!isPartner ? `
                  <div class="reorder-btn-group" title="Sắp xếp vị trí của mặt hàng này">
                    <button type="button" class="button secondary btn-small btn-move" data-product-up="${p.id}" ${globalIdx === 0 ? "disabled" : ""} title="Đưa lên trên">▲ Lên</button>
                    <button type="button" class="button secondary btn-small btn-move" data-product-down="${p.id}" ${globalIdx === totalProds - 1 ? "disabled" : ""} title="Đưa xuống dưới">▼ Xuống</button>
                    <select class="product-pos-select" data-product-pos="${p.id}" title="Chọn nhanh số thứ tự vị trí">
                      ${products.map((_, i) => `<option value="${i}" ${i === globalIdx ? "selected" : ""}>Vị trí ${i + 1}</option>`).join("")}
                    </select>
                  </div>
                  ` : ''}
                  <button type="button" class="button secondary btn-small" data-variant-new="${p.id}">+ Thêm gói</button>
                  <button type="button" class="button secondary btn-small" data-product-edit="${p.id}" title="Chỉnh sửa thông tin mặt hàng">✏️ Sửa</button>
                  <button type="button" class="button secondary btn-small" data-product-toggle="${p.id}">${p.isActive ? "Bỏ bán (Ẩn)" : "Mở bán lại"}</button>
                  <button type="button" class="button secondary btn-small btn-danger" data-product-delete="${p.id}" title="Xóa vĩnh viễn mặt hàng này">✕ Xóa</button>
                </div>
              </div>
              <div class="variants-container">
                ${p.service ? `
                  <div class="service-notice-admin" style="background:#1b1013; padding:10px 14px; border-radius:6px; border:1px dashed #4a343a; font-size:11px; color:#c5b5ae; margin-bottom:8px;">
                    🛠️ <strong>Dịch vụ báo giá theo yêu cầu:</strong> Khách hàng trao đổi trực tiếp trên Discord để thống nhất yêu cầu và chi phí trước khi báo giá.
                  </div>
                ` : ""}
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
                `).join("") : (p.service ? "" : '<p class="empty-variants-hint">Chưa có gói sản phẩm nào. Bấm "+ Thêm gói" để tạo gói đầu tiên.</p>')}
              </div>
            </section>
          `}).join("")}
        </div>
        <div class="pricing-savebar">
          <p>Giá mới áp dụng cho đơn tạo sau khi lưu. Thứ tự vị trí và hạng mục được cập nhật tự động ngay khi chọn.</p>
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
      const webhookUrl = typeof window !== "undefined" && window.location ? `${window.location.origin}/api/payments/webhook` : "/api/payments/webhook";
      const autoCredit = bankSettings.autoCredit !== false;

      panel.innerHTML = `
        <header class="pricing-heading">
          <div>
            <span class="pricing-eyebrow">THANH TOÁN & VÍ TIỀN</span>
            <h2>Nạp tiền bằng QR Ngân hàng & Tự động cộng tiền</h2>
            <p>Cài đặt tài khoản ngân hàng nhận tiền, cấp mã VietQR tự động và kết nối Webhook SePay để tự động cộng tiền ngay khi nhận được thanh toán.</p>
          </div>
          <div class="pricing-actions">
            <button type="button" class="button secondary" data-deposits-reload>Làm mới ↻</button>
          </div>
        </header>

        <div id="catalog-editor"></div>

        <form id="admin-bank-form">
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

            <div class="bank-form-layout">
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
                  <button type="submit" class="button primary">Lưu cấu hình ngân hàng & Webhook 💾</button>
                </div>
              </div>

              <div class="bank-qr-preview-box">
                <h4>Xem trước mã QR của shop</h4>
                <p>Mã QR quét thử (50.000₫ · VNLTEST)</p>
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
            </div>
          </section>

          <section class="pricing-card webhook-config-card">
            <div class="card-header-row">
              <div>
                <div class="card-title-with-badge">
                  <h3>⚡ Tự động cộng tiền qua Webhook Ngân hàng (SePay / VietQR)</h3>
                  <span id="auto-credit-badge" class="${autoCredit ? "auto-credit-live-badge" : "auto-credit-live-badge disabled"}">
                    ${autoCredit ? "Đang bật Tự động" : "Đang tắt (Duyệt tay)"}
                  </span>
                </div>
                <p>Khi khách hàng quét QR chuyển khoản, SePay sẽ gửi thông báo Webhook về webVNL. Hệ thống tự động nhận diện mã nạp <strong>VNL...</strong> và <strong>cộng tiền ngay lập tức vào ví</strong> mà không cần duyệt tay.</p>
              </div>
              <div class="announcement-toggle-group">
                <label class="switch-label">
                  <input type="checkbox" id="bank-auto-credit-toggle" ${autoCredit ? "checked" : ""} aria-label="Bật tự động cộng tiền" />
                  <span class="switch-slider"></span>
                </label>
                <span id="auto-credit-status-text" class="${autoCredit ? "status-active" : "status-inactive"}">
                  ${autoCredit ? "Tự động cộng tiền: BẬT" : "Tự động cộng tiền: TẮT (Duyệt tay)"}
                </span>
              </div>
            </div>

            <div class="webhook-settings-body">
              <div class="webhook-fields-grid">
                <div class="webhook-field-item">
                  <label>
                    <strong>URL Webhook nhận biến động số dư:</strong>
                    <small>Dán URL này vào phần cấu hình Webhook trên SePay (my.sepay.vn) hoặc Casso.</small>
                  </label>
                  <div class="input-with-action">
                    <input type="text" id="webhook-url-display" readonly value="${esc(webhookUrl)}" />
                    <button type="button" class="button secondary" id="btn-copy-webhook-url" title="Sao chép URL Webhook">📋 Sao chép</button>
                  </div>
                </div>

                <div class="webhook-field-item">
                  <label>
                    <strong>Khóa xác thực bảo mật Webhook (API Key / Secret):</strong>
                    <small>Điền API Key này vào SePay để hệ thống xác thực tính hợp lệ của thông báo.</small>
                  </label>
                  <div class="input-with-action">
                    <input type="text" id="webhook-secret-input" name="webhookSecret" placeholder="VD: vnl_sec_... hoặc API Key SePay cấp" value="${esc(bankSettings.webhookSecret || "")}" />
                    <button type="button" class="button secondary" id="btn-gen-webhook-secret" title="Tạo ngẫu nhiên một mã bảo mật mạnh">🎲 Tạo ngẫu nhiên</button>
                    <button type="button" class="button secondary" id="btn-copy-webhook-secret" title="Sao chép API Key">📋 Sao chép</button>
                  </div>
                </div>
              </div>

              <div class="sepay-guide-box">
                <div class="sepay-guide-header">
                  <span class="sepay-badge">HƯỚNG DẪN KẾT NỐI SEPAY</span>
                  <h4>3 bước để tiền vào tài khoản ngân hàng tự động nhảy vào ví khách hàng:</h4>
                </div>
                <ol class="sepay-steps-list">
                  <li>
                    <strong>Bước 1:</strong> Đăng ký tài khoản tại <a href="https://my.sepay.vn" target="_blank" rel="noopener noreferrer">my.sepay.vn</a> và liên kết tài khoản ngân hàng nhận tiền (${esc(bank.gateway || "ngân hàng")} - ${esc(bank.accountNumber || "STK")}).
                  </li>
                  <li>
                    <strong>Bước 2:</strong> Vào menu <strong>Tích hợp Webhook</strong> ➔ bấm <strong>Thêm Webhook</strong>.
                  </li>
                  <li>
                    <strong>Bước 3:</strong> Dán <strong>URL Webhook</strong> và <strong>API Key</strong> ở trên vào SePay ➔ Chọn kiểu xác thực là <strong>API Key</strong> (hoặc Header <code>Authorization: Apikey &lt;key&gt;</code>) ➔ Bấm <strong>Lưu</strong>.
                  </li>
                </ol>
                <div class="sepay-guide-footer">
                  <p>💡 <em>Khi khách chuyển khoản theo đúng mã <code>VNL...</code> được sinh tự động trên VietQR, SePay sẽ bắn thông báo về và số dư ví khách hàng sẽ tự động tăng ngay lập tức!</em></p>
                </div>
              </div>

              <div class="bank-form-footer">
                <button type="submit" class="button primary">Lưu cấu hình Ngân hàng & Webhook 💾</button>
              </div>
            </div>
          </section>
        </form>

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

  function openPartnerEditor() {
    $("#catalog-editor").innerHTML = `
      <form id="partner-create-form" class="pricing-card promotion-form">
        <div class="promotion-title">
          <h3>🤝 Cấp quyền đối tác bán hàng</h3>
          <button type="button" class="button secondary btn-small" data-catalog-close>Đóng</button>
        </div>
        <p style="font-size:12px; color:var(--muted); margin: -4px 0 16px;">
          Cấp quyền cho địa chỉ Gmail của đối tác để họ đăng nhập vào trang Admin bán dịch vụ của riêng họ.
        </p>
        <div class="pricing-form-grid">
          <label>
            Gmail đối tác *
            <input name="email" type="email" required placeholder="ví dụ: doittac@gmail.com" autocomplete="off" />
          </label>
          <label>
            Tên đối tác / Thương hiệu *
            <input name="name" required maxlength="100" placeholder="ví dụ: Shop Discord Tuấn Anh" autocomplete="off" />
          </label>
          <label style="grid-column: 1 / -1;">
            Mật khẩu đăng nhập đối tác * (tối thiểu 6 ký tự)
            <input name="password" type="password" required minlength="6" placeholder="Khởi tạo mật khẩu đăng nhập cho đối tác..." autocomplete="new-password" />
            <small style="color:var(--muted); font-size:11px; margin-top:4px; display:block;">
              Ghi nhớ hoặc gửi mật khẩu này cho đối tác. Đối tác sẽ dùng Gmail + mật khẩu này để đăng nhập vào trang Admin.
            </small>
          </label>
        </div>
        <p class="pricing-form-message" role="status"></p>
        <div style="display:flex; gap:10px; margin-top:14px;">
          <button class="button primary" type="submit">Xác nhận cấp quyền đối tác 🤝</button>
          <button class="button secondary" type="button" data-catalog-close>Hủy</button>
        </div>
      </form>
    `;
    $("#partner-create-form [name=email]").focus();
  }

  function renderFeaturesPreviewHtml(text) {
    const lines = String(text || "")
      .split("\n")
      .map(line => line.trim().replace(/^[✓\-\*]\s*/, ""))
      .filter(Boolean)
      .slice(0, 10);
    if (!lines.length) {
      return `<li style="font-size:12px; color:var(--muted); font-style:italic;">(Chưa có đặc điểm nào — nhập từng dòng ở ô trên để hiển thị)</li>`;
    }
    return lines.map(line => `
      <li style="display:flex; align-items:flex-start; gap:8px; font-size:12px; color:var(--text); line-height:1.4;">
        <span style="color:#22c55e; font-weight:bold; font-size:13px; line-height:1.2;">✓</span>
        <span>${esc(line)}</span>
      </li>
    `).join("");
  }

  function openProductEditor(productId = null) {
    const isPartner = currentUser.role === "partner";
    const standardImages = [
      { value: "assets/nitro.svg", label: "Biểu tượng Nitro (Sấm sét)" },
      { value: "assets/youtube.svg", label: "Biểu tượng YouTube / Video" },
      { value: "assets/netflix.svg", label: "Biểu tượng Phim ảnh / Rạp chiếu" },
      { value: "assets/capcut.svg", label: "Biểu tượng Biên tập / Sáng tạo" },
      { value: "assets/decor.svg", label: "Biểu tượng Decor / Khung avatar" },
      { value: "assets/boost.svg", label: "Biểu tượng Boost Server" },
      { value: "assets/server.svg", label: "Biểu tượng Server Discord" },
      { value: "assets/bot.svg", label: "Biểu tượng Custom Bot" },
    ];
    if (productId) {
      const p = products.find(x => x.id === productId);
      if (!p) return;
      const isCustomImg = Boolean(p.image && !standardImages.some(img => img.value === p.image));
      const selectedImgPreset = isCustomImg ? "__custom__" : (p.image || "assets/nitro.svg");
      $("#catalog-editor").innerHTML = `<form id="product-edit-form" class="pricing-card promotion-form" data-product-id="${p.id}">
        <div class="promotion-title"><h3>✏️ Chỉnh sửa mặt hàng: ${esc(p.name)}</h3><button type="button" class="button secondary btn-small" data-catalog-close>Đóng</button></div>
        <div class="pricing-form-grid">
          <label>Tên mặt hàng *<input name="name" required maxlength="100" value="${esc(p.name)}"></label>
          <label>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span>Danh mục / Hạng mục *</span>
              <button type="button" data-categories-manage="${p.id}" style="background:none; border:none; color:var(--accent); font-size:11px; cursor:pointer; text-decoration:underline; padding:0;">
                ⚙️ Quản lý & Sửa hạng mục
              </button>
            </div>
            <select name="category" required id="product-category-select">
              ${categoriesList.map(c => `<option value="${esc(c.id)}" ${p.category === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
              <option value="__custom__">✨ + Tự tạo thêm hạng mục mới...</option>
            </select>
          </label>
          <div id="new-cat-inline-wrap" style="display:none; grid-column:1 / -1; margin-top:-4px; background:rgba(217,119,6,0.08); border:1px dashed var(--accent); padding:10px 14px; border-radius:8px;">
            <label style="color:var(--accent); font-size:12px; font-weight:600; display:block; margin-bottom:6px;">
              ✨ Tên hạng mục mới cần tạo *
              <input name="newCategoryName" placeholder="Ví dụ: Game Bản Quyền, AI & Đồ Họa, Thiết Kế..." style="margin-top:4px;">
            </label>
            <label style="color:var(--text); font-size:11px; display:block;">
              Biểu tượng đại diện:
              <select name="newCategoryIcon" style="margin-top:4px;">
                <option value="gamepad">🎮 Tay cầm Game / Giải trí (gamepad)</option>
                <option value="layers">🎬 Phim ảnh / Gói xếp lớp (layers)</option>
                <option value="sparkles">✨ Ngôi sao / Sáng tạo (sparkles)</option>
                <option value="box" selected>📦 Hộp quà / Dịch vụ (box)</option>
                <option value="grid">🔲 Lưới / Tổng hợp (grid)</option>
                <option value="headphones">🎧 Âm nhạc / Hỗ trợ (headphones)</option>
                <option value="book">📖 Sách / Hướng dẫn (book)</option>
              </select>
            </label>
          </div>
          ${!isPartner ? `
          <label>Đối tác sở hữu (tùy chọn)<select name="partnerEmail">
            <option value="">-- Cửa hàng chính (VNL Admin) --</option>
            ${partnersList.map(pt => `<option value="${esc(pt.email)}" ${(p?.partnerEmail || "") === pt.email ? "selected" : ""}>${esc(pt.name)} (${esc(pt.email)})</option>`).join("")}
          </select></label>
          ` : `
          <div style="font-size:11px; color:#60a5fa; grid-column:1 / -1;">🤝 Mặt hàng này thuộc quyền quản lý của bạn (<b>${esc(currentUser.email)}</b>).</div>
          `}
          <label>Huy hiệu / Badge (Góc ảnh)<input name="badge" maxlength="50" placeholder="Ví dụ: DISCORD / NITRO BOOST" value="${esc(p.badge || "")}"></label>
          <label>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span>Ảnh minh họa (Icon) *</span>
              <span style="font-size:11px; color:var(--muted);">Có sẵn hoặc tự chỉnh ảnh riêng</span>
            </div>
            <select name="imagePreset" id="product-image-select">
              ${standardImages.map(img => `<option value="${img.value}" ${!isCustomImg && selectedImgPreset === img.value ? "selected" : ""}>${img.label}</option>`).join("")}
              <option value="__custom__" ${isCustomImg ? "selected" : ""}>✨ + Nhập link ảnh riêng / Tải ảnh lên...</option>
            </select>
          </label>
          <div id="product-custom-image-wrap" style="${isCustomImg ? 'display:block;' : 'display:none;'} grid-column:1 / -1; margin-top:-4px; background:rgba(217,119,6,0.08); border:1px dashed var(--accent); padding:10px 14px; border-radius:8px;">
            <div style="display:flex; gap:14px; align-items:center; flex-wrap:wrap;">
              <div style="flex:1; min-width:220px;">
                <label style="color:var(--accent); font-size:11px; font-weight:600; display:block; margin-bottom:4px;">
                  🔗 LINK ẢNH MINH HỌA RIÊNG (URL) HOẶC TẢI ẢNH TỪ MÁY
                </label>
                <input id="product-custom-image-input" name="customImageUrl" placeholder="VD: https://i.imgur.com/... hoặc link ảnh bất kỳ" value="${isCustomImg ? esc(p.image) : ""}" style="width:100%; padding:7px 10px; font-size:13px; background:var(--bg-card); color:var(--text); border:1px solid var(--line); border-radius:6px;" />
                <div style="margin-top:8px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                  <label class="button secondary btn-xs" style="cursor:pointer; margin:0; display:inline-flex; align-items:center; gap:5px;">
                    📁 Tải ảnh từ máy
                    <input type="file" id="product-image-file-input" accept="image/*" style="display:none;" />
                  </label>
                  <span style="font-size:11px; color:var(--muted);">Hỗ trợ PNG, JPG, WebP, SVG (Tự động nén tối ưu)</span>
                </div>
              </div>
              <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                <span style="font-size:10px; color:var(--muted); font-weight:600;">XEM TRƯỚC</span>
                <div style="width:64px; height:64px; border-radius:8px; border:1px solid var(--line); background:#150a0d; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                  <img id="product-image-live-preview" src="${esc(p.image || 'assets/nitro.svg')}" style="max-width:100%; max-height:100%; object-fit:contain;" alt="Preview" onerror="this.src='assets/nitro.svg'" />
                </div>
              </div>
            </div>
          </div>
          <label style="grid-column: 1 / -1;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span>Mô tả ngắn (Hiển thị ở thẻ mặt hàng ngoài trang chủ) *</span>
              <span style="font-size:11px; color:var(--muted);">Tối đa 300 ký tự</span>
            </div>
            <input name="description" required maxlength="300" value="${esc(p.description || "")}">
          </label>
          <label style="grid-column: 1 / -1;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span>Đoạn giới thiệu chi tiết (Mục văn bản đầu popup khi khách bấm xem)</span>
              <span style="font-size:11px; color:var(--muted);">Hiển thị phần giới thiệu chi tiết mặt hàng</span>
            </div>
            <textarea name="detail" rows="3" maxlength="2000" style="width:100%; padding:8px 10px; font-size:13px; background:var(--bg-card); color:var(--text); border:1px solid var(--line); border-radius:6px; resize:vertical; font-family:inherit;" placeholder="Nhập đoạn văn bản giới thiệu chi tiết về mặt hàng khi khách bấm xem chi tiết...">${esc(p.detail || p.description || "")}</textarea>
          </label>
          <div style="grid-column: 1 / -1;">
            <label>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <span>Danh sách đặc điểm & cam kết (Mục dấu tích xanh ✓ trong popup)</span>
                <span style="font-size:11px; color:var(--muted);">Mỗi dòng 1 đặc điểm (Tối đa 10 dòng)</span>
              </div>
              <textarea id="product-features-input" name="featuresText" rows="4" style="width:100%; padding:8px 10px; font-size:13px; background:var(--bg-card); color:var(--text); border:1px solid var(--line); border-radius:6px; resize:vertical; font-family:inherit;" placeholder="Nhập mỗi dòng một đặc điểm, ví dụ:&#10;Áp dụng cho mọi tài khoản Discord&#10;Chọn nhận Link Gift hoặc Nạp Acc (Log)&#10;Bảo hành đầy đủ suốt thời gian gói">${(p.features || []).map(f => String(f).replace(/^[✓\-\*]\s*/, "")).join("\n")}</textarea>
            </label>
            <div class="product-features-preview-box" style="margin-top:6px; background:#12080a; border:1px solid #382428; border-radius:8px; padding:10px 14px;">
              <div style="font-size:11px; color:#c5b5ae; font-weight:600; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
                <span>👁️ XEM TRƯỚC DANH SÁCH TÍCH XANH TRONG POPUP CỬA HÀNG:</span>
              </div>
              <ul id="product-features-live-preview" style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:5px;">
              </ul>
            </div>
          </div>
        </div>
        <p class="pricing-form-message" role="status"></p>
        <button class="button primary" type="submit">Lưu thay đổi mặt hàng</button>
      </form>`;
      const fEditInput = $("#product-features-input");
      const fEditPreview = $("#product-features-live-preview");
      if (fEditInput && fEditPreview) {
        fEditPreview.innerHTML = renderFeaturesPreviewHtml(fEditInput.value);
      }
      $("#product-edit-form [name=name]").focus();
      return;
    }

    $("#catalog-editor").innerHTML = `<form id="product-create-form" class="pricing-card promotion-form">
      <div class="promotion-title"><h3>+ Thêm ${isPartner ? "dịch vụ mới" : "mặt hàng mới"}</h3><button type="button" class="button secondary btn-small" data-catalog-close>Đóng</button></div>
      <div class="pricing-form-grid">
        <label>Tên mặt hàng *<input name="name" required maxlength="100" placeholder="Ví dụ: Spotify Premium, Canva Pro..."></label>
        <label>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <span>Danh mục / Hạng mục *</span>
            <button type="button" data-categories-manage="new" style="background:none; border:none; color:var(--accent); font-size:11px; cursor:pointer; text-decoration:underline; padding:0;">
              ⚙️ Quản lý & Sửa hạng mục
            </button>
          </div>
          <select name="category" required id="product-category-select">
            ${categoriesList.map(c => `<option value="${esc(c.id)}" ${c.id === "entertainment" ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
            <option value="__custom__">✨ + Tự tạo thêm hạng mục mới...</option>
          </select>
        </label>
        <div id="new-cat-inline-wrap" style="display:none; grid-column:1 / -1; margin-top:-4px; background:rgba(217,119,6,0.08); border:1px dashed var(--accent); padding:10px 14px; border-radius:8px;">
          <label style="color:var(--accent); font-size:12px; font-weight:600; display:block; margin-bottom:6px;">
            ✨ Tên hạng mục mới cần tạo *
            <input name="newCategoryName" placeholder="Ví dụ: Game Bản Quyền, AI & Đồ Họa, Thiết Kế..." style="margin-top:4px;">
          </label>
          <label style="color:var(--text); font-size:11px; display:block;">
            Biểu tượng đại diện:
            <select name="newCategoryIcon" style="margin-top:4px;">
              <option value="gamepad">🎮 Tay cầm Game / Giải trí (gamepad)</option>
              <option value="layers">🎬 Phim ảnh / Gói xếp lớp (layers)</option>
              <option value="sparkles">✨ Ngôi sao / Sáng tạo (sparkles)</option>
              <option value="box" selected>📦 Hộp quà / Dịch vụ (box)</option>
              <option value="grid">🔲 Lưới / Tổng hợp (grid)</option>
              <option value="headphones">🎧 Âm nhạc / Hỗ trợ (headphones)</option>
              <option value="book">📖 Sách / Hướng dẫn (book)</option>
            </select>
          </label>
        </div>
        ${!isPartner ? `
        <label>Đối tác sở hữu (tùy chọn)<select name="partnerEmail">
          <option value="">-- Cửa hàng chính (VNL Admin) --</option>
          ${partnersList.map(pt => `<option value="${esc(pt.email)}">${esc(pt.name)} (${esc(pt.email)})</option>`).join("")}
        </select></label>
        ` : `
        <div style="font-size:11px; color:#60a5fa; grid-column:1 / -1;">🤝 Mặt hàng này sẽ được đăng bán dưới thương hiệu đối tác của bạn (<b>${esc(currentUser.email)}</b>).</div>
        `}
        <label>Huy hiệu / Badge (Góc ảnh)<input name="badge" maxlength="50" placeholder="Ví dụ: MUSIC / VIP, DESIGN / PRO..."></label>
        <label>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <span>Ảnh minh họa (Icon) *</span>
            <span style="font-size:11px; color:var(--muted);">Có sẵn hoặc tự chỉnh ảnh riêng</span>
          </div>
          <select name="imagePreset" id="product-image-select">
            ${standardImages.map(img => `<option value="${img.value}">${img.label}</option>`).join("")}
            <option value="__custom__">✨ + Nhập link ảnh riêng / Tải ảnh lên...</option>
          </select>
        </label>
        <div id="product-custom-image-wrap" style="display:none; grid-column:1 / -1; margin-top:-4px; background:rgba(217,119,6,0.08); border:1px dashed var(--accent); padding:10px 14px; border-radius:8px;">
          <div style="display:flex; gap:14px; align-items:center; flex-wrap:wrap;">
            <div style="flex:1; min-width:220px;">
              <label style="color:var(--accent); font-size:11px; font-weight:600; display:block; margin-bottom:4px;">
                🔗 LINK ẢNH MINH HỌA RIÊNG (URL) HOẶC TẢI ẢNH TỪ MÁY
              </label>
              <input id="product-custom-image-input" name="customImageUrl" placeholder="VD: https://i.imgur.com/... hoặc link ảnh bất kỳ" style="width:100%; padding:7px 10px; font-size:13px; background:var(--bg-card); color:var(--text); border:1px solid var(--line); border-radius:6px;" />
              <div style="margin-top:8px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                <label class="button secondary btn-xs" style="cursor:pointer; margin:0; display:inline-flex; align-items:center; gap:5px;">
                  📁 Tải ảnh từ máy
                  <input type="file" id="product-image-file-input" accept="image/*" style="display:none;" />
                </label>
                <span style="font-size:11px; color:var(--muted);">Hỗ trợ PNG, JPG, WebP, SVG (Tự động nén tối ưu)</span>
              </div>
            </div>
            <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
              <span style="font-size:10px; color:var(--muted); font-weight:600;">XEM TRƯỚC</span>
              <div style="width:64px; height:64px; border-radius:8px; border:1px solid var(--line); background:#150a0d; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                <img id="product-image-live-preview" src="assets/nitro.svg" style="max-width:100%; max-height:100%; object-fit:contain;" alt="Preview" onerror="this.src='assets/nitro.svg'" />
              </div>
            </div>
          </div>
        </div>
        <label style="grid-column: 1 / -1;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <span>Mô tả ngắn (Hiển thị ở thẻ mặt hàng ngoài trang chủ) *</span>
            <span style="font-size:11px; color:var(--muted);">Tối đa 300 ký tự</span>
          </div>
          <input name="description" required maxlength="300" placeholder="Mô tả quyền lợi và tính năng của mặt hàng...">
        </label>
        <label style="grid-column: 1 / -1;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <span>Đoạn giới thiệu chi tiết (Mục văn bản đầu popup khi khách bấm xem)</span>
            <span style="font-size:11px; color:var(--muted);">Hiển thị phần giới thiệu chi tiết mặt hàng</span>
          </div>
          <textarea name="detail" rows="3" maxlength="2000" style="width:100%; padding:8px 10px; font-size:13px; background:var(--bg-card); color:var(--text); border:1px solid var(--line); border-radius:6px; resize:vertical; font-family:inherit;" placeholder="Giới thiệu chi tiết sản phẩm / dịch vụ, chế độ bảo hành và quy trình bàn giao..."></textarea>
        </label>
        <div style="grid-column: 1 / -1;">
          <label>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span>Danh sách đặc điểm & cam kết (Mục dấu tích xanh ✓ trong popup)</span>
              <span style="font-size:11px; color:var(--muted);">Mỗi dòng 1 đặc điểm (Tối đa 10 dòng)</span>
            </div>
            <textarea id="product-features-input" name="featuresText" rows="4" style="width:100%; padding:8px 10px; font-size:13px; background:var(--bg-card); color:var(--text); border:1px solid var(--line); border-radius:6px; resize:vertical; font-family:inherit;" placeholder="Nhập mỗi dòng một đặc điểm, ví dụ:&#10;Kích hoạt nhanh chóng và uy tín&#10;Bảo hành đầy đủ suốt thời hạn&#10;Hỗ trợ kỹ thuật 24/7">Bảo hành đầy đủ suốt thời hạn&#10;Kích hoạt nhanh chóng và uy tín</textarea>
          </label>
          <div class="product-features-preview-box" style="margin-top:6px; background:#12080a; border:1px solid #382428; border-radius:8px; padding:10px 14px;">
            <div style="font-size:11px; color:#c5b5ae; font-weight:600; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
              <span>👁️ XEM TRƯỚC DANH SÁCH TÍCH XANH TRONG POPUP CỬA HÀNG:</span>
            </div>
            <ul id="product-features-live-preview" style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:5px;">
            </ul>
          </div>
        </div>
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
    const fCreateInput = $("#product-features-input");
    const fCreatePreview = $("#product-features-live-preview");
    if (fCreateInput && fCreatePreview) {
      fCreatePreview.innerHTML = renderFeaturesPreviewHtml(fCreateInput.value);
    }
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
                  <button type="button" class="button secondary btn-small btn-simulate" data-deposit-simulate="${esc(d.code)}" title="Giả lập ngân hàng chuyển tiền đúng mã này để kiểm tra tự động cộng tiền">
                    ⚡ Test Tự động cộng
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
    if (![
      "admin-prices-form",
      "promotion-form",
      "product-create-form",
      "product-edit-form",
      "variant-create-form",
      "variant-edit-form",
      "admin-bank-form",
      "admin-guide-form",
      "category-add-form",
      "partner-create-form",
    ].includes(form.id)) return;
    event.preventDefault();
    const button = form.querySelector('[type="submit"]'), message = form.querySelector(".pricing-form-message");
    if (button.disabled) return;
    button.disabled = true;
    if (message) message.textContent = "Đang lưu...";
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
        const autoCredit = $("#bank-auto-credit-toggle") ? $("#bank-auto-credit-toggle").checked : true;
        const bankCode = (data.get("bankCode") || "").trim().toUpperCase();
        const bankGateway = (data.get("bankGateway") || "").trim();
        const accountNumber = (data.get("accountNumber") || "").trim().replace(/\s+/g, "");
        const accountName = (data.get("accountName") || "").trim().toUpperCase();
        const webhookSecret = (data.get("webhookSecret") || "").trim();

        const res = await api("/api/admin/bank", {
          method: "PUT",
          body: JSON.stringify({ bankCode, bankGateway, accountNumber, accountName, isActive, autoCredit, webhookSecret }),
        });
        bankSettings = res.settings;
        notify(isActive ? "Đã lưu cấu hình ngân hàng & Webhook tự động cộng tiền!" : "Đã lưu thông tin ngân hàng (đang tắt nạp QR).");
      } else if (form.id === "category-add-form") {
        const data = new FormData(form);
        const catName = (data.get("catName") || "").trim();
        if (!catName) throw new Error("Vui lòng nhập tên hiển thị hạng mục.");
        let catId = slugify((data.get("catId") || "").trim() || catName);
        if (!catId) catId = "cat-" + Date.now();
        const catIcon = data.get("catIcon") || "box";
        if (categoriesList.some(c => c.id === catId)) throw new Error(`Mã hạng mục "${catId}" đã tồn tại.`);
        const newCat = { id: catId, name: catName, icon: catIcon };
        if (currentUser && currentUser.role === "partner") {
          newCat.partnerEmail = currentUser.email.toLowerCase();
        }
        categoriesList.push(newCat);
        const res = await api("/api/admin/categories", { method: "PUT", body: JSON.stringify({ categories: categoriesList }) });
        if (res && res.categories) categoriesList = res.categories;
        notify(`Đã thêm hạng mục "${catName}"!`);
        openCategoriesManager();
      } else if (form.id === "partner-create-form") {
        const data = new FormData(form);
        const email = (data.get("email") || "").trim().toLowerCase();
        const name = (data.get("name") || "").trim();
        const password = (data.get("password") || "").trim();
        await api("/api/admin/partners", {
          method: "POST",
          body: JSON.stringify({ email, name, password, isActive: 1 }),
        });
        notify(`Đã cấp quyền đối tác thành công cho ${email}!`);
        $("#catalog-editor").replaceChildren();
      } else if (form.id === "product-create-form") {
        const data = new FormData(form);
        const name = data.get("name").trim();
        let category = data.get("category");
        if (category === "__custom__") {
          const newName = (data.get("newCategoryName") || "").trim();
          if (!newName) throw new Error("Vui lòng nhập tên cho hạng mục mới.");
          const newIcon = data.get("newCategoryIcon") || "box";
          const newId = slugify(newName) || "cat-" + Date.now();
          if (!categoriesList.some(c => c.id === newId)) {
            const newCat = { id: newId, name: newName, icon: newIcon };
            if (currentUser && currentUser.role === "partner") {
              newCat.partnerEmail = currentUser.email.toLowerCase();
            }
            categoriesList.push(newCat);
            const res = await api("/api/admin/categories", { method: "PUT", body: JSON.stringify({ categories: categoriesList }) });
            if (res && res.categories) categoriesList = res.categories;
          }
          category = newId;
        }
        const badge = data.get("badge").trim();
        const description = data.get("description").trim();
        const detail = (data.get("detail") || "").trim() || description;
        const featuresText = (data.get("featuresText") || "").trim();
        const features = featuresText
          ? featuresText.split("\n").map(s => s.trim().replace(/^[✓\-\*]\s*/, "")).filter(Boolean).slice(0, 10)
          : [];
        const imagePreset = (data.get("imagePreset") || "").trim() || "assets/nitro.svg";
        let image = imagePreset;
        if (imagePreset === "__custom__") {
          const customUrl = (data.get("customImageUrl") || "").trim();
          if (!customUrl) throw new Error("Vui lòng nhập link ảnh hoặc tải ảnh từ máy lên.");
          image = customUrl;
        }
        const partnerEmail = currentUser.role === "partner"
          ? currentUser.email
          : ((data.get("partnerEmail") || "").trim() || null);
        const variantName = (data.get("variantName") || "").trim();
        const variantPrice = data.get("variantPrice") ? Number(data.get("variantPrice")) : null;
        const deliveryType = data.get("deliveryType") || "gift";
        const variantNote = (data.get("variantNote") || "").trim();
        const variants = variantName && variantPrice !== null ? [{ name: variantName, price: variantPrice, deliveryType, note: variantNote }] : [];
        await api("/api/admin/products", { method: "POST", body: JSON.stringify({ name, category, badge, description, image, partnerEmail, variants, detail, features }) });
        notify(currentUser.role === "partner" ? "Đã đăng dịch vụ mới thành công!" : "Đã thêm mặt hàng mới.");
        $("#catalog-editor").replaceChildren();
      } else if (form.id === "product-edit-form") {
        const data = new FormData(form);
        const productId = form.dataset.productId;
        const name = data.get("name").trim();
        let category = data.get("category");
        if (category === "__custom__") {
          const newName = (data.get("newCategoryName") || "").trim();
          if (!newName) throw new Error("Vui lòng nhập tên cho hạng mục mới.");
          const newIcon = data.get("newCategoryIcon") || "box";
          const newId = slugify(newName) || "cat-" + Date.now();
          if (!categoriesList.some(c => c.id === newId)) {
            const newCat = { id: newId, name: newName, icon: newIcon };
            if (currentUser && currentUser.role === "partner") {
              newCat.partnerEmail = currentUser.email.toLowerCase();
            }
            categoriesList.push(newCat);
            const res = await api("/api/admin/categories", { method: "PUT", body: JSON.stringify({ categories: categoriesList }) });
            if (res && res.categories) categoriesList = res.categories;
          }
          category = newId;
        }
        const badge = data.get("badge").trim();
        const description = data.get("description").trim();
        const detail = (data.get("detail") || "").trim() || description;
        const featuresText = (data.get("featuresText") || "").trim();
        const features = featuresText
          ? featuresText.split("\n").map(s => s.trim().replace(/^[✓\-\*]\s*/, "")).filter(Boolean).slice(0, 10)
          : [];
        const editImagePreset = (data.get("imagePreset") || "").trim() || "assets/nitro.svg";
        let editImage = editImagePreset;
        if (editImagePreset === "__custom__") {
          const customUrl = (data.get("customImageUrl") || "").trim();
          if (!customUrl) throw new Error("Vui lòng nhập link ảnh hoặc tải ảnh từ máy lên.");
          editImage = customUrl;
        }
        const partnerEmail = currentUser.role === "partner"
          ? currentUser.email
          : ((data.get("partnerEmail") || "").trim() || null);
        await api("/api/admin/products/" + productId, {
          method: "PUT",
          body: JSON.stringify({ name, category, badge, description, image: editImage, partnerEmail, detail, features }),
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
    } catch (error) {
      if (message) message.textContent = error.message;
      else notify(error.message);
    }
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
        if (event.target.id === "bank-auto-credit-toggle") {
          const statusText = document.querySelector("#auto-credit-status-text");
          const badge = document.querySelector("#auto-credit-badge");
          if (statusText) {
            statusText.textContent = event.target.checked ? "Tự động cộng tiền: BẬT" : "Tự động cộng tiền: TẮT (Duyệt tay)";
            statusText.className = event.target.checked ? "status-active" : "status-inactive";
          }
          if (badge) {
            badge.textContent = event.target.checked ? "Đang bật Tự động" : "Đang tắt (Duyệt tay)";
            badge.className = event.target.checked ? "auto-credit-live-badge" : "auto-credit-live-badge disabled";
          }
        }
        if (event.target.id === "admin-guide-active") {
          const statusText = document.querySelector("#admin-guide-active-label");
          if (statusText) {
            statusText.textContent = event.target.checked ? "Đang bật hiển thị" : "Tạm ẩn";
            statusText.className = event.target.checked ? "status-active" : "status-inactive";
          }
        }
        if (event.target.dataset.productPos) {
          setProductPosition(event.target.dataset.productPos, Number(event.target.value));
        }
        if (event.target.id === "product-category-select") {
          const wrap = document.querySelector("#new-cat-inline-wrap");
          if (wrap) wrap.style.display = event.target.value === "__custom__" ? "block" : "none";
        }
        if (event.target.id === "product-image-select") {
          const wrap = document.querySelector("#product-custom-image-wrap");
          const preview = document.querySelector("#product-image-live-preview");
          if (wrap) wrap.style.display = event.target.value === "__custom__" ? "block" : "none";
          if (event.target.value !== "__custom__" && preview) {
            preview.src = event.target.value;
          } else if (preview) {
            const customInput = document.querySelector("#product-custom-image-input");
            preview.src = (customInput && customInput.value.trim()) || "assets/nitro.svg";
          }
        }
        if (event.target.id === "product-image-file-input") {
          const file = event.target.files && event.target.files[0];
          if (!file) return;
          const preview = document.querySelector("#product-image-live-preview");
          const customInput = document.querySelector("#product-custom-image-input");
          const reader = new FileReader();
          reader.onload = (loadEvt) => {
            const dataUrl = loadEvt.target.result;
            if (file.type === "image/svg+xml") {
              if (customInput) customInput.value = dataUrl;
              if (preview) preview.src = dataUrl;
              return;
            }
            const img = new Image();
            img.onload = () => {
              const maxDim = 320;
              let w = img.width, h = img.height;
              if (w > maxDim || h > maxDim) {
                if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
                else { w = Math.round((w * maxDim) / h); h = maxDim; }
              }
              const canvas = document.createElement("canvas");
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext("2d");
              ctx.drawImage(img, 0, 0, w, h);
              const compressedUrl = canvas.toDataURL("image/webp", 0.85) || canvas.toDataURL("image/png");
              if (customInput) customInput.value = compressedUrl;
              if (preview) preview.src = compressedUrl;
            };
            img.src = dataUrl;
          };
          reader.readAsDataURL(file);
        }
      });
      document.addEventListener("input", event => {
        if (event.target.id === "product-custom-image-input") {
          const preview = document.querySelector("#product-image-live-preview");
          if (preview) {
            preview.src = event.target.value.trim() || "assets/nitro.svg";
          }
        }
        if (event.target.id === "product-features-input") {
          const preview = document.querySelector("#product-features-live-preview");
          if (preview) {
            preview.innerHTML = renderFeaturesPreviewHtml(event.target.value);
          }
        }
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
        if (button.dataset.depositSimulate) {
          const code = button.dataset.depositSimulate;
          if (!confirm(`Thử nghiệm tự động cộng tiền cho yêu cầu ${code}?\nHệ thống sẽ giả lập webhook từ ngân hàng và tự động cộng tiền vào ví khách hàng.`)) return;
          button.disabled = true;
          try {
            await api("/api/admin/deposits/simulate", {
              method: "POST",
              body: JSON.stringify({ code }),
            });
            notify(`⚡ Đã giả lập nạp tiền thành công cho mã ${code}! Số dư đã được tự động cộng vào ví.`);
            await load();
          } catch (err) {
            notify(err.message);
          } finally {
            button.disabled = false;
          }
        }
        if (button.id === "btn-copy-webhook-url") {
          const urlInput = document.querySelector("#webhook-url-display");
          if (urlInput) {
            navigator.clipboard.writeText(urlInput.value).then(() => {
              notify("Đã sao chép URL Webhook vào khay nhớ tạm!");
            }).catch(() => {
              urlInput.select();
              document.execCommand("copy");
              notify("Đã sao chép URL Webhook!");
            });
          }
        }
        if (button.id === "btn-gen-webhook-secret") {
          const secretInput = document.querySelector("#webhook-secret-input");
          if (secretInput) {
            const rand = Array.from(crypto.getRandomValues(new Uint8Array(16)))
              .map(b => b.toString(16).padStart(2, "0"))
              .join("");
            secretInput.value = "vnl_sec_" + rand;
            notify("Đã tạo API Key ngẫu nhiên! Hãy bấm 'Lưu cấu hình' để áp dụng.");
          }
        }
        if (button.id === "btn-copy-webhook-secret") {
          const secretInput = document.querySelector("#webhook-secret-input");
          if (secretInput && secretInput.value) {
            navigator.clipboard.writeText(secretInput.value).then(() => {
              notify("Đã sao chép API Key vào khay nhớ tạm!");
            }).catch(() => {
              secretInput.select();
              document.execCommand("copy");
              notify("Đã sao chép API Key!");
            });
          } else {
            notify("Chưa có API Key để sao chép. Hãy nhập hoặc tạo ngẫu nhiên!");
          }
        }
        if (button.dataset.depositQr) {
          openQrModal(button.dataset.qrUrl, button.dataset.qrCode, Number(button.dataset.qrAmount));
        }
        if (button.dataset.productUp) {
          moveProduct(button.dataset.productUp, -1);
        }
        if (button.dataset.productDown) {
          moveProduct(button.dataset.productDown, 1);
        }
        if (button.hasAttribute("data-categories-manage")) {
          const fromPid = button.getAttribute("data-categories-manage");
          openCategoriesManager(fromPid || null);
        }
        if (button.hasAttribute("data-cat-mgr-close")) {
          if (returnToProductId) {
            const pid = returnToProductId;
            returnToProductId = null;
            openProductEditor(pid === "new" ? null : pid);
          } else {
            $("#catalog-editor").replaceChildren();
          }
        }
        if (button.dataset.catEdit) {
          const cId = button.dataset.catEdit;
          const targetCat = categoriesList.find(c => c.id === cId);
          if (currentUser?.role === "partner" && targetCat) {
            const isOwned = targetCat.partnerEmail && targetCat.partnerEmail.toLowerCase() === currentUser.email.toLowerCase();
            if (!isOwned) {
              notify("Bạn chỉ có quyền sửa hạng mục do chính mình tạo.");
              return;
            }
          }
          editingCategoryId = cId;
          openCategoriesManager();
        }
        if (button.hasAttribute("data-cat-cancel")) {
          editingCategoryId = null;
          openCategoriesManager();
        }
        if (button.dataset.catSave) {
          const cId = button.dataset.catSave;
          const nameInput = document.querySelector("#cat-edit-name-input");
          const iconSelect = document.querySelector("#cat-edit-icon-select");
          const newName = nameInput ? nameInput.value.trim() : "";
          if (!newName) {
            notify("Tên hạng mục không được để trống.");
            return;
          }
          const newIcon = iconSelect ? iconSelect.value : "box";
          const cat = categoriesList.find(c => c.id === cId);
          if (cat) {
            if (currentUser?.role === "partner") {
              const isOwned = cat.partnerEmail && cat.partnerEmail.toLowerCase() === currentUser.email.toLowerCase();
              if (!isOwned) {
                notify("Bạn chỉ có quyền sửa hạng mục do chính mình tạo.");
                return;
              }
            }
            cat.name = newName;
            cat.icon = newIcon;
            button.disabled = true;
            try {
              const res = await api("/api/admin/categories", { method: "PUT", body: JSON.stringify({ categories: categoriesList }) });
              if (res && res.categories) categoriesList = res.categories;
              notify(`Đã cập nhật hạng mục "${newName}"!`);
              editingCategoryId = null;
              openCategoriesManager();
            } catch (err) {
              notify(err.message);
            } finally {
              button.disabled = false;
            }
          }
        }
        if (button.dataset.filterCat) {
          adminCategoryFilter = button.dataset.filterCat;
          render();
        }
        if (button.dataset.catUp) {
          const cId = button.dataset.catUp;
          const idx = categoriesList.findIndex(c => c.id === cId);
          if (idx > 0) {
            const item = categoriesList.splice(idx, 1)[0];
            categoriesList.splice(idx - 1, 0, item);
            const res = await api("/api/admin/categories", { method: "PUT", body: JSON.stringify({ categories: categoriesList }) });
            if (res && res.categories) categoriesList = res.categories;
            notify("Đã cập nhật thứ tự hạng mục.");
            openCategoriesManager();
          }
        }
        if (button.dataset.catDown) {
          const cId = button.dataset.catDown;
          const idx = categoriesList.findIndex(c => c.id === cId);
          if (idx >= 0 && idx < categoriesList.length - 1) {
            const item = categoriesList.splice(idx, 1)[0];
            categoriesList.splice(idx + 1, 0, item);
            const res = await api("/api/admin/categories", { method: "PUT", body: JSON.stringify({ categories: categoriesList }) });
            if (res && res.categories) categoriesList = res.categories;
            notify("Đã cập nhật thứ tự hạng mục.");
            openCategoriesManager();
          }
        }
        if (button.dataset.catDelete) {
          const cId = button.dataset.catDelete;
          const cat = categoriesList.find(c => c.id === cId);
          if (currentUser?.role === "partner" && cat) {
            const isOwned = cat.partnerEmail && cat.partnerEmail.toLowerCase() === currentUser.email.toLowerCase();
            if (!isOwned) {
              notify("Bạn không có quyền xóa hạng mục mặc định hoặc của đối tác khác.");
              return;
            }
          }
          if (!confirm("Bạn có chắc chắn muốn xóa hạng mục này?")) return;
          button.disabled = true;
          try {
            const filteredList = categoriesList.filter(c => c.id !== cId);
            const res = await api("/api/admin/categories", { method: "PUT", body: JSON.stringify({ categories: filteredList }) });
            if (res && res.categories) categoriesList = res.categories;
            notify("Đã xóa hạng mục.");
            openCategoriesManager();
          } catch (err) {
            notify(err.message);
          } finally {
            button.disabled = false;
          }
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
        if (button.hasAttribute("data-partner-new")) openPartnerEditor();
        if (button.dataset.partnerToggle) {
          const pId = button.dataset.partnerToggle;
          const target = partnersList.find(x => x.id === pId);
          if (!target) return;
          button.disabled = true;
          try {
            await api(`/api/admin/partners/${pId}/toggle`, {
              method: "PATCH",
              body: JSON.stringify({ isActive: !target.isActive }),
            });
            notify(target.isActive ? "Đã khóa quyền đối tác." : "Đã mở khóa đối tác.");
            await load();
          } catch (err) {
            notify(err.message);
          } finally {
            button.disabled = false;
          }
        }
        if (button.dataset.partnerDelete) {
          const pId = button.dataset.partnerDelete;
          const pName = button.dataset.name || "đối tác";
          const pEmail = button.dataset.email || "";
          if (!confirm(`Bạn có chắc chắn muốn gỡ quyền đối tác của ${pName} (${pEmail})?\nTài khoản đối tác sẽ bị hủy bỏ và phiên đăng nhập sẽ kết thúc.`)) return;
          button.disabled = true;
          try {
            await api(`/api/admin/partners/${pId}`, { method: "DELETE" });
            notify("Đã gỡ quyền đối tác thành công.");
            await load();
          } catch (err) {
            notify(err.message);
          } finally {
            button.disabled = false;
          }
        }
      });
    }
    await load();
  };
})();

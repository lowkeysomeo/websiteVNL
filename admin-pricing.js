// Giao diện giá, ưu đãi và nạp tiền QR dùng chung phiên đăng nhập của trang quản trị.
window.initAdminPricing = (() => {
  let api, notify, products = [], promotions = [], bankSettings = { bank: {}, isActive: false }, depositsList = [], depositFilter = "all", depositSearch = "", guideData = null, guidesList = [], guideFilter = "all", guideSearch = "", categoriesList = [
    { id: "services", name: "Dịch vụ Discord", icon: "discord" },
    
    { id: "entertainment", name: "Giải trí", icon: "entertainment" },
    { id: "creative", name: "Sáng tạo", icon: "lightbulb" },
  ], partnersList = [], contactsSettings = { enabled: true, items: [] }, currentUser = { role: "admin", email: "", name: "" }, adminCategoryFilter = "all", currentView = "orders", initialized = false, loaded = false, editingCategoryId = null, returnToProductId = null;
  const guideCategoryLabels = { guide: "Hướng dẫn", tips: "Mẹo & Thủ thuật", news: "Tin tức", other: "Khác" };
  const $ = (selector) => document.querySelector(selector);
  const formatCurrencyNumber = n => new Intl.NumberFormat("vi-VN").format(Number(n) || 0);
  const money = n => formatCurrencyNumber(n) + "đ";
  const moneyText = n => formatCurrencyNumber(n) + "đ";
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
          <iframe src="${esc(videoEmbed.embedUrl)}" title="Xem trước video hướng dẫn" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; flex-wrap:wrap; gap:8px;">
          <small class="video-preview-badge">✓ Đã nhận diện video YouTube</small>
          <a href="https://www.youtube.com/watch?v=${esc(videoEmbed.id)}" target="_blank" rel="noopener noreferrer" style="font-size:12px; color:var(--admin-accent,#a855f7); text-decoration:underline;">Mở xem trên YouTube ↗</a>
        </div>
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
        <iframe src="${esc(videoEmbed.src)}" title="Xem trước video hướng dẫn" frameborder="0" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
      </div>
    `;
  }

  function compressImageFile(file, maxDim = 1280, quality = 0.85) {
    return new Promise((resolve) => {
      if (!file) return resolve("");
      if (file.type === "image/svg+xml") {
        const reader = new FileReader();
        reader.onload = (loadEvt) => resolve(loadEvt.target.result);
        reader.onerror = () => resolve("");
        reader.readAsDataURL(file);
        return;
      }
      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        const dataUrl = loadEvt.target.result;
        const img = new Image();
        img.onload = () => {
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
          const compressed = canvas.toDataURL("image/webp", quality) || canvas.toDataURL("image/jpeg", quality) || dataUrl;
          resolve(compressed);
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      };
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });
  }

  function renderImagesPreviewHtml(images, coverImageUrl = "") {
    const valid = (images || []).filter(url => Boolean(url && url.trim()));
    if (!valid.length) {
      return `
        <div class="guide-media-empty">
          <span>🖼️</span>
          <p style="margin-bottom: 8px;">Chưa có hình ảnh minh họa.</p>
          <div style="display:flex; gap:8px; justify-content:center; flex-wrap:wrap;">
            <label class="button primary btn-xs" style="cursor:pointer; display:inline-flex; align-items:center; gap:5px;" title="Tải ảnh từ máy tính hoặc điện thoại">
              📁 Tải ảnh từ máy
              <input type="file" id="guide-image-file-empty-input" accept="image/*" multiple style="display:none;" />
            </label>
            <button type="button" class="button secondary btn-xs" id="btn-guide-add-default-empty">
              ✨ Thêm Banner VNL
            </button>
          </div>
        </div>
      `;
    }
    const cleanCover = (coverImageUrl || "").trim();
    return `
      <div class="guide-images-grid-preview">
        ${valid.map((img, idx) => {
          const isCover = Boolean(cleanCover && img.trim() === cleanCover);
          return `
            <div class="guide-image-preview-item" data-guide-img-idx="${idx}">
              <img src="${esc(img.trim())}" alt="Xem trước ảnh ${idx + 1}" onerror="this.parentElement.innerHTML='<span class=img-err>Ảnh lỗi</span>'" />
              <span class="guide-img-badge ${isCover ? 'is-cover' : ''}">${isCover ? '⭐ Ảnh bìa' : `Ảnh ${idx + 1}`}</span>
              <div class="guide-img-overlay">
                <button type="button" class="guide-img-btn guide-img-btn-replace" data-guide-img-action="replace" data-index="${idx}" title="Thay đổi ảnh này">
                  🔄 Đổi ảnh
                </button>
                ${!isCover ? `
                  <button type="button" class="guide-img-btn guide-img-btn-cover" data-guide-img-action="set-cover" data-index="${idx}" title="Đặt làm ảnh bìa bài viết">
                    ⭐ Làm bìa
                  </button>
                ` : ''}
                <button type="button" class="guide-img-btn guide-img-btn-remove" data-guide-img-action="remove" data-index="${idx}" title="Xóa ảnh này">
                  ✕ Xóa
                </button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; width:100%; margin-top:8px; flex-wrap:wrap; gap:4px;">
        <small class="image-preview-badge" style="margin:0;">✓ Hiển thị ${valid.length} hình ảnh</small>
        <small style="color:var(--muted); font-size:11px;">💡 Rê chuột vào ảnh để Đổi ảnh, Đặt làm bìa hoặc Xóa</small>
      </div>
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
      const [pricingData, bankData, depositsData, guideRes, partnersRes, contactsRes] = await Promise.all([
        api("/api/admin/pricing"),
        api("/api/admin/bank").catch(() => ({ settings: { bank: {}, isActive: false } })),
        api("/api/admin/deposits?limit=100").catch(() => ({ deposits: [] })),
        api("/api/admin/guide").catch(() => ({ guide: null, guides: [] })),
        api("/api/admin/partners").catch(() => ({ partners: [] })),
        api("/api/admin/contacts").catch(() => ({ settings: { enabled: true, items: [] } })),
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
      contactsSettings = contactsRes?.settings || { enabled: true, items: [] };
      render();
    } catch (error) {
      panel.innerHTML = `<p class="admin-error-msg" role="alert">${esc(error.message)}</p><button type="button" class="button secondary" data-pricing-reload>Tải lại dữ liệu</button>`;
    }
  }

  let partnersRefreshing = false;
  async function refreshPartners() {
    const canRefresh = () => currentView === "partners" && currentUser.role === "admin"
      && !document.hidden && !$("#admin-app")?.hidden
      && !$("#catalog-editor")?.firstElementChild;
    if (partnersRefreshing || !loaded || !canRefresh()) return;
    partnersRefreshing = true;
    const requestApi = api;
    try {
      const result = await requestApi("/api/admin/partners");
      if (api !== requestApi || !canRefresh()) return;
      partnersList = Array.isArray(result.partners) ? result.partners : partnersList;
      render();
    } catch { /* Giữ số liệu gần nhất khi mất kết nối. */ }
    finally { partnersRefreshing = false; }
  }

  let depositsRefreshing = false;
  async function refreshDeposits(isSilent = false, force = false) {
    const canRefresh = () => !$("#admin-app")?.hidden && (force || !document.hidden);
    if (depositsRefreshing || !loaded || !canRefresh()) return;
    depositsRefreshing = true;
    const requestApi = api;
    try {
      const result = await requestApi("/api/admin/deposits?limit=100");
      if (api !== requestApi || !result || !Array.isArray(result.deposits)) return;
      const incomingDeposits = result.deposits;
      const currentIds = new Set(depositsList.map(d => d.id || d.code));
      const newDeposits = incomingDeposits.filter(d => !currentIds.has(d.id || d.code));

      let hasChanges = newDeposits.length > 0 || incomingDeposits.length !== depositsList.length;
      if (!hasChanges) {
        for (let i = 0; i < incomingDeposits.length; i++) {
          if (incomingDeposits[i].code !== depositsList[i].code || incomingDeposits[i].status !== depositsList[i].status) {
            hasChanges = true;
            break;
          }
        }
      }

      if (hasChanges) {
        if (newDeposits.length > 0) {
          for (const newD of newDeposits) {
            newD._isNew = true;
            if (!isSilent) {
              if (typeof notify === "function") {
                notify(`💳 YÊU CẦU NẠP MỚI: ${esc(newD.code)} · ${money(newD.amount)} (${esc(newD.userEmail || "Khách")})!`);
              }
              if (typeof window.playAdminChime === "function") {
                window.playAdminChime("deposit");
              }
            }
            setTimeout(() => {
              newD._isNew = false;
              const el = document.querySelector(`.deposit-item-card[data-deposit-code="${newD.code}"]`);
              if (el) el.classList.remove("deposit-just-arrived");
            }, 6000);
          }
        }

        depositsList = incomingDeposits;

        if (currentView === "deposits") {
          const container = $("#deposit-cards-container");
          if (container) {
            const bank = bankSettings.bank || {};
            const filtered = depositsList.filter(d => {
              if (depositFilter !== "all" && d.status !== depositFilter) return false;
              if (depositSearch) {
                const matchCode = d.code.toLowerCase().includes(depositSearch);
                const matchEmail = (d.userEmail || "").toLowerCase().includes(depositSearch);
                if (!matchCode && !matchEmail) return false;
              }
              return true;
            });
            container.innerHTML = renderDepositCardsHtml(filtered, bank);
            const tabs = document.querySelector(".deposit-filter-tabs");
            if (tabs) {
              tabs.innerHTML = `
                <button class="admin-tab ${depositFilter === 'all' ? 'active' : ''}" data-deposit-filter="all">Tất cả (${depositsList.length})</button>
                <button class="admin-tab ${depositFilter === 'pending' ? 'active' : ''}" data-deposit-filter="pending">Chờ chuyển (${depositsList.filter(d => d.status === 'pending').length})</button>
                <button class="admin-tab ${depositFilter === 'credited' ? 'active' : ''}" data-deposit-filter="credited">Đã cộng tiền (${depositsList.filter(d => d.status === 'credited').length})</button>
                <button class="admin-tab ${depositFilter === 'review' ? 'active' : ''}" data-deposit-filter="review">Cần đối soát (${depositsList.filter(d => d.status === 'review').length})</button>
                <button class="admin-tab ${depositFilter === 'expired' ? 'active' : ''}" data-deposit-filter="expired">Hết hạn / Hủy (${depositsList.filter(d => d.status === 'expired').length})</button>
              `;
            }
          }
        }
      }
    } catch {
      // background retry
    } finally {
      depositsRefreshing = false;
    }
  }
  window.refreshAdminDeposits = refreshDeposits;

  function switchView(view) {
    currentView = view;
    $("#admin-orders-view").hidden = view !== "orders" && view !== "discord";
    $("#admin-pricing-view").hidden = view === "orders" || view === "discord";
    document.querySelectorAll("[data-admin-view]").forEach(button => {
      button.classList.toggle("active", button.dataset.adminView === view);
      button.setAttribute("aria-pressed", String(button.dataset.adminView === view));
    });

    const annCard = $("#admin-announcement-card");
    const discordCard = $("#admin-discord-card");
    const controls = document.querySelector(".admin-controls");
    const ordersContainer = document.querySelector(".admin-orders-container");

    if (view === "discord") {
      if (annCard) annCard.hidden = true;
      if (discordCard) discordCard.hidden = false;
      if (controls) controls.hidden = true;
      if (ordersContainer) ordersContainer.hidden = true;
    } else if (view === "orders") {
      const isPartner = sessionStorage.getItem("vnl_admin_role") === "partner";
      if (annCard) annCard.hidden = isPartner;
      if (discordCard) discordCard.hidden = false;
      if (controls) controls.hidden = false;
      if (ordersContainer) ordersContainer.hidden = false;
    }

    if (view !== "orders" && view !== "discord") render();
    if (view === "partners") void refreshPartners();
    if (view === "deposits") void refreshDeposits(true, true);
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
    if (catId === "decor") return "Dịch vụ Discord";
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

  const CATEGORY_ICON_PRESETS = [
    { value: "cart", label: "🛒 Giỏ hàng / Mua sắm (cart)", emoji: "🛒" },
    { value: "discord", label: "💬 Discord / Dịch vụ (discord)", emoji: "💬" },
    { value: "decor", label: "👤 Profile Decor / Avatar (decor)", emoji: "👤" },
    { value: "lightbulb", label: "💡 Bóng đèn / Sáng tạo (lightbulb)", emoji: "💡" },
    { value: "box", label: "📦 Hộp quà / Dịch vụ (box)", emoji: "📦" },
    { value: "gamepad", label: "🎮 Tay cầm Game / Giải trí (gamepad)", emoji: "🎮" },
    { value: "entertainment", label: "🎬 Phim ảnh / Giải trí (entertainment)", emoji: "🎬" },
    { value: "layers", label: "📚 Gói xếp lớp / Hạng mục (layers)", emoji: "📚" },
    { value: "sparkles", label: "✨ Ngôi sao / Sáng tạo (sparkles)", emoji: "✨" },
    { value: "grid", label: "🔲 Lưới / Tổng hợp (grid)", emoji: "🔲" },
    { value: "headphones", label: "🎧 Âm nhạc / Hỗ trợ (headphones)", emoji: "🎧" },
    { value: "book", label: "📖 Sách / Hướng dẫn (book)", emoji: "📖" },
    { value: "bolt", label: "Tia chớp / Nạp tốc hành (bolt)", emoji: "⚡" },
    { value: "shield", label: "🛡️ Bảo mật / Bản quyền (shield)", emoji: "🛡️" },
    { value: "diamond", label: "💎 Kim cương / Cao cấp (diamond)", emoji: "💎" },
    { value: "crown", label: "👑 Vương miện / Đặc quyền (crown)", emoji: "👑" },
    { value: "fire", label: "🔥 Thịnh hành / Hot trend (fire)", emoji: "🔥" },
    { value: "rocket", label: "🚀 Tăng tốc / Boost (rocket)", emoji: "🚀" },
    { value: "bot", label: "🤖 AI / Bot tự động (bot)", emoji: "🤖" },
    { value: "code", label: "💻 Phần mềm / Kỹ thuật (code)", emoji: "💻" },
    { value: "palette", label: "🎨 Thiết kế / Đồ họa (palette)", emoji: "🎨" },
    { value: "heart", label: "❤️ Yêu thích / Yêu chuộng (heart)", emoji: "❤️" },
    { value: "gift", label: "🎁 Quà tặng / Gift card (gift)", emoji: "🎁" },
    { value: "key", label: "🔑 Bản quyền / Key kích hoạt (key)", emoji: "🔑" },
    { value: "globe", label: "🌐 Mạng xã hội / Web (globe)", emoji: "🌐" },
    { value: "none", label: "⭕ Không dùng biểu tượng (Chỉ hiện chữ)", emoji: "⭕" },
  ];

  const QUICK_EMOJIS = ["⚡", "💎", "👑", "🛡️", "🤖", "🚀", "🔥", "🎯", "🎨", "🎵", "💻", "⭐", "🎁", "🔑", "🌟", "🏆", "💼", "🎉", "🍀", "💖"];

  function getCategoryEmoji(iconVal) {
    if (!iconVal || iconVal === "none") return "";
    const preset = CATEGORY_ICON_PRESETS.find(p => p.value === iconVal);
    if (preset) return preset.emoji;
    return iconVal;
  }

  const DELIVERY_TYPE_PRESETS = [
    { value: "gift", label: "🎁 Link quà tặng (Gift)", badge: "🎁 Gift", class: "gift-sm" },
    { value: "log", label: "🔑 Đăng nhập nạp (Log / Cần tài khoản)", badge: "🔑 Log", class: "log-sm" },
    { value: "key", label: "🗝️ Gửi mã / Key kích hoạt (Key / Code)", badge: "🗝️ Key", class: "key-sm" },
    { value: "account", label: "👤 Cấp tài khoản tạo sẵn (Acc cấp sẵn)", badge: "👤 Acc", class: "acc-sm" },
    { value: "invite", label: "✉️ Mời qua Email / Gia đình (Invite link)", badge: "✉️ Invite", class: "invite-sm" },
    { value: "bot", label: "🤖 Nạp tự động qua Bot (Bot Command)", badge: "🤖 Bot", class: "bot-sm" },
    { value: "file", label: "📁 Gửi file / Tài liệu tải về (File download)", badge: "📁 File", class: "file-sm" },
    { value: "service", label: "🛠️ Tư vấn riêng / Liên hệ trao đổi", badge: "🛠️ Service", class: "service-sm" },
  ];

  const QUICK_DELIVERY_SUGGESTIONS = [
    "🗝️ Key bản quyền",
    "👤 Acc cấp sẵn",
    "✉️ Mời Email",
    "🤖 Bot nạp tự động",
    "📁 File tải về",
    "🌐 Link web kích hoạt",
    "🎫 Ticket Discord",
    "📦 Giao qua Zalo/Telegram",
  ];

  function getDeliveryBadgeInfo(type) {
    const preset = DELIVERY_TYPE_PRESETS.find(p => p.value === type);
    if (preset) return { label: preset.badge, class: preset.class };
    if (!type || type === "gift") return { label: "🎁 Gift", class: "gift-sm" };
    return { label: `📦 ${type}`, class: "custom-delivery-sm" };
  }

  function renderDeliveryTypeFieldHtml(currentDeliveryType = "gift") {
    const isKnown = DELIVERY_TYPE_PRESETS.some(p => p.value === currentDeliveryType);
    const isCustom = Boolean(currentDeliveryType && !isKnown);
    const selectedPreset = isCustom ? "__custom__" : (currentDeliveryType || "gift");

    return `
      <label>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span>Hình thức nhận hàng *</span>
          <span style="font-size:11px; color:var(--muted);">Có sẵn hoặc tự chỉnh riêng</span>
        </div>
        <select name="deliveryPreset" class="delivery-type-select">
          ${DELIVERY_TYPE_PRESETS.map(p => `<option value="${p.value}" ${selectedPreset === p.value ? "selected" : ""}>${p.label}</option>`).join("")}
          <option value="__custom__" ${isCustom ? "selected" : ""}>✨ + Tự nhập hình thức nhận quà / nhận hàng riêng...</option>
        </select>
      </label>
      <div class="custom-delivery-wrap" style="${isCustom ? 'display:block;' : 'display:none;'} grid-column:1 / -1; margin-top:-4px; background:rgba(217,119,6,0.08); border:1px dashed var(--accent); padding:10px 14px; border-radius:8px;">
        <label style="color:var(--accent); font-size:11px; font-weight:600; display:block; margin-bottom:4px;">
          ✨ NHẬP HÌNH THỨC NHẬN HÀNG TÙY CHỈNH:
        </label>
        <input name="customDeliveryType" class="custom-delivery-input" placeholder="VD: Nhận qua Ticket Discord, Link Drive, QR Code..." value="${isCustom ? esc(currentDeliveryType) : ''}" maxlength="50" style="width:100%; padding:6px 10px; font-size:13px; background:var(--bg-card); color:var(--text); border:1px solid var(--line); border-radius:6px;" />
        <div style="margin-top:8px; display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
          <span style="font-size:11px; color:var(--muted); font-weight:600;">Gợi ý nhanh:</span>
          ${QUICK_DELIVERY_SUGGESTIONS.map(sug => `<button type="button" class="button secondary btn-xs btn-delivery-sug-pick" data-val="${esc(sug)}" style="padding:2px 7px; font-size:11px; line-height:1;">${esc(sug)}</button>`).join("")}
        </div>
      </div>
    `;
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
              const isCustomCatIcon = Boolean(cat.icon && !CATEGORY_ICON_PRESETS.some(p => p.value === cat.icon));

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
                    ${!isPartner ? `
                    <div style="flex:1; min-width:180px;">
                      <label style="font-size:10px; color:var(--accent); font-weight:600; display:block; margin-bottom:3px;">ĐỐI TÁC SỞ HỮU</label>
                      <select id="cat-edit-partner-select" style="width:100%; padding:6px 10px; font-size:12px; background:var(--bg-card); color:var(--text); border:1px solid var(--line); border-radius:6px;">
                        <option value="">-- Cửa hàng chính (VNL Admin) --</option>
                        ${partnersList.map(pt => `<option value="${esc(pt.email)}" ${(cat.partnerEmail || "").toLowerCase() === pt.email.toLowerCase() ? "selected" : ""}>${esc(pt.name)} (${esc(pt.email)})</option>`).join("")}
                      </select>
                    </div>
                    ` : ""}
                    <div style="flex:1; min-width:240px;">
                      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
                        <label style="font-size:10px; color:var(--accent); font-weight:600; margin:0;">BIỂU TƯỢNG (ICON)</label>
                        <span style="font-size:10px; color:var(--muted);">Tùy chọn icon / emoji</span>
                      </div>
                      <select id="cat-edit-icon-select" style="width:100%; padding:6px 10px; font-size:12px; background:var(--bg-card); color:var(--text); border:1px solid var(--line); border-radius:6px;">
                        ${CATEGORY_ICON_PRESETS.map(p => `<option value="${p.value}" ${(!isCustomCatIcon && cat.icon === p.value) ? "selected" : ""}>${p.label}</option>`).join("")}
                        <option value="__custom__" ${isCustomCatIcon ? "selected" : ""}>✨ + Tùy chọn icon / emoji riêng...</option>
                      </select>
                      <div id="cat-edit-custom-icon-wrap" style="${isCustomCatIcon ? 'display:block;' : 'display:none;'} margin-top:6px; background:rgba(217,119,6,0.08); border:1px dashed var(--accent); padding:8px 10px; border-radius:6px;">
                        <label style="color:var(--accent); font-size:10px; font-weight:600; display:block; margin-bottom:4px;">
                          ✨ TỰ NHẬP EMOJI HOẶC BIỂU TƯỢNG TÙY CHỌN:
                        </label>
                        <div style="display:flex; gap:8px; align-items:center;">
                          <input id="cat-edit-custom-icon-input" value="${isCustomCatIcon ? esc(cat.icon) : ''}" placeholder="Nhập emoji hoặc icon..." maxlength="30" style="flex:1; padding:5px 8px; font-size:12px; background:var(--bg-card); color:var(--text); border:1px solid var(--line); border-radius:4px;" />
                          <span id="cat-edit-icon-preview" style="font-size:16px;">${isCustomCatIcon ? esc(cat.icon) : '📦'}</span>
                        </div>
                        <div style="margin-top:6px; display:flex; gap:4px; align-items:center; flex-wrap:wrap;">
                          <span style="font-size:10px; color:var(--muted);">Chọn nhanh:</span>
                          ${QUICK_EMOJIS.slice(0, 10).map(em => `<button type="button" class="button secondary btn-xs btn-emoji-pick" data-target-input="#cat-edit-custom-icon-input" data-target-preview="#cat-edit-icon-preview" data-emoji="${em}" style="padding:1px 5px; font-size:12px; line-height:1;">${em}</button>`).join("")}
                        </div>
                      </div>
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
                    <strong class="cat-name-display"><span class="cat-icon-symbol" style="font-size:14px; margin-right:4px;">${esc(getCategoryEmoji(cat.icon))}</span>${esc(cat.name)}</strong>
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
            ${!isPartner ? `
            <label>Đối tác sở hữu (Tùy chọn)
              <select name="catPartnerEmail">
                <option value="">-- Cửa hàng chính (VNL Admin) --</option>
                ${partnersList.map(pt => `<option value="${esc(pt.email)}">${esc(pt.name)} (${esc(pt.email)})</option>`).join("")}
              </select>
            </label>
            ` : ""}
            <label>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <span>Biểu tượng (Icon)</span>
                <span style="font-size:11px; color:var(--muted);">Tùy chọn icon / emoji riêng</span>
              </div>
              <select name="catIconPreset" id="cat-add-icon-select">
                ${CATEGORY_ICON_PRESETS.map(p => `<option value="${p.value}" ${p.value === "box" ? "selected" : ""}>${p.label}</option>`).join("")}
                <option value="__custom__">✨ + Tùy chọn icon / emoji riêng...</option>
              </select>
            </label>
            <div id="cat-add-custom-icon-wrap" style="display:none; grid-column:1 / -1; margin-top:-4px; background:rgba(217,119,6,0.08); border:1px dashed var(--accent); padding:10px 14px; border-radius:8px;">
              <label style="color:var(--accent); font-size:11px; font-weight:600; display:block; margin-bottom:4px;">
                ✨ NHẬP EMOJI HOẶC BIỂU TƯỢNG TÙY CHỌN (VD: ⚡, 💎, 👑, 🤖, 🎨, ...)
              </label>
              <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                <input id="cat-add-custom-icon-input" name="catCustomIcon" placeholder="Nhập emoji hoặc tên icon..." maxlength="30" style="flex:1; min-width:180px; padding:6px 10px; font-size:13px; background:var(--bg-card); color:var(--text); border:1px solid var(--line); border-radius:6px;" />
                <div style="display:flex; align-items:center; gap:6px; font-size:11px; color:var(--muted);">
                  <span>Xem trước:</span>
                  <span id="cat-add-icon-preview" style="font-size:18px; line-height:1; min-width:24px; text-align:center;">📦</span>
                </div>
              </div>
              <div style="margin-top:8px; display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                <span style="font-size:11px; color:var(--muted); font-weight:600;">Chọn nhanh emoji:</span>
                ${QUICK_EMOJIS.map(em => `<button type="button" class="button secondary btn-xs btn-emoji-pick" data-target-input="#cat-add-custom-icon-input" data-target-preview="#cat-add-icon-preview" data-emoji="${em}" style="padding:2px 7px; font-size:13px; line-height:1;">${em}</button>`).join("")}
              </div>
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

  async function saveContactsToServer(successMsg = "Đã lưu cài đặt liên hệ!") {
    const toggle = document.querySelector("#contacts-enabled-toggle");
    if (toggle) {
      contactsSettings.enabled = toggle.checked;
    }
    const res = await api("/api/admin/contacts", {
      method: "PUT",
      body: JSON.stringify({
        enabled: contactsSettings.enabled !== false,
        items: contactsSettings.items || [],
      }),
    });
    if (res && res.settings) {
      contactsSettings = res.settings;
    }
    notify(successMsg);
    render();
  }

  function openContactEditor(index = null) {
    const isEdit = index !== null && index >= 0 && index < contactsSettings.items.length;
    const item = isEdit ? contactsSettings.items[index] : {
      id: `contact-${Date.now()}`,
      platform: "zalo",
      name: "",
      url: "",
      badge: "",
      active: true,
    };

    $("#catalog-editor").innerHTML = `
      <form id="contact-edit-form" class="pricing-card promotion-form" data-contact-index="${isEdit ? index : -1}">
        <div class="promotion-title">
          <h3>${isEdit ? "✏️ Chỉnh sửa kênh liên hệ" : "+ Thêm kênh liên hệ mới"}</h3>
          <button type="button" class="button secondary btn-small" data-catalog-close>Đóng</button>
        </div>

        <div class="pricing-form-grid">
          <label>
            Nền tảng / Mạng xã hội *
            <select name="platform" id="contact-platform-select" required>
              <option value="zalo" ${item.platform === "zalo" ? "selected" : ""}>Zalo (Xanh ngọc / Cyan glow)</option>
              <option value="facebook" ${item.platform === "facebook" ? "selected" : ""}>Facebook (Xanh hoàng gia / Royal blue)</option>
              <option value="telegram" ${item.platform === "telegram" ? "selected" : ""}>Telegram (Xanh da trời / Sky blue)</option>
              <option value="discord" ${item.platform === "discord" ? "selected" : ""}>Discord (Tím Blurple)</option>
              <option value="phone" ${item.platform === "phone" ? "selected" : ""}>Số điện thoại / Hotline (Xanh lục)</option>
              <option value="messenger" ${item.platform === "messenger" ? "selected" : ""}>Messenger (Hồng - Xanh neon)</option>
              <option value="other" ${item.platform === "other" ? "selected" : ""}>Khác / Website URL (Vàng kim)</option>
            </select>
            <small>Icon và màu nền / viền neon sẽ tự động hiển thị theo đúng phong cách riêng của từng mạng xã hội.</small>
          </label>

          <label>
            Huy hiệu góc dưới (Badge)
            <div style="display:flex; gap:6px; margin-bottom:6px; flex-wrap:wrap;">
              <button type="button" class="button secondary btn-xs" data-badge-preset="CN" style="color:#fbbf24; border-color:rgba(245,158,11,0.5);">👑 CN (Cá nhân - Vàng)</button>
              <button type="button" class="button secondary btn-xs" data-badge-preset="GR" style="color:#c084fc; border-color:rgba(192,132,252,0.5);">👥 GR (Nhóm - Tím)</button>
              <button type="button" class="button secondary btn-xs" data-badge-preset="VIP" style="color:#f87171; border-color:rgba(239,68,68,0.5);">💎 VIP (Đỏ)</button>
              <button type="button" class="button secondary btn-xs" data-badge-preset="24/7" style="color:#4ade80; border-color:rgba(34,197,94,0.5);">24/7 (Xanh)</button>
              <button type="button" class="button secondary btn-xs" data-badge-preset="">✕ Không hiện</button>
            </div>
            <input name="badge" id="contact-badge-input" maxlength="8" placeholder="VD: CN, GR, VIP, 24/7..." value="${esc(item.badge || "")}" />
            <small>Màu sắc huy hiệu đổi tự động theo loại (CN = Vàng kim, GR = Tím neon, VIP = Đỏ cam, 24/7 = Xanh lục).</small>
          </label>
        </div>

        <div class="pricing-form-grid">
          <label>
            Tên hiển thị / Tooltip *
            <input name="name" required maxlength="80" placeholder="VD: Zalo Cá Nhân, Nhóm Facebook..." value="${esc(item.name || "")}" />
            <small>Nội dung hiện ra khi di chuột vào nút liên hệ ngoài trang chủ.</small>
          </label>

          <label>
            Đường dẫn liên kết (Link URL) *
            <input name="url" required maxlength="500" placeholder="VD: https://zalo.me/... hoặc https://facebook.com/..." value="${esc(item.url || "")}" />
            <small>Đường dẫn mở ra khi khách hàng click vào nút liên hệ.</small>
          </label>
        </div>

        <label class="pricing-check" style="margin-top:10px;">
          <input name="active" type="checkbox" ${item.active ? "checked" : ""}>
          Bật hiển thị nút liên hệ này ngoài trang web
        </label>
        <p class="pricing-form-message" role="status" aria-live="polite" style="margin-top:10px; font-size:13px; color:#f87171;"></p>
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
          <button type="button" class="button secondary" data-catalog-close>Hủy</button>
          <button type="submit" class="button primary">${isEdit ? "Cập nhật mục" : "Thêm mục vào danh sách"}</button>
        </div>
      </form>
    `;

    const inputName = $("#contact-edit-form [name=name]");
    if (inputName) inputName.focus();
  }

  function renderContactsView(panel) {
    const items = contactsSettings.items || [];
    const enabled = contactsSettings.enabled !== false;

    panel.innerHTML = `
      <header class="pricing-heading">
        <div>
          <span class="pricing-eyebrow">KÊNH LIÊN HỆ & MẠNG XÃ HỘI</span>
          <h2>Quản lý Nút Liên Hệ Nổi (Floating Contacts)</h2>
          <p>Tùy chỉnh danh sách các nút liên hệ nổi bên góc màn hình (Zalo, Facebook, Telegram...), thêm bớt link, huy hiệu và sắp xếp vị trí.</p>
        </div>
        <div class="pricing-actions">
          <button type="button" class="button secondary" data-contacts-reload>Làm mới ↻</button>
          <button type="button" class="button primary" data-contact-add>+ Thêm mục liên hệ</button>
        </div>
      </header>

      <div id="catalog-editor"></div>

      <section class="pricing-card bank-config-card" style="margin-bottom: 24px;">
        <div class="card-header-row">
          <div>
            <h3>💬 Bật/Tắt hiển thị nút liên hệ ngoài trang chủ</h3>
            <p>Khi bật, cụm nút tròn màu tối với huy hiệu nhỏ góc dưới và tooltip trượt sang trái sẽ xuất hiện ở góc dưới bên phải trang web.</p>
          </div>
          <div class="announcement-toggle-group">
            <label class="switch-label">
              <input type="checkbox" id="contacts-enabled-toggle" ${enabled ? "checked" : ""} aria-label="Bật widget liên hệ" />
              <span class="switch-slider"></span>
            </label>
            <span id="contacts-status-text" class="${enabled ? "status-active" : "status-inactive"}">
              ${enabled ? "Đang bật widget liên hệ" : "Đang tắt widget liên hệ"}
            </span>
          </div>
        </div>
      </section>

      <div class="contacts-admin-layout">
        <div class="contacts-admin-list-wrap">
          <div class="pricing-card" style="padding: 16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid var(--line); padding-bottom:10px;">
              <h4 style="margin:0; font-size:14px;">Danh sách kênh liên hệ (${items.length} mục)</h4>
              <div style="display:flex; gap:8px;">
                <button type="button" class="button primary btn-small" data-contact-add>+ Thêm mục</button>
                <button type="button" class="button secondary btn-small" data-contacts-save>Lưu thay đổi 💾</button>
              </div>
            </div>

            ${items.length === 0 ? `
              <div style="text-align:center; padding: 40px 16px; color:var(--muted);">
                <span style="font-size:36px; display:block; margin-bottom:8px;">💬</span>
                <p>Chưa có kênh liên hệ nào. Bấm nút <strong>+ Thêm mục</strong> để tạo nút liên hệ đầu tiên!</p>
              </div>
            ` : `
              <div class="contacts-table-list" style="display:flex; flex-direction:column; gap:10px;">
                ${items.map((item, idx) => `
                  <div class="contact-admin-item-card ${item.active ? '' : 'is-inactive'}">
                    <div style="display:flex; align-items:center; gap:12px; min-width:0; flex:1;">
                      <span class="product-pos-badge" style="font-size:11px; padding:2px 6px;">#${idx + 1}</span>
                      <div class="floating-contact-btn platform-${esc(item.platform || "other")}" style="width:42px; height:42px; flex-shrink:0; cursor:default; pointer-events:none;">
                        <span class="contact-icon" style="color:#fff;">${renderContactIcon(item.platform)}</span>
                        ${item.badge ? `<span class="contact-badge ${getContactBadgeClass(item.badge)}">${esc(item.badge)}</span>` : ''}
                      </div>
                      <div style="min-width:0; flex:1;">
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                          <strong style="font-size:13px; color:var(--text);">${esc(item.name)}</strong>
                          <span class="status-badge" style="font-size:10px; text-transform:uppercase;">${esc(item.platform)}</span>
                          ${item.badge ? `<span class="contact-badge ${getContactBadgeClass(item.badge)}" style="position:static; display:inline-block; font-size:9px;">${esc(item.badge)}</span>` : ''}
                          ${item.active ? '<span class="status-badge active" style="font-size:10px;">🟢 Bật</span>' : '<span class="status-badge disabled" style="font-size:10px;">⚪ Ẩn</span>'}
                        </div>
                        <div style="font-size:11px; color:var(--muted); margin-top:3px; word-break:break-all;">
                          <a href="${esc(item.url)}" target="_blank" rel="noopener" style="color:#60a5fa; text-decoration:underline;">${esc(item.url)}</a>
                        </div>
                      </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                      <button type="button" class="button secondary btn-xs" data-contact-up="${idx}" ${idx === 0 ? "disabled" : ""} title="Đưa lên trên">▲</button>
                      <button type="button" class="button secondary btn-xs" data-contact-down="${idx}" ${idx === items.length - 1 ? "disabled" : ""} title="Đưa xuống dưới">▼</button>
                      <button type="button" class="button secondary btn-xs" data-contact-toggle="${idx}" title="${item.active ? 'Ẩn mục này' : 'Bật mục này'}">${item.active ? 'Ẩn' : 'Bật'}</button>
                      <button type="button" class="button secondary btn-xs" data-contact-edit="${idx}" title="Chỉnh sửa">✏️ Sửa</button>
                      <button type="button" class="button secondary btn-xs btn-danger" data-contact-delete="${idx}" title="Xóa mục">✕ Xóa</button>
                    </div>
                  </div>
                `).join("")}
              </div>
            `}
          </div>
        </div>

        <div class="contacts-preview-sidebar">
          <div class="pricing-card" style="padding: 16px; position: sticky; top: 20px;">
            <h4 style="margin: 0 0 8px; font-size: 13px; display:flex; align-items:center; gap:6px;">
              <span>👁️</span> Xem trước ngoài Web
            </h4>
            <p style="font-size:11px; color:var(--muted); margin: 0 0 16px;">
              Cụm thanh dock hỗ trợ sẽ hiển thị góc dưới bên phải trang chủ như sau:
            </p>

            <div class="contacts-preview-stage">
              <div class="floating-contacts-dock" style="box-shadow:none;">
                <div class="floating-dock-badge" title="Đội ngũ hỗ trợ trực tuyến">
                  <span class="floating-pulse-dot" aria-hidden="true"></span>
                  <span>HỖ TRỢ</span>
                </div>
                <div class="floating-contacts-stack">
                  ${items.filter(i => i.active).length === 0 ? `
                    <span style="font-size:11px; color:var(--muted); padding:10px;">Chưa có mục nào được bật</span>
                  ` : items.filter(i => i.active).map(item => `
                    <div class="floating-contact-btn platform-${esc(item.platform || "other")}" title="${esc(item.name)}">
                      <span class="contact-icon">${renderContactIcon(item.platform)}</span>
                      ${item.badge ? `<span class="contact-badge ${getContactBadgeClass(item.badge)}">${esc(item.badge)}</span>` : ''}
                      <span class="contact-tooltip">
                        <span class="tooltip-title">${esc(item.name)}</span>
                        <span class="tooltip-sub">Nhấn để kết nối ↗</span>
                      </span>
                    </div>
                  `).join("")}
                </div>
              </div>
            </div>
            <div style="margin-top:14px; text-align:center;">
              <button type="button" class="button primary" style="width:100%;" data-contacts-save>Lưu tất cả thay đổi 💾</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function render() {
    const panel = $("#admin-pricing-view");
    if (currentView === "orders") return;
    if (!loaded) { panel.innerHTML = '<p class="pricing-hint">Đang tải giá và ưu đãi...</p><button type="button" class="button secondary" data-pricing-reload>Tải lại dữ liệu</button>'; return; }
    if (currentView === "contacts") {
      renderContactsView(panel);
      return;
    }
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
                <div class="product-card-header">
                  <div class="product-title-row">
                    ${!isPartner ? `<span class="product-pos-badge" title="Thứ tự vị trí hiển thị trên cửa hàng">#${globalIdx + 1}</span>` : ""}
                    <img src="${esc(p.image || 'assets/nitro.svg')}" style="width:24px; height:24px; object-fit:contain; border-radius:4px; vertical-align:middle; background:#11080a; border:1px solid #382428;" alt="" />
                    <h3>${esc(p.name)}</h3>
                    <span class="product-category-chip">${esc(getCategoryDisplayName(p.category))}</span>
                    ${p.partnerEmail ? `<span class="product-partner-badge" title="Mặt hàng do đối tác quản lý">🤝 ${esc(p.partnerEmail)}</span>` : ""}
                    ${p.service ? '<span class="status-badge service-sm">🛠️ Dịch vụ</span>' : ""}
                    ${p.requiresToken ? '<span class="status-badge" style="background:rgba(234,179,8,0.15); color:#ffd15c; border:1px solid rgba(234,179,8,0.4);">🔑 Cần Token</span>' : ""}
                    ${p.isCustom ? '<span class="status-badge custom">Tự tạo</span>' : ""}
                    ${p.isActive ? '<span class="status-badge active">Đang bán</span>' : '<span class="status-badge disabled">Đã ẩn / Bỏ bán</span>'}
                    <span class="product-stock-pill ${p.stock <= 0 ? 'is-out' : (p.stock <= 5 ? 'is-low' : '')}" title="Số lượng còn lại trong kho">📦 Kho: <strong>${p.stock != null ? p.stock : 99}</strong></span>
                    <span class="product-sold-pill" title="Tổng số lượng đã bán">🔥 Đã bán: <strong>${p.soldCount != null ? p.soldCount : 0}</strong></span>
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
                  <button type="button" class="button secondary btn-small btn-inventory-trigger" data-inventory-edit="${p.id}" title="Chỉnh nhanh số lượng kho và đã bán">📦 Kho & Đã bán</button>
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
                        ${(() => {
                          const badgeInfo = getDeliveryBadgeInfo(v.deliveryType);
                          return `<span class="status-badge ${badgeInfo.class}">${esc(badgeInfo.label)}</span>`;
                        })()}
                        ${v.isCustom ? '<span class="status-badge custom-sm">Tự tạo</span>' : ""}
                        ${v.isActive ? "" : '<span class="status-badge disabled-sm">Đã ẩn</span>'}
                      </div>
                      <small>Giá đang bán: ${money(v.price)}${v.sale ? " · " + esc(v.sale.name) : ""}${v.note ? " · " + esc(v.note) : ""}</small>
                    </div>
                    <div class="variant-controls">
                      <span class="price-input-wrap">
                        <input type="number" min="0" max="1000000000" step="1" required value="${v.basePrice}" data-price-product="${p.id}" data-price-variant="${v.id}" aria-label="Giá ${esc(p.name + ' ' + v.name)}" ${v.isActive ? "" : "disabled"}>
                        <span class="price-unit">đ</span>
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
        ? `https://img.vietqr.io/image/${encodeURIComponent(bank.code)}-${encodeURIComponent(bank.accountNumber)}-compact2.png?amount=50000&addInfo=${encodeURIComponent([bank.transferPrefix, "VNLTEST"].filter(Boolean).join(" "))}&accountName=${encodeURIComponent(bank.accountName || "")}`
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
                <p>Mã QR quét thử (50.000 $ · VNLTEST)</p>
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
                  <h3>Tự động cộng tiền qua Webhook Ngân hàng (SePay / VietQR)</h3>
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
                  <p>💡 <em>Khi khách chuyển khoản theo đúng nội dung <code>SEVQR VNL...</code> được sinh tự động trên VietQR, SePay sẽ bắn thông báo về và số dư ví khách hàng sẽ tự động tăng ngay lập tức!</em></p>
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
            <h2>${currentUser.role === "partner" ? "Hướng dẫn dịch vụ của tôi" : "Quản lý Bài viết & Hướng dẫn"}</h2>
            <p>${currentUser.role === "partner" ? "Đăng hướng dẫn sử dụng dịch vụ của bạn, kèm ảnh, video và các bước thực hiện. Bạn chỉ quản lý được bài do mình đăng." : "Đăng và quản lý bài hướng dẫn của shop và đối tác, kèm ảnh, video và các bước thực hiện."}</p>
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
    const isPartner = currentUser?.role === "partner";
    const rows = promotions.filter(p => p.kind === kind);
    const eyebrow = isPartner
      ? `ƯU ĐÃI ĐỐI TÁC (${esc(currentUser.name || currentUser.email)})`
      : "ƯU ĐÃI CỬA HÀNG";
    const heading = isPartner
      ? (coupon ? "Mã giảm giá của bạn" : "Đợt giảm giá của bạn")
      : (coupon ? "Mã giảm giá" : "Đợt giảm giá");
    const desc = isPartner
      ? (coupon ? "Tạo mã riêng cho khách, giới hạn lượt dùng và áp dụng riêng cho các dịch vụ / mặt hàng của bạn." : "Lên lịch ưu đãi tự động cho các gói dịch vụ của bạn.")
      : (coupon ? "Tạo mã riêng cho khách, giới hạn lượt dùng và chọn sản phẩm áp dụng." : "Lên lịch ưu đãi tự động. Nếu nhiều đợt trùng nhau, khách nhận mức giảm tốt nhất cho từng gói.");
    const btnLabel = isPartner
      ? (coupon ? "+ Tạo mã giảm giá của tôi" : "+ Tạo đợt giảm giá của tôi")
      : (coupon ? "+ Tạo mã giảm giá" : "+ Tạo đợt giảm giá");

    panel.innerHTML = `<header class="pricing-heading"><div><span class="pricing-eyebrow">${eyebrow}</span><h2>${heading}</h2>
      <p>${desc}</p></div>
      <button class="button primary" type="button" data-promotion-new="${kind}">${btnLabel}</button></header>
      <div id="promotion-editor"></div><div class="promotion-list">${rows.length ? rows.map(p => {
        const ownerTag = p.partnerEmail
          ? `<span style="display:inline-flex; align-items:center; gap:4px; font-size:11px; padding:2px 8px; border-radius:6px; background:rgba(168,85,247,0.15); color:#c084fc; border:1px solid rgba(168,85,247,0.3); font-weight:600;">🤝 Đối tác: ${esc(p.partnerEmail)}</span>`
          : (!isPartner ? `<span style="display:inline-flex; align-items:center; gap:4px; font-size:11px; padding:2px 8px; border-radius:6px; background:rgba(59,130,246,0.15); color:#60a5fa; border:1px solid rgba(59,130,246,0.3); font-weight:600;">👑 Toàn sàn (Admin)</span>` : "");
        const prodNames = p.productIds.length ? p.productIds.map(id => esc(products.find(x => x.id === id)?.name || id)).join(", ") : (isPartner ? "Các mặt hàng của bạn" : "Tất cả sản phẩm có giá bán");
        return `<article class="pricing-card promotion-card">
        <div class="promotion-title"><div>${coupon ? `<code>${esc(p.code)}</code>` : ""}<h3>${esc(p.name)}</h3>${ownerTag}</div><span class="promotion-status is-${p.status}">${statuses[p.status]}</span></div>
        <strong class="promotion-value">Giảm ${p.type === "percent" ? p.value + "%" : money(p.value)} <small>${coupon ? "/ đơn đủ điều kiện" : "/ gói sản phẩm"}</small></strong>
        <p>${prodNames}</p>
        <dl class="promotion-details"><div><dt>Bắt đầu</dt><dd>${formatDate(p.startsAt)}</dd></div><div><dt>Kết thúc</dt><dd>${formatDate(p.endsAt)}</dd></div>
        ${coupon ? `<div><dt>Lượt đã dùng</dt><dd>${p.used} / ${p.usageLimit ?? "không giới hạn"}</dd></div><div><dt>Mỗi khách</dt><dd>${p.perUserLimit == null ? "Không giới hạn" : p.perUserLimit + " lượt"}</dd></div><div><dt>Đơn tối thiểu</dt><dd>${money(p.minOrder)}</dd></div><div><dt>Giảm tối đa</dt><dd>${p.maxDiscount == null ? "Không giới hạn" : money(p.maxDiscount)}</dd></div><div><dt>Kết hợp đợt giảm giá</dt><dd>${p.stackWithSale ? "Có" : "Không"}</dd></div>` : ""}</dl>
        <div class="pricing-actions"><button class="button secondary btn-small" type="button" data-promotion-edit="${p.id}">Chỉnh sửa</button>
          <button class="button secondary btn-small" type="button" data-promotion-toggle="${p.id}">${p.enabled ? "Tắt ưu đãi" : "Bật ưu đãi"}</button>
          <button class="button secondary btn-small btn-danger" type="button" data-promotion-delete="${p.id}">Xóa</button></div></article>`;
      }).join("") : `<div class="pricing-empty"><span>${coupon ? "✦" : "◷"}</span><h3>${coupon ? "Chưa có mã giảm giá" : "Chưa có đợt giảm giá"}</h3><p>${isPartner ? "Tạo ưu đãi đầu tiên cho các sản phẩm của bạn." : "Tạo ưu đãi đầu tiên khi cửa hàng sẵn sàng."}</p></div>`}</div>`;
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
      return `<li style="font-size:12px; color:var(--muted); font-style:italic;">(Chưa có đặc điểm nào. Nhập mỗi đặc điểm một dòng ở ô trên.)</li>`;
    }
    return lines.map(line => `
      <li style="display:flex; align-items:flex-start; gap:8px; font-size:12px; color:var(--text); line-height:1.4;">
        <span style="color:#22c55e; font-weight:bold; font-size:13px; line-height:1.2;">✓</span>
        <span>${esc(line)}</span>
      </li>
    `).join("");
  }

  function openInventoryEditor(productId) {
    const p = products.find(x => x.id === productId);
    if (!p) return;
    const isPartner = currentUser.role === "partner";
    if (isPartner && String(p.partnerEmail || "").toLowerCase() !== currentUser.email.toLowerCase()) {
      notify("Bạn chỉ có quyền quản lý mặt hàng của chính mình.");
      return;
    }

    $("#catalog-editor").innerHTML = `<form id="inventory-edit-form" class="pricing-card promotion-form" data-product-id="${p.id}">
      <div class="promotion-title">
        <h3>📦 Quản lý Kho hàng & Số lượng Đã bán: ${esc(p.name)}</h3>
        <button type="button" class="button secondary btn-small" data-catalog-close>Đóng</button>
      </div>
      <p style="font-size:12px; color:var(--muted); margin-bottom:14px;">
        Chỉnh sửa số lượng sản phẩm còn lại và số lượng đã bán. Khi khách đặt mua đơn hàng mới, số lượng kho sẽ tự động giảm và số lượng đã bán sẽ tự động tăng theo thời gian thật.
      </p>
      <div class="pricing-form-grid" style="grid-template-columns: 1fr 1fr; gap:14px;">
        <label>
          <strong>Số lượng còn trong kho (Stock) *</strong>
          <small style="display:block; color:var(--muted); margin-bottom:4px;">Nhập 0 để báo hết hàng và khóa nút mua ngoài web.</small>
          <input type="number" name="stock" min="0" max="1000000" step="1" required value="${p.stock != null ? p.stock : 99}">
        </label>
        <label>
          <strong>Số lượng đã bán (Sold count) *</strong>
          <small style="display:block; color:var(--muted); margin-bottom:4px;">Số lượng hiển thị cạnh biểu tượng 🔥 ngoài cửa hàng.</small>
          <input type="number" name="soldCount" min="0" max="10000000" step="1" required value="${p.soldCount != null ? p.soldCount : 0}">
        </label>
      </div>
      <p class="pricing-form-message" role="status" aria-live="polite" style="margin-top:10px; font-size:13px; color:#f87171;"></p>
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
        <button type="button" class="button secondary" data-catalog-close>Hủy</button>
        <button type="submit" class="button primary">Lưu số lượng kho & đã bán 💾</button>
      </div>
    </form>`;
    const stockInp = $("#inventory-edit-form [name=stock]");
    if (stockInp) stockInp.focus();
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
          <label>Số lượng còn trong kho (Stock) *<input type="number" name="stock" min="0" max="1000000" step="1" required value="${p.stock != null ? p.stock : 99}"></label>
          <label>Số lượng đã bán (Sold count) *<input type="number" name="soldCount" min="0" max="10000000" step="1" required value="${p.soldCount != null ? p.soldCount : 0}"></label>
          <label>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span>Danh mục / Hạng mục *</span>
              <button type="button" data-categories-manage="${p.id}" style="background:none; border:none; color:var(--accent); font-size:11px; cursor:pointer; text-decoration:underline; padding:0;">
                ⚙️ Quản lý & Sửa hạng mục
              </button>
            </div>
            <select name="category" required id="product-category-select">
              ${categoriesList.map(c => `<option value="${esc(c.id)}" ${p.category === c.id ? "selected" : ""}>${esc(c.name)}${c.partnerEmail ? ` (Đối tác: ${esc(c.partnerEmail)})` : ""}</option>`).join("")}
              <option value="__custom__">✨ + Tự tạo thêm hạng mục mới...</option>
            </select>
          </label>
          <div id="new-cat-inline-wrap" style="display:none; grid-column:1 / -1; margin-top:-4px; background:rgba(217,119,6,0.08); border:1px dashed var(--accent); padding:10px 14px; border-radius:8px;">
            <label style="color:var(--accent); font-size:12px; font-weight:600; display:block; margin-bottom:6px;">
              ✨ Tên hạng mục mới cần tạo *
              <input name="newCategoryName" placeholder="Ví dụ: Game Bản Quyền, AI & Đồ Họa, Thiết Kế..." style="margin-top:4px;">
            </label>
            <label style="color:var(--text); font-size:11px; display:block;">
              Biểu tượng (Icon):
              <select name="newCategoryIcon" class="new-cat-inline-icon-select" style="margin-top:4px;">
                ${CATEGORY_ICON_PRESETS.map(p => `<option value="${p.value}" ${p.value === "box" ? "selected" : ""}>${p.label}</option>`).join("")}
                <option value="__custom__">✨ + Tùy chọn icon / emoji riêng...</option>
              </select>
            </label>
            <div class="new-cat-inline-custom-icon-wrap" style="display:none; margin-top:6px; background:rgba(217,119,6,0.08); border:1px dashed var(--accent); padding:8px 10px; border-radius:6px;">
              <label style="color:var(--accent); font-size:10px; font-weight:600; display:block; margin-bottom:4px;">
                ✨ NHẬP EMOJI HOẶC BIỂU TƯỢNG TÙY CHỌN:
              </label>
              <div style="display:flex; gap:8px; align-items:center;">
                <input class="new-cat-inline-custom-icon-input" name="newCategoryCustomIcon" placeholder="Nhập emoji hoặc icon..." maxlength="30" style="flex:1; padding:5px 8px; font-size:12px; background:var(--bg-card); color:var(--text); border:1px solid var(--line); border-radius:4px;" />
                <span class="new-cat-inline-icon-preview" style="font-size:16px;">📦</span>
              </div>
              <div style="margin-top:6px; display:flex; gap:4px; align-items:center; flex-wrap:wrap;">
                <span style="font-size:10px; color:var(--muted);">Chọn nhanh:</span>
                ${QUICK_EMOJIS.slice(0, 10).map(em => `<button type="button" class="button secondary btn-xs btn-emoji-inline-pick" data-emoji="${em}" style="padding:1px 5px; font-size:12px; line-height:1;">${em}</button>`).join("")}
              </div>
            </div>
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
          <div style="grid-column: 1 / -1; background: rgba(46, 125, 50, 0.08); border: 1px solid rgba(76, 175, 80, 0.3); border-radius: 8px; padding: 12px; margin-top: 4px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-weight: 600; font-size: 13px; color: #81c784; display:flex; align-items:center; gap:6px;">
                <span>🎁</span> Hướng dẫn nhận hàng khi thanh toán (Khung thông báo xanh)
              </span>
              <span style="font-size:11px; color:var(--muted);">Tùy chỉnh riêng cho mặt hàng này</span>
            </div>
            <label style="display:block; margin-bottom:8px;">
              <span style="font-size:12px; color:var(--text); margin-bottom:4px; display:block;">Tiêu đề khung hướng dẫn</span>
              <input name="checkoutNoticeTitle" maxlength="120" placeholder="Ví dụ: 🎁 GÓI GIFT (LINK QUÀ TẶNG)" value="${esc(p.checkoutNotice?.title || '')}">
            </label>
            <label style="display:block; margin:0;">
              <span style="font-size:12px; color:var(--text); margin-bottom:4px; display:block;">Nội dung hướng dẫn chi tiết</span>
              <textarea name="checkoutNoticeContent" rows="3" maxlength="2000" style="width:100%; padding:8px 10px; font-size:13px; background:var(--bg-card); color:var(--text); border:1px solid var(--line); border-radius:6px; resize:vertical; font-family:inherit;" placeholder="Nội dung xuất hiện trong khung hướng dẫn khi khách mua mặt hàng này. Để trống cả hai ô để dùng mặc định.">${esc(p.checkoutNotice?.content || '')}</textarea>
            </label>
          </div>
          <label style="grid-column: 1 / -1;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span>Đoạn giới thiệu chi tiết (Mục văn bản đầu popup khi khách bấm xem)</span>
              <span style="font-size:11px; color:var(--muted);">Hiển thị phần giới thiệu chi tiết mặt hàng</span>
            </div>
            <textarea name="detail" rows="3" maxlength="2000" style="width:100%; padding:8px 10px; font-size:13px; background:var(--bg-card); color:var(--text); border:1px solid var(--line); border-radius:6px; resize:vertical; font-family:inherit;" placeholder="Nhập đoạn văn bản giới thiệu chi tiết về mặt hàng khi khách bấm xem chi tiết...">${esc(p.detail || p.description || "")}</textarea>
          </label>
          <div style="grid-column: 1 / -1; background: rgba(234, 179, 8, 0.08); border: 1px solid rgba(234, 179, 8, 0.3); border-radius: 8px; padding: 12px; margin-top: 4px;">
            <label style="display:flex; align-items:center; gap:10px; cursor:pointer; margin:0; user-select:none;">
              <input type="checkbox" name="requiresToken" value="1" ${p.requiresToken ? 'checked' : ''} style="width:18px; height:18px; accent-color:#ffd15c; cursor:pointer;">
              <div>
                <strong style="color:#ffd15c; font-size:13px; display:block;">🔑 Yêu cầu khách nhập Token Discord khi đặt mua</strong>
                <span style="font-size:11px; color:var(--muted); display:block; margin-top:2px;">Bật tính năng này nếu mặt hàng cần khách cung cấp Token Discord (VD: Auto Badge, treo huy hiệu, chạy bot tài khoản...). Hệ thống sẽ hiển thị ô nhập Token ở popup chi tiết và form thanh toán.</span>
              </div>
            </label>
          </div>
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
        <label>Số lượng còn trong kho (Stock) *<input type="number" name="stock" min="0" max="1000000" step="1" required value="99"></label>
        <label>Số lượng đã bán (Sold count) *<input type="number" name="soldCount" min="0" max="10000000" step="1" required value="0"></label>
        <label>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <span>Danh mục / Hạng mục *</span>
            <button type="button" data-categories-manage="new" style="background:none; border:none; color:var(--accent); font-size:11px; cursor:pointer; text-decoration:underline; padding:0;">
              ⚙️ Quản lý & Sửa hạng mục
            </button>
          </div>
          <select name="category" required id="product-category-select">
            ${categoriesList.map(c => `<option value="${esc(c.id)}" ${c.id === "entertainment" ? "selected" : ""}>${esc(c.name)}${c.partnerEmail ? ` (Đối tác: ${esc(c.partnerEmail)})` : ""}</option>`).join("")}
            <option value="__custom__">✨ + Tự tạo thêm hạng mục mới...</option>
          </select>
        </label>
        <div id="new-cat-inline-wrap" style="display:none; grid-column:1 / -1; margin-top:-4px; background:rgba(217,119,6,0.08); border:1px dashed var(--accent); padding:10px 14px; border-radius:8px;">
          <label style="color:var(--accent); font-size:12px; font-weight:600; display:block; margin-bottom:6px;">
            ✨ Tên hạng mục mới cần tạo *
            <input name="newCategoryName" placeholder="Ví dụ: Game Bản Quyền, AI & Đồ Họa, Thiết Kế..." style="margin-top:4px;">
          </label>
          <label style="color:var(--text); font-size:11px; display:block;">
            Biểu tượng (Icon):
            <select name="newCategoryIcon" class="new-cat-inline-icon-select" style="margin-top:4px;">
              ${CATEGORY_ICON_PRESETS.map(p => `<option value="${p.value}" ${p.value === "box" ? "selected" : ""}>${p.label}</option>`).join("")}
              <option value="__custom__">✨ + Tùy chọn icon / emoji riêng...</option>
            </select>
          </label>
          <div class="new-cat-inline-custom-icon-wrap" style="display:none; margin-top:6px; background:rgba(217,119,6,0.08); border:1px dashed var(--accent); padding:8px 10px; border-radius:6px;">
            <label style="color:var(--accent); font-size:10px; font-weight:600; display:block; margin-bottom:4px;">
              ✨ NHẬP EMOJI HOẶC BIỂU TƯỢNG TÙY CHỌN:
            </label>
            <div style="display:flex; gap:8px; align-items:center;">
              <input class="new-cat-inline-custom-icon-input" name="newCategoryCustomIcon" placeholder="Nhập emoji hoặc icon..." maxlength="30" style="flex:1; padding:5px 8px; font-size:12px; background:var(--bg-card); color:var(--text); border:1px solid var(--line); border-radius:4px;" />
              <span class="new-cat-inline-icon-preview" style="font-size:16px;">📦</span>
            </div>
            <div style="margin-top:6px; display:flex; gap:4px; align-items:center; flex-wrap:wrap;">
              <span style="font-size:10px; color:var(--muted);">Chọn nhanh:</span>
              ${QUICK_EMOJIS.slice(0, 10).map(em => `<button type="button" class="button secondary btn-xs btn-emoji-inline-pick" data-emoji="${em}" style="padding:1px 5px; font-size:12px; line-height:1;">${em}</button>`).join("")}
            </div>
          </div>
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
        <div style="grid-column: 1 / -1; background: rgba(46, 125, 50, 0.08); border: 1px solid rgba(76, 175, 80, 0.3); border-radius: 8px; padding: 12px; margin-top: 4px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-weight: 600; font-size: 13px; color: #81c784; display:flex; align-items:center; gap:6px;">
              <span>🎁</span> Hướng dẫn nhận hàng khi thanh toán (Khung thông báo xanh)
            </span>
            <span style="font-size:11px; color:var(--muted);">Tùy chỉnh riêng cho mặt hàng này</span>
          </div>
          <label style="display:block; margin-bottom:8px;">
            <span style="font-size:12px; color:var(--text); margin-bottom:4px; display:block;">Tiêu đề khung hướng dẫn</span>
            <input name="checkoutNoticeTitle" maxlength="120" placeholder="Ví dụ: 🎁 GÓI GIFT (LINK QUÀ TẶNG)">
          </label>
          <label style="display:block; margin:0;">
            <span style="font-size:12px; color:var(--text); margin-bottom:4px; display:block;">Nội dung hướng dẫn chi tiết</span>
            <textarea name="checkoutNoticeContent" rows="3" maxlength="2000" style="width:100%; padding:8px 10px; font-size:13px; background:var(--bg-card); color:var(--text); border:1px solid var(--line); border-radius:6px; resize:vertical; font-family:inherit;" placeholder="Nội dung xuất hiện trong khung hướng dẫn khi khách mua mặt hàng này. Để trống cả hai ô để dùng mặc định."></textarea>
          </label>
        </div>
        <label style="grid-column: 1 / -1;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <span>Đoạn giới thiệu chi tiết (Mục văn bản đầu popup khi khách bấm xem)</span>
            <span style="font-size:11px; color:var(--muted);">Hiển thị phần giới thiệu chi tiết mặt hàng</span>
          </div>
          <textarea name="detail" rows="3" maxlength="2000" style="width:100%; padding:8px 10px; font-size:13px; background:var(--bg-card); color:var(--text); border:1px solid var(--line); border-radius:6px; resize:vertical; font-family:inherit;" placeholder="Giới thiệu chi tiết sản phẩm / dịch vụ, chế độ bảo hành và quy trình bàn giao..."></textarea>
        </label>
        <div style="grid-column: 1 / -1; background: rgba(234, 179, 8, 0.08); border: 1px solid rgba(234, 179, 8, 0.3); border-radius: 8px; padding: 12px; margin-top: 4px;">
          <label style="display:flex; align-items:center; gap:10px; cursor:pointer; margin:0; user-select:none;">
            <input type="checkbox" name="requiresToken" value="1" style="width:18px; height:18px; accent-color:#ffd15c; cursor:pointer;">
            <div>
              <strong style="color:#ffd15c; font-size:13px; display:block;">🔑 Yêu cầu khách nhập Token Discord khi đặt mua</strong>
              <span style="font-size:11px; color:var(--muted); display:block; margin-top:2px;">Bật tính năng này nếu mặt hàng cần khách cung cấp Token Discord (VD: Auto Badge, treo huy hiệu, chạy bot tài khoản...). Hệ thống sẽ hiển thị ô nhập Token ở popup chi tiết và form thanh toán.</span>
            </div>
          </label>
        </div>
        <label style="display:none;" data-skip="1">
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
          ${renderDeliveryTypeFieldHtml("gift")}
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
          ${renderDeliveryTypeFieldHtml(v.deliveryType || "gift")}
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
        ${renderDeliveryTypeFieldHtml("gift")}
        <label>Ghi chú gói<input name="note" placeholder="Ví dụ: Nhận link claim trực tiếp..."></label>
      </div>
      <p class="pricing-form-message" role="status"></p>
      <button class="button primary" type="submit">Thêm gói này</button>
    </form>`;
    $("#variant-create-form [name=name]").focus();
  }

  function openEditor(kind, id = null) {
    const isPartner = currentUser?.role === "partner";
    const partnerEmail = isPartner ? String(currentUser.email || "").toLowerCase() : null;
    const p = promotions.find(p => p.id === id) || { kind, name: "", code: "", enabled: true, type: "percent", value: 10, productIds: [], minOrder: 0, stackWithSale: true, perUserLimit: 1 };
    const coupon = kind === "coupon";

    const eligibleProducts = isPartner
      ? products.filter(prod => prod.partnerEmail && String(prod.partnerEmail).toLowerCase() === partnerEmail && !prod.service)
      : products.filter(prod => !prod.service);

    const scopeLegend = isPartner ? "Sản phẩm áp dụng (bắt buộc chọn) *" : "Sản phẩm áp dụng";
    const scopeHint = isPartner
      ? `<p style="color:#60a5fa; font-size:12px; margin-bottom:10px;">Chỉ áp dụng cho các mặt hàng do bạn (${esc(currentUser.email)}) quản lý (bắt buộc chọn ít nhất 1 mặt hàng):</p>`
      : `<p>Không chọn mục nào để áp dụng tất cả sản phẩm có giá bán (toàn sàn).</p>`;

    const productsCheckboxHtml = eligibleProducts.length
      ? eligibleProducts.map(product => {
          const ownerTag = !isPartner && product.partnerEmail ? ` <small style="color:#c084fc;">(Đối tác: ${esc(product.partnerEmail)})</small>` : "";
          return `<label><input type="checkbox" name="productIds" value="${product.id}" ${p.productIds.includes(product.id) ? "checked" : ""}> ${esc(product.name)}${ownerTag}</label>`;
        }).join("")
      : (isPartner
          ? `<p style="color:#f87171; font-size:12px; font-style:italic;">Bạn chưa có mặt hàng nào. Vui lòng vào tab "Dịch vụ của tôi" để đăng mặt hàng trước khi tạo ưu đãi.</p>`
          : `<p style="color:var(--muted); font-size:12px;">Chưa có sản phẩm nào có giá bán.</p>`);

    $("#promotion-editor").innerHTML = `<form id="promotion-form" class="pricing-card promotion-form" data-id="${id || ""}" data-kind="${kind}">
      <div class="promotion-title"><h3>${id ? "Chỉnh sửa" : "Tạo"} ${coupon ? (isPartner ? "mã giảm giá của tôi" : "mã giảm giá") : (isPartner ? "đợt giảm giá của tôi" : "đợt giảm giá")}</h3><button type="button" class="button secondary btn-small" data-promotion-close>Đóng</button></div>
      <div class="pricing-form-grid">
        <label>Tên ưu đãi<input name="name" required maxlength="100" placeholder="Ví dụ: Ưu đãi cuối tuần" value="${esc(p.name)}"></label>
        ${coupon ? `<label>Mã khách nhập<input name="code" required minlength="3" maxlength="32" pattern="[A-Za-z0-9_-]{3,32}" placeholder="Ví dụ: VNL10" value="${esc(p.code)}"></label>` : ""}
        <label>Kiểu giảm<select name="type"><option value="percent" ${p.type === "percent" ? "selected" : ""}>Phần trăm (%)</option><option value="fixed" ${p.type === "fixed" ? "selected" : ""}>Số tiền (VND)</option></select></label>
        <label>Mức giảm<input name="value" type="number" min="1" max="${p.type === 'percent' ? 100 : 1000000000}" step="1" required value="${p.value}"><small>${coupon ? "Giảm trên tổng các sản phẩm đủ điều kiện trong đơn." : "Giảm trên mỗi gói sản phẩm."}</small></label>
        <label>Bắt đầu<input name="startsAt" type="datetime-local" value="${inputDate(p.startsAt)}"><small>Để trống để áp dụng ngay.</small></label>
        <label>Kết thúc<input name="endsAt" type="datetime-local" value="${inputDate(p.endsAt)}"><small>Để trống nếu chưa có ngày kết thúc.</small></label>
        ${coupon ? `<label>Đơn tối thiểu (VND)<input name="minOrder" type="number" min="0" max="1000000000000" step="1" required value="${p.minOrder}"><small>${isPartner ? "Tính trên tổng các sản phẩm của bạn trong đơn." : "Tính sau các đợt giảm giá sản phẩm."}</small></label>
          <label>Giảm tối đa (VND)<input name="maxDiscount" type="number" min="1" max="1000000000" step="1" placeholder="Không giới hạn" value="${p.maxDiscount ?? ''}"></label>
          <label>Tổng lượt sử dụng<input name="usageLimit" type="number" min="1" max="1000000" step="1" placeholder="Không giới hạn" value="${p.usageLimit ?? ''}"></label>
          <label>Lượt dùng mỗi khách<input name="perUserLimit" type="number" min="1" max="1000000" step="1" placeholder="Không giới hạn" value="${p.perUserLimit ?? ''}"></label>` : ""}
      </div>
      <p class="pricing-hint">Thời gian theo thiết bị: ${esc(Intl.DateTimeFormat().resolvedOptions().timeZone)}.</p>
      <fieldset class="promotion-scope"><legend>${scopeLegend}</legend>${scopeHint}<div>${productsCheckboxHtml}</div></fieldset>
      <label class="pricing-check"><input name="enabled" type="checkbox" ${p.enabled ? "checked" : ""}>Bật ưu đãi theo lịch đã chọn</label>
      ${coupon ? `<label class="pricing-check"><input name="stackWithSale" type="checkbox" ${p.stackWithSale ? "checked" : ""}>Cho phép kết hợp với đợt giảm giá sản phẩm</label><p class="pricing-hint">Mỗi đơn dùng một mã. Đơn đã hủy sẽ trả lại lượt sử dụng.</p>` : ""}
      <p class="pricing-form-message" role="status"></p><button class="button primary" type="submit">Lưu ${coupon ? (isPartner ? "mã giảm giá của tôi" : "mã giảm giá") : (isPartner ? "đợt giảm giá của tôi" : "đợt giảm giá")}</button>
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
          const transferContent = [bank.transferPrefix, d.code].filter(Boolean).join(" ");
          const qrUrl = (bank.code && bank.accountNumber)
            ? `https://img.vietqr.io/image/${encodeURIComponent(bank.code)}-${encodeURIComponent(bank.accountNumber)}-compact2.png?amount=${d.amount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(bank.accountName || "")}`
            : "";
          return `
            <div class="deposit-item-card status-${esc(d.status)} ${d._isNew ? "deposit-just-arrived" : ""}" data-deposit-code="${esc(d.code)}">
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
                      <small>${(d.status === "expired" || d.expiresAt < Date.now()) ? "Đã hết hạn lúc:" : "Hết hạn lúc (10p):"}</small>
                      <span class="${(d.status === "expired" || d.expiresAt < Date.now()) ? "text-danger" : ""}">${new Date(d.expiresAt).toLocaleString("vi-VN")}</span>
                      ${(d.status === "pending" && d.expiresAt >= Date.now()) ? `<small style="color:#f59e0b; margin-left:4px; font-weight:600;">(còn ${Math.ceil((d.expiresAt - Date.now()) / 60000)}p)</small>` : ""}
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
                    Test Tự động cộng
                  </button>
                  <button type="button" class="button secondary btn-small btn-danger" data-deposit-cancel="${esc(d.id)}">
                    ✕ Hủy
                  </button>
                ` : ""}
                ${d.status === "credited" ? `
                  <button type="button" class="button secondary btn-small btn-danger btn-revoke" data-deposit-revoke="${esc(d.id)}" data-deposit-code="${esc(d.code)}" data-deposit-amount="${d.amount}" data-deposit-user="${esc(d.userEmail)}" title="Thu hồi tiền đã cộng nhầm cho khách hàng">
                    ↩ Thu hồi tiền (Trừ ví)
                  </button>
                ` : ""}
                ${qrUrl ? `
                  <button type="button" class="button secondary btn-small" data-deposit-qr="${esc(d.id)}" data-qr-url="${esc(qrUrl)}" data-qr-code="${esc(transferContent)}" data-qr-amount="${d.amount}" data-qr-expires="${d.expiresAt || 0}" data-qr-status="${esc(d.status)}">
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

  function openQrModal(qrUrl, code, amount, expiresAt, status) {
    const editor = $("#catalog-editor");
    if (!editor) return;
    const isExpired = status === "expired" || (expiresAt && expiresAt < Date.now());
    const expiryStr = expiresAt ? new Date(expiresAt).toLocaleTimeString("vi-VN") : "";
    editor.innerHTML = `
      <div class="admin-modal-overlay">
        <div class="admin-modal-box">
          <div class="admin-modal-header">
            <h3>Mã VietQR: <code>${esc(code)}</code></h3>
            <button type="button" class="button secondary btn-small" data-modal-close>Đóng ✕</button>
          </div>
          <div class="admin-modal-body">
            ${isExpired ? `
              <div style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.4); border-radius:8px; padding:10px; margin-bottom:12px; text-align:center; color:#fca5a5; font-size:12.5px; font-weight:600;">
                ⚠️ Mã QR này đã quá 10 phút và hết hạn. Khách hàng cần tạo mã QR mới.
              </div>
            ` : `
              <div style="background:rgba(234,179,8,0.12); border:1px solid rgba(234,179,8,0.35); border-radius:8px; padding:8px; margin-bottom:12px; text-align:center; color:#fde047; font-size:12px;">
                ⏱️ Mã QR chỉ có hiệu lực trong 10 phút${expiryStr ? ` (Hết hạn lúc: ${expiryStr})` : ""}.
              </div>
            `}
            <div class="preview-qr-wrap" style="position:relative; display:block; margin: 0 auto; text-align: center;">
              <img src="${esc(qrUrl)}" alt="VietQR" width="220" height="280" style="margin: 0 auto; display: block; ${isExpired ? 'filter:grayscale(1) blur(3px); opacity:0.5;' : ''}" />
              ${isExpired ? '<div style="position:absolute; top:45%; left:50%; transform:translate(-50%, -50%); background:rgba(239,68,68,0.92); color:#fff; font-weight:700; padding:6px 14px; border-radius:6px; font-size:13px; white-space:nowrap; box-shadow:0 4px 12px rgba(0,0,0,0.5);">⚠️ ĐÃ HẾT HẠN (QUÁ 10P)</div>' : ''}
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
                ${currentUser.role === "admin" && g.partnerEmail ? `<p class="guide-admin-subtitle">Đối tác: ${esc(g.partnerEmail)}</p>` : ""}
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

          <div style="grid-column: 1 / -1; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
              <span style="font-weight:600; font-size:12px; color:var(--text); display:flex; align-items:center; gap:6px;">
                🖼️ Ảnh bìa bài viết (Cover Image)
              </span>
              <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                <label class="button secondary btn-xs" style="cursor:pointer; margin:0; display:inline-flex; align-items:center; gap:5px;" title="Tải ảnh bìa từ máy">
                  📁 Tải ảnh bìa từ máy
                  <input type="file" id="guide-cover-file-input" accept="image/*" style="display:none;" />
                </label>
                <button type="button" class="button secondary btn-xs" id="btn-guide-cover-default" title="Dùng ảnh banner mặc định của shop">
                  ✨ Banner VNL
                </button>
                <button type="button" class="button secondary btn-xs btn-danger" id="btn-guide-cover-clear" title="Xóa ảnh bìa">
                  ✕ Xóa
                </button>
              </div>
            </div>
            <div style="display:flex; gap:14px; align-items:center; flex-wrap:wrap;">
              <div style="flex:1; min-width:220px;">
                <input id="guide-cover-image-input" name="coverImage" value="${esc(coverImage)}" placeholder="VD: assets/vnl-banner.png hoặc dán link ảnh, hoặc bấm 'Tải ảnh bìa từ máy'..." style="width:100%;" />
                <small style="color:var(--muted); font-size:11px; display:block; margin-top:4px;">
                  Ảnh bìa hiển thị ở thẻ bài viết trang chủ và đầu bài đọc hướng dẫn.
                </small>
              </div>
              <div style="width:120px; height:68px; border-radius:6px; border:1px solid var(--line); background:#150a0d; display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0;">
                <img id="guide-cover-live-preview" src="${esc(coverImage || 'assets/vnl-banner.png')}" style="width:100%; height:100%; object-fit:cover;" alt="Cover preview" onerror="this.src='assets/vnl-banner.png'" />
              </div>
            </div>
          </div>

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
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <label for="guide-images-input" style="font-weight:600; font-size:12px; margin:0;">
                🖼️ Hình ảnh minh họa &amp; Banner
              </label>
              <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                <label class="button secondary btn-xs" style="cursor:pointer; margin:0; display:inline-flex; align-items:center; gap:5px;" title="Tải ảnh từ máy tính hoặc điện thoại">
                  📁 Tải ảnh từ máy
                  <input type="file" id="guide-image-file-input" accept="image/*" multiple style="display:none;" />
                </label>
                <button type="button" class="button secondary btn-xs" id="btn-guide-image-default" title="Thêm ảnh banner mặc định">
                  + Banner VNL
                </button>
                <button type="button" class="button secondary btn-xs btn-danger" id="btn-guide-images-clear" title="Xóa tất cả ảnh">
                  ✕ Xóa hết
                </button>
              </div>
            </div>
            <textarea id="guide-images-input" name="images" rows="3" placeholder="VD:&#10;assets/vnl-banner.png&#10;https://i.imgur.com/example.png">${esc(imagesList.join("\n"))}</textarea>
            <small style="color:var(--muted); font-size:11px;">Hình ảnh minh họa từng bước hoặc banner. Mỗi dòng 1 link hoặc bấm "Tải ảnh từ máy" ở trên.</small>
            <div class="guide-preview-images-box" id="guide-preview-images-box">
              ${renderImagesPreviewHtml(imagesList, coverImage)}
            </div>
            <input type="file" id="guide-replace-single-file-input" accept="image/*" style="display:none;" />
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
      "contact-edit-form",
      "inventory-edit-form",
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
      } else if (form.id === "inventory-edit-form") {
        const data = new FormData(form);
        const productId = form.dataset.productId;
        const stock = Number(data.get("stock"));
        const soldCount = Number(data.get("soldCount"));
        await api("/api/admin/inventory", {
          method: "PUT",
          body: JSON.stringify({ productId, stock, soldCount }),
        });
        notify("Đã cập nhật số lượng kho và đã bán thành công!");
        $("#catalog-editor").replaceChildren();
      } else if (form.id === "contact-edit-form") {
        const data = new FormData(form);
        const index = Number(form.dataset.contactIndex);
        const platform = (data.get("platform") || "other").trim();
        const name = (data.get("name") || "").trim();
        const url = (data.get("url") || "").trim();
        const badge = (data.get("badge") || "").trim().toUpperCase();
        const active = form.querySelector('[name=active]') ? form.querySelector('[name=active]').checked : true;

        if (!name) throw new Error("Vui lòng nhập tên hiển thị / tooltip.");
        if (!url) throw new Error("Vui lòng nhập link liên kết.");

        let cleanUrl = url;
        if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(cleanUrl)) {
          cleanUrl = "https://" + cleanUrl;
        }

        if (!contactsSettings) contactsSettings = { enabled: true, items: [] };
        if (!Array.isArray(contactsSettings.items)) contactsSettings.items = [];

        if (index >= 0 && index < contactsSettings.items.length) {
          contactsSettings.items[index] = {
            ...contactsSettings.items[index],
            platform,
            name,
            url: cleanUrl,
            badge,
            active,
          };
        } else {
          contactsSettings.items.push({
            id: `contact-${Date.now()}`,
            platform,
            name,
            url: cleanUrl,
            badge,
            active,
          });
        }

        const res = await api("/api/admin/contacts", {
          method: "PUT",
          body: JSON.stringify({
            enabled: contactsSettings.enabled !== false,
            items: contactsSettings.items,
          }),
        });
        if (res && res.settings) {
          contactsSettings = res.settings;
        }
        $("#catalog-editor").replaceChildren();
        notify(index >= 0 ? "Đã cập nhật mục liên hệ thành công!" : "Đã thêm mục liên hệ mới thành công!");
        render();
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
        render();
        notify(isActive ? "Đã lưu cấu hình ngân hàng & Webhook tự động cộng tiền!" : "Đã lưu thông tin ngân hàng (đang tắt nạp QR).");
      } else if (form.id === "category-add-form") {
        const data = new FormData(form);
        const catName = (data.get("catName") || "").trim();
        if (!catName) throw new Error("Vui lòng nhập tên hiển thị hạng mục.");
        let catId = slugify((data.get("catId") || "").trim() || catName);
        if (!catId) catId = "cat-" + Date.now();
        const iconPreset = data.get("catIconPreset") || "box";
        let catIcon = iconPreset;
        if (iconPreset === "__custom__") {
          catIcon = (data.get("catCustomIcon") || "").trim() || "box";
        }
        if (categoriesList.some(c => c.id === catId)) throw new Error(`Mã hạng mục "${catId}" đã tồn tại.`);
        const newCat = { id: catId, name: catName, icon: catIcon };
        if (currentUser && currentUser.role === "partner") {
          newCat.partnerEmail = currentUser.email.toLowerCase();
        } else {
          const catPartnerEmail = (data.get("catPartnerEmail") || "").trim().toLowerCase();
          if (catPartnerEmail) newCat.partnerEmail = catPartnerEmail;
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
          const iconPreset = data.get("newCategoryIcon") || "box";
          let newIcon = iconPreset;
          if (iconPreset === "__custom__") {
            newIcon = (data.get("newCategoryCustomIcon") || "").trim() || "box";
          }
          const newId = slugify(newName) || "cat-" + Date.now();
          if (!categoriesList.some(c => c.id === newId)) {
            const newCat = { id: newId, name: newName, icon: newIcon };
            if (currentUser && currentUser.role === "partner") {
              newCat.partnerEmail = currentUser.email.toLowerCase();
            } else if (partnerEmail) {
              newCat.partnerEmail = partnerEmail.toLowerCase();
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
        const deliveryPreset = (data.get("deliveryPreset") || data.get("deliveryType") || "gift").trim();
        let deliveryType = deliveryPreset;
        if (deliveryPreset === "__custom__") {
          deliveryType = (data.get("customDeliveryType") || "").trim() || "gift";
        }
        const variantNote = (data.get("variantNote") || "").trim();
        const variants = variantName && variantPrice !== null ? [{ name: variantName, price: variantPrice, deliveryType, note: variantNote }] : [];
        const checkoutNoticeTitle = String(data.get("checkoutNoticeTitle") || "").trim();
        const checkoutNoticeContent = String(data.get("checkoutNoticeContent") || "").trim();
        const checkoutNotice = checkoutNoticeTitle || checkoutNoticeContent ? {
          title: checkoutNoticeTitle,
          content: checkoutNoticeContent
        } : null;
        const requiresToken = data.get("requiresToken") === "1";
        await api("/api/admin/products", { method: "POST", body: JSON.stringify({ name, category, badge, description, image, partnerEmail, variants, detail, features, requiresToken, stock: Number(data.get("stock") || 99), soldCount: Number(data.get("soldCount") || 0), checkoutNotice }) });
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
          const iconPreset = data.get("newCategoryIcon") || "box";
          let newIcon = iconPreset;
          if (iconPreset === "__custom__") {
            newIcon = (data.get("newCategoryCustomIcon") || "").trim() || "box";
          }
          const newId = slugify(newName) || "cat-" + Date.now();
          if (!categoriesList.some(c => c.id === newId)) {
            const newCat = { id: newId, name: newName, icon: newIcon };
            if (currentUser && currentUser.role === "partner") {
              newCat.partnerEmail = currentUser.email.toLowerCase();
            } else if (partnerEmail) {
              newCat.partnerEmail = partnerEmail.toLowerCase();
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
        const requiresToken = data.get("requiresToken") === "1";
        await api("/api/admin/products/" + productId, {
          method: "PUT",
          body: JSON.stringify({ name, category, badge, description, image: editImage, partnerEmail, detail, features, requiresToken, stock: Number(data.get("stock") || 99), soldCount: Number(data.get("soldCount") || 0), checkoutNotice: {
            title: String(data.get('checkoutNoticeTitle') || ''),
            content: String(data.get('checkoutNoticeContent') || '')
          } }),
        });
        notify("Đã cập nhật thông tin mặt hàng.");
        $("#catalog-editor").replaceChildren();
      } else if (form.id === "variant-create-form") {
        const data = new FormData(form);
        const productId = form.dataset.productId;
        const name = data.get("name").trim();
        const price = Number(data.get("price"));
        const deliveryPreset = (data.get("deliveryPreset") || data.get("deliveryType") || "gift").trim();
        let deliveryType = deliveryPreset;
        if (deliveryPreset === "__custom__") {
          deliveryType = (data.get("customDeliveryType") || "").trim() || "gift";
        }
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
        const deliveryPreset = (data.get("deliveryPreset") || data.get("deliveryType") || "gift").trim();
        let deliveryType = deliveryPreset;
        if (deliveryPreset === "__custom__") {
          deliveryType = (data.get("customDeliveryType") || "").trim() || "gift";
        }
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
        const productIds = data.getAll("productIds");
        if (currentUser?.role === "partner" && productIds.length === 0) {
          throw new Error("Vui lòng chọn ít nhất 1 sản phẩm của bạn để áp dụng ưu đãi.");
        }
        const body = { kind: form.dataset.kind, name: data.get("name"), code: data.get("code"), type: data.get("type"), value: Number(data.get("value")),
          startsAt: data.get("startsAt") ? new Date(data.get("startsAt")).getTime() : null, endsAt: data.get("endsAt") ? new Date(data.get("endsAt")).getTime() : null,
          productIds, enabled: data.has("enabled"), stackWithSale: data.has("stackWithSale"),
          minOrder: Number(data.get("minOrder") || 0), maxDiscount: optional("maxDiscount"), usageLimit: optional("usageLimit"), perUserLimit: optional("perUserLimit") };
        await api("/api/admin/promotions" + (form.dataset.id ? "/" + form.dataset.id : ""), { method: form.dataset.id ? "PUT" : "POST", body: JSON.stringify(body) });
        notify(currentUser?.role === "partner" ? "Đã lưu ưu đãi của bạn thành công." : "Đã lưu ưu đãi.");
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
      setInterval(() => { void refreshPartners(); }, 15000);
      setInterval(() => { void refreshDeposits(); }, 3500);
      window.addEventListener("focus", () => { void refreshPartners(); void refreshDeposits(); });
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
          void refreshPartners();
          void refreshDeposits();
        }
      });
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
        if (event.target.id === "contacts-enabled-toggle") {
          contactsSettings.enabled = event.target.checked;
          const statusText = document.querySelector("#contacts-status-text");
          if (statusText) {
            statusText.textContent = event.target.checked ? "Đang bật widget liên hệ" : "Đang tắt widget liên hệ";
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
        if (event.target.id === "cat-add-icon-select") {
          const wrap = document.querySelector("#cat-add-custom-icon-wrap");
          const preview = document.querySelector("#cat-add-icon-preview");
          const isCustom = event.target.value === "__custom__";
          if (wrap) wrap.style.display = isCustom ? "block" : "none";
          if (preview) {
            if (!isCustom) {
              preview.textContent = getCategoryEmoji(event.target.value);
            } else {
              const customInp = document.querySelector("#cat-add-custom-icon-input");
              preview.textContent = (customInp && customInp.value.trim()) || "📦";
            }
          }
        }
        if (event.target.id === "cat-edit-icon-select") {
          const wrap = document.querySelector("#cat-edit-custom-icon-wrap");
          const preview = document.querySelector("#cat-edit-icon-preview");
          const isCustom = event.target.value === "__custom__";
          if (wrap) wrap.style.display = isCustom ? "block" : "none";
          if (preview) {
            if (!isCustom) {
              preview.textContent = getCategoryEmoji(event.target.value);
            } else {
              const customInp = document.querySelector("#cat-edit-custom-icon-input");
              preview.textContent = (customInp && customInp.value.trim()) || "📦";
            }
          }
        }
        if (event.target.classList && event.target.classList.contains("new-cat-inline-icon-select")) {
          const form = event.target.closest("form");
          const wrap = form ? form.querySelector(".new-cat-inline-custom-icon-wrap") : null;
          const preview = form ? form.querySelector(".new-cat-inline-icon-preview") : null;
          const isCustom = event.target.value === "__custom__";
          if (wrap) wrap.style.display = isCustom ? "block" : "none";
          if (preview) {
            if (!isCustom) {
              preview.textContent = getCategoryEmoji(event.target.value);
            } else {
              const customInp = form ? form.querySelector(".new-cat-inline-custom-icon-input") : null;
              preview.textContent = (customInp && customInp.value.trim()) || "📦";
            }
          }
        }
        if (event.target.classList && event.target.classList.contains("delivery-type-select")) {
          const form = event.target.closest("form");
          const wrap = form ? form.querySelector(".custom-delivery-wrap") : null;
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
        if (event.target.id === "guide-cover-file-input") {
          const file = event.target.files && event.target.files[0];
          if (!file) return;
          compressImageFile(file, 1280, 0.85).then(compressed => {
            if (compressed) {
              const input = document.querySelector("#guide-cover-image-input");
              const preview = document.querySelector("#guide-cover-live-preview");
              if (input) input.value = compressed;
              if (preview) preview.src = compressed;
              const box = document.querySelector("#guide-preview-images-box");
              const imgInput = document.querySelector("#guide-images-input");
              if (box && imgInput) {
                const imgs = imgInput.value.split("\n").map(s => s.trim()).filter(Boolean);
                box.innerHTML = renderImagesPreviewHtml(imgs, compressed);
              }
              notify("Đã tải ảnh bìa bài viết từ máy thành công!");
            }
          });
          event.target.value = "";
        }
        if (event.target.id === "guide-image-file-input" || event.target.id === "guide-image-file-empty-input") {
          const files = Array.from(event.target.files || []);
          if (!files.length) return;
          Promise.all(files.map(f => compressImageFile(f, 1280, 0.85))).then(compressedList => {
            const validCompressed = compressedList.filter(Boolean);
            if (!validCompressed.length) return;
            const imgInput = document.querySelector("#guide-images-input");
            const box = document.querySelector("#guide-preview-images-box");
            const coverInput = document.querySelector("#guide-cover-image-input");
            const coverPreview = document.querySelector("#guide-cover-live-preview");
            let existing = (imgInput ? imgInput.value : "").split("\n").map(s => s.trim()).filter(Boolean);
            const updated = [...existing, ...validCompressed];
            if (imgInput) imgInput.value = updated.join("\n");
            if (coverInput && (!coverInput.value.trim() || coverInput.value.trim() === "assets/vnl-banner.png")) {
              coverInput.value = validCompressed[0];
              if (coverPreview) coverPreview.src = validCompressed[0];
            }
            if (box) {
              box.innerHTML = renderImagesPreviewHtml(updated, coverInput ? coverInput.value.trim() : "");
            }
            notify(`Đã thêm ${validCompressed.length} ảnh minh họa từ máy!`);
          });
          event.target.value = "";
        }
        if (event.target.id === "guide-replace-single-file-input") {
          const file = event.target.files && event.target.files[0];
          const targetIndex = Number(event.target.dataset.targetIndex);
          if (!file || isNaN(targetIndex)) return;
          compressImageFile(file, 1280, 0.85).then(compressed => {
            if (compressed) {
              const imgInput = document.querySelector("#guide-images-input");
              const box = document.querySelector("#guide-preview-images-box");
              const coverInput = document.querySelector("#guide-cover-image-input");
              let existing = (imgInput ? imgInput.value : "").split("\n").map(s => s.trim()).filter(Boolean);
              if (targetIndex >= 0 && targetIndex < existing.length) {
                const oldUrl = existing[targetIndex];
                existing[targetIndex] = compressed;
                if (imgInput) imgInput.value = existing.join("\n");
                if (coverInput && coverInput.value.trim() === oldUrl.trim()) {
                  coverInput.value = compressed;
                  const coverPreview = document.querySelector("#guide-cover-live-preview");
                  if (coverPreview) coverPreview.src = compressed;
                }
                if (box) {
                  box.innerHTML = renderImagesPreviewHtml(existing, coverInput ? coverInput.value.trim() : "");
                }
                notify(`Đã thay thế ảnh số ${targetIndex + 1} thành công!`);
              }
            }
          });
          event.target.value = "";
        }
      });
      document.addEventListener("input", event => {
        if (event.target.id === "cat-add-custom-icon-input") {
          const preview = document.querySelector("#cat-add-icon-preview");
          if (preview) preview.textContent = event.target.value.trim() || "📦";
        }
        if (event.target.id === "cat-edit-custom-icon-input") {
          const preview = document.querySelector("#cat-edit-icon-preview");
          if (preview) preview.textContent = event.target.value.trim() || "📦";
        }
        if (event.target.classList && event.target.classList.contains("new-cat-inline-custom-icon-input")) {
          const form = event.target.closest("form");
          const preview = form ? form.querySelector(".new-cat-inline-icon-preview") : null;
          if (preview) preview.textContent = event.target.value.trim() || "📦";
        }
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
        if (event.target.id === "guide-cover-image-input") {
          const preview = document.querySelector("#guide-cover-live-preview");
          if (preview) {
            preview.src = event.target.value.trim() || "assets/vnl-banner.png";
          }
          const box = document.querySelector("#guide-preview-images-box");
          const imgInput = document.querySelector("#guide-images-input");
          if (box && imgInput) {
            const imgs = imgInput.value.split("\n").map(s => s.trim()).filter(Boolean);
            box.innerHTML = renderImagesPreviewHtml(imgs, event.target.value.trim());
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
          const coverInput = document.querySelector("#guide-cover-image-input");
          if (box) {
            const imgs = event.target.value.split("\n").map(s => s.trim()).filter(Boolean);
            box.innerHTML = renderImagesPreviewHtml(imgs, coverInput ? coverInput.value.trim() : "");
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
        if (button.id === "btn-guide-cover-default") {
          const input = document.querySelector("#guide-cover-image-input");
          const preview = document.querySelector("#guide-cover-live-preview");
          if (input) input.value = "assets/vnl-banner.png";
          if (preview) preview.src = "assets/vnl-banner.png";
          const box = document.querySelector("#guide-preview-images-box");
          const imgInput = document.querySelector("#guide-images-input");
          if (box && imgInput) {
            const imgs = imgInput.value.split("\n").map(s => s.trim()).filter(Boolean);
            box.innerHTML = renderImagesPreviewHtml(imgs, "assets/vnl-banner.png");
          }
          notify("Đã đặt ảnh bìa Banner VNL.");
          return;
        }
        if (button.id === "btn-guide-cover-clear") {
          const input = document.querySelector("#guide-cover-image-input");
          const preview = document.querySelector("#guide-cover-live-preview");
          if (input) input.value = "";
          if (preview) preview.src = "assets/vnl-banner.png";
          const box = document.querySelector("#guide-preview-images-box");
          const imgInput = document.querySelector("#guide-images-input");
          if (box && imgInput) {
            const imgs = imgInput.value.split("\n").map(s => s.trim()).filter(Boolean);
            box.innerHTML = renderImagesPreviewHtml(imgs, "");
          }
          notify("Đã xóa ảnh bìa.");
          return;
        }
        if (button.id === "btn-guide-image-default" || button.id === "btn-guide-add-default-empty") {
          const imgInput = document.querySelector("#guide-images-input");
          const box = document.querySelector("#guide-preview-images-box");
          const coverInput = document.querySelector("#guide-cover-image-input");
          let existing = (imgInput ? imgInput.value : "").split("\n").map(s => s.trim()).filter(Boolean);
          if (!existing.includes("assets/vnl-banner.png")) {
            existing.push("assets/vnl-banner.png");
          }
          if (imgInput) imgInput.value = existing.join("\n");
          if (box) box.innerHTML = renderImagesPreviewHtml(existing, coverInput ? coverInput.value.trim() : "");
          notify("Đã thêm Banner VNL vào danh sách ảnh.");
          return;
        }
        if (button.id === "btn-guide-images-clear") {
          if (!confirm("Bạn có chắc muốn xóa tất cả ảnh minh họa?")) return;
          const imgInput = document.querySelector("#guide-images-input");
          const box = document.querySelector("#guide-preview-images-box");
          const coverInput = document.querySelector("#guide-cover-image-input");
          if (imgInput) imgInput.value = "";
          if (box) box.innerHTML = renderImagesPreviewHtml([], coverInput ? coverInput.value.trim() : "");
          notify("Đã xóa tất cả ảnh minh họa.");
          return;
        }
        if (button.dataset.guideImgAction === "remove") {
          const idx = Number(button.dataset.index);
          const imgInput = document.querySelector("#guide-images-input");
          const box = document.querySelector("#guide-preview-images-box");
          const coverInput = document.querySelector("#guide-cover-image-input");
          let existing = (imgInput ? imgInput.value : "").split("\n").map(s => s.trim()).filter(Boolean);
          if (idx >= 0 && idx < existing.length) {
            existing.splice(idx, 1);
            if (imgInput) imgInput.value = existing.join("\n");
            if (box) box.innerHTML = renderImagesPreviewHtml(existing, coverInput ? coverInput.value.trim() : "");
            notify(`Đã xóa ảnh số ${idx + 1}.`);
          }
          return;
        }
        if (button.dataset.guideImgAction === "set-cover") {
          const idx = Number(button.dataset.index);
          const imgInput = document.querySelector("#guide-images-input");
          const coverInput = document.querySelector("#guide-cover-image-input");
          const coverPreview = document.querySelector("#guide-cover-live-preview");
          const box = document.querySelector("#guide-preview-images-box");
          let existing = (imgInput ? imgInput.value : "").split("\n").map(s => s.trim()).filter(Boolean);
          if (idx >= 0 && idx < existing.length) {
            const selected = existing[idx];
            if (coverInput) coverInput.value = selected;
            if (coverPreview) coverPreview.src = selected;
            if (box) box.innerHTML = renderImagesPreviewHtml(existing, selected);
            notify(`Đã đặt ảnh số ${idx + 1} làm ảnh bìa bài viết ⭐`);
          }
          return;
        }
        if (button.dataset.guideImgAction === "replace") {
          const idx = Number(button.dataset.index);
          const replaceInput = document.querySelector("#guide-replace-single-file-input");
          if (replaceInput) {
            replaceInput.dataset.targetIndex = String(idx);
            replaceInput.click();
          }
          return;
        }
        if (button.dataset.badgePreset !== undefined) {
          const inp = document.querySelector("#contact-badge-input");
          if (inp) {
            inp.value = button.dataset.badgePreset;
            inp.focus();
          }
          return;
        }
        if (button.hasAttribute("data-contact-add")) openContactEditor(null);
        if (button.dataset.contactEdit !== undefined) openContactEditor(Number(button.dataset.contactEdit));
        if (button.dataset.contactDelete !== undefined) {
          const idx = Number(button.dataset.contactDelete);
          const item = contactsSettings.items[idx];
          if (!item) return;
          if (!confirm(`Bạn có chắc muốn xóa kênh liên hệ "${item.name}"?`)) return;
          contactsSettings.items.splice(idx, 1);
          await saveContactsToServer("Đã xóa mục liên hệ.");
        }
        if (button.dataset.contactUp !== undefined) {
          const idx = Number(button.dataset.contactUp);
          if (idx > 0 && idx < contactsSettings.items.length) {
            const temp = contactsSettings.items[idx];
            contactsSettings.items[idx] = contactsSettings.items[idx - 1];
            contactsSettings.items[idx - 1] = temp;
            render();
          }
        }
        if (button.dataset.contactDown !== undefined) {
          const idx = Number(button.dataset.contactDown);
          if (idx >= 0 && idx < contactsSettings.items.length - 1) {
            const temp = contactsSettings.items[idx];
            contactsSettings.items[idx] = contactsSettings.items[idx + 1];
            contactsSettings.items[idx + 1] = temp;
            render();
          }
        }
        if (button.dataset.contactToggle !== undefined) {
          const idx = Number(button.dataset.contactToggle);
          if (idx >= 0 && idx < contactsSettings.items.length) {
            contactsSettings.items[idx].active = !contactsSettings.items[idx].active;
            render();
          }
        }
        if (button.hasAttribute("data-contacts-save")) {
          button.disabled = true;
          try {
            await saveContactsToServer("Đã lưu tất cả thay đổi kênh liên hệ!");
          } finally {
            button.disabled = false;
          }
        }
        if (button.hasAttribute("data-contacts-reload")) {
          await load();
        }
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
          if (!confirm(`Xác nhận đã nhận đủ ${moneyText(dAmount)} cho mã ${dCode}?\nTiền sẽ được cộng ngay lập tức vào ví của khách hàng.`)) return;
          button.disabled = true;
          try {
            await api(`/api/admin/deposits/${dId}/credit`, { method: "POST" });
            notify(`Đã duyệt và cộng ${moneyText(dAmount)} vào ví thành công!`);
            await load();
          } catch (err) {
            notify(err.message);
          } finally {
            button.disabled = false;
          }
        }
        if (button.dataset.depositRevoke) {
          const dId = button.dataset.depositRevoke;
          const dCode = button.dataset.depositCode;
          const dAmount = Number(button.dataset.depositAmount) || 0;
          const dUser = button.dataset.depositUser || "khách hàng";
          if (!confirm(
            `XÁC NHẬN THU HỒI TIỀN NẠP NHẦM:\n\n` +
            `• Mã nạp: ${dCode}\n` +
            `• Khách hàng: ${dUser}\n` +
            `• Số tiền: ${moneyText(dAmount)}\n\n` +
            `Hành động này sẽ TRỪ LẠI ${moneyText(dAmount)} khỏi ví của ${dUser} và chuyển trạng thái đơn nạp về "Cần đối soát".\n\n` +
            `Bạn có chắc chắn muốn THU HỒI TIỀN không?`
          )) return;
          button.disabled = true;
          try {
            const res = await api(`/api/admin/deposits/${dId}/revoke`, { method: "POST" });
            notify(`Đã thu hồi thành công ${moneyText(dAmount)} từ ví của ${dUser}! Số dư ví mới: ${moneyText(res.newBalance || 0)}.`);
            await load();
          } catch (err) {
            notify("Lỗi thu hồi tiền: " + err.message);
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
            notify(`Đã giả lập nạp tiền thành công cho mã ${code}! Số dư đã được tự động cộng vào ví.`);
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
          openQrModal(
            button.dataset.qrUrl,
            button.dataset.qrCode,
            Number(button.dataset.qrAmount),
            Number(button.dataset.qrExpires),
            button.dataset.qrStatus
          );
        }
        if (button.dataset.productUp) {
          moveProduct(button.dataset.productUp, -1);
        }
        if (button.dataset.productDown) {
          moveProduct(button.dataset.productDown, 1);
        }
        if (button.classList.contains("btn-emoji-pick")) {
          const targetInputSel = button.dataset.targetInput;
          const targetPreviewSel = button.dataset.targetPreview;
          const emoji = button.dataset.emoji;
          if (targetInputSel) {
            const input = document.querySelector(targetInputSel);
            if (input) {
              input.value = emoji;
              input.focus();
            }
          }
          if (targetPreviewSel) {
            const preview = document.querySelector(targetPreviewSel);
            if (preview) preview.textContent = emoji;
          }
        }
        if (button.classList.contains("btn-emoji-inline-pick")) {
          const form = button.closest("form");
          const emoji = button.dataset.emoji;
          if (form) {
            const input = form.querySelector(".new-cat-inline-custom-icon-input");
            const preview = form.querySelector(".new-cat-inline-icon-preview");
            if (input) {
              input.value = emoji;
              input.focus();
            }
            if (preview) preview.textContent = emoji;
          }
        }
        if (button.classList.contains("btn-delivery-sug-pick")) {
          const form = button.closest("form");
          const val = button.dataset.val;
          if (form && val) {
            const input = form.querySelector(".custom-delivery-input");
            if (input) {
              input.value = val;
              input.focus();
            }
          }
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
          const customIconInput = document.querySelector("#cat-edit-custom-icon-input");
          const newName = nameInput ? nameInput.value.trim() : "";
          if (!newName) {
            notify("Tên hạng mục không được để trống.");
            return;
          }
          let newIcon = iconSelect ? iconSelect.value : "box";
          if (newIcon === "__custom__") {
            newIcon = (customIconInput ? customIconInput.value.trim() : "") || "box";
          }
          const cat = categoriesList.find(c => c.id === cId);
          if (cat) {
            if (currentUser?.role === "partner") {
              const isOwned = cat.partnerEmail && cat.partnerEmail.toLowerCase() === currentUser.email.toLowerCase();
              if (!isOwned) {
                notify("Bạn chỉ có quyền sửa hạng mục do chính mình tạo.");
                return;
              }
            } else {
              const partnerSelect = document.querySelector("#cat-edit-partner-select");
              if (partnerSelect) {
                const chosen = (partnerSelect.value || "").trim().toLowerCase();
                cat.partnerEmail = chosen || null;
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
        if (button.dataset.inventoryEdit) openInventoryEditor(button.dataset.inventoryEdit);
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
        if (button.dataset.promotionDelete) {
          if (!confirm("Bạn có chắc chắn muốn xóa vĩnh viễn ưu đãi này?")) return;
          button.disabled = true;
          try {
            await api("/api/admin/promotions/" + button.dataset.promotionDelete, { method: "DELETE" });
            notify("Đã xóa ưu đãi thành công.");
            await load();
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

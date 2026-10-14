// Products and store catalog configuration for VietNam Legacy
const storeConfig = {
  name: "VietNam Legacy",
  discordUrl: "https://discord.gg/F3J7hWNRc4",
  storageKey: "vietnam-legacy-store-v1",
  currency: "VND",
};

const categoryNames = {
  all: "Tất cả",
  discord: "Discord",
  decor: "Profile Decor",
  entertainment: "Giải trí",
  creative: "Sáng tạo",
  services: "Dịch vụ Discord",
};

const products = [
  {
    id: "nitro",
    name: "Discord Nitro Boost",
    category: "discord",
    image: "assets/nitro.svg",
    badge: "DISCORD / NITRO BOOST",
    description: "Đầy đủ quyền lợi: 2 Boost Server, streaming 4K, 500 server, kho emoji và sticker động.",
    features: [
      "Áp dụng cho mọi tài khoản Discord",
      "Chọn nhận Link Gift hoặc Nạp Acc (Log)",
      "Bảo hành đầy đủ suốt thời gian gói",
    ],
    detail:
      "Gói Discord Nitro Boost cao cấp nhất. Bạn có thể chọn hình thức [Gift] để tự claim qua link quà tặng mà không cần gửi tài khoản, hoặc chọn [Log] để shop đăng nhập nạp trực tiếp với mức giá ưu đãi hơn.",
    variants: [
      { id: "boost_gift_1m", name: "🎁 [Gift] Nitro Boost · 1 tháng", price: 99000, deliveryType: "gift", note: "Nhận link claim trực tiếp, không cần tài khoản mật khẩu" },
      { id: "boost_gift_1y", name: "🎁 [Gift] Nitro Boost · 1 năm", price: 950000, deliveryType: "gift", note: "Nhận link claim trực tiếp, không cần tài khoản mật khẩu" },
      { id: "boost_log_1m", name: "🔑 [Log] Nitro Boost · 1 tháng (Nạp Acc)", price: 79000, deliveryType: "log", note: "Shop đăng nhập nạp, cần Acc/Pass/3 mã dự phòng" },
      { id: "boost_log_1y", name: "🔑 [Log] Nitro Boost · 1 năm (Nạp Acc)", price: 750000, deliveryType: "log", note: "Shop đăng nhập nạp, cần Acc/Pass/3 mã dự phòng" },
    ],
  },
  {
    id: "nitro-trial",
    name: "Discord Nitro Trial",
    category: "discord",
    image: "assets/nitro.svg",
    badge: "DISCORD / NITRO TRIAL",
    description: "Nitro dùng thử giá siêu rẻ dành cho tài khoản chưa từng dùng Nitro hoặc đủ điều kiện.",
    features: [
      "Dành cho tài khoản mới hoặc chưa từng dùng Nitro",
      "Đầy đủ tính năng Nitro Boost 2 Boost",
      "Chọn nhận Link Gift hoặc Nạp Acc (Log)",
    ],
    detail:
      "Gói Nitro Trial cực rẻ để bạn trải nghiệm trọn vẹn Discord Nitro. Hỗ trợ 2 hình thức: [Gift] (gửi link claim quà tặng) hoặc [Log] (cung cấp tài khoản + mật khẩu + 3 mã dự phòng để shop nạp).",
    variants: [
      { id: "trial_gift_1m", name: "🎁 [Gift] Nitro Trial · 1 tháng", price: 39000, deliveryType: "gift", note: "Nhận link claim trực tiếp" },
      { id: "trial_gift_3m", name: "🎁 [Gift] Nitro Trial · 3 tháng", price: 79000, deliveryType: "gift", note: "Nhận link claim trực tiếp" },
      { id: "trial_log_1m", name: "🔑 [Log] Nitro Trial · 1 tháng (Nạp Acc)", price: 29000, deliveryType: "log", note: "Shop đăng nhập nạp, cần Acc/Pass/3 mã dự phòng" },
      { id: "trial_log_3m", name: "🔑 [Log] Nitro Trial · 3 tháng (Nạp Acc)", price: 59000, deliveryType: "log", note: "Shop đăng nhập nạp, cần Acc/Pass/3 mã dự phòng" },
    ],
  },
  {
    id: "decor-gift",
    name: "Discord Decor Gift",
    category: "decor",
    image: "assets/decor.svg",
    badge: "PROFILE / DECOR",
    description: "Khung avatar và hiệu ứng hồ sơ Discord nhận qua link quà tặng chính chủ, không cần gửi mật khẩu.",
    features: [
      "Khung avatar & hiệu ứng trang trí hồ sơ",
      "Nhận trực tiếp qua Link quà tặng (Gift)",
      "An toàn 100%, không cần tài khoản mật khẩu",
    ],
    detail:
      "Trang trí hồ sơ đại diện Discord độc đáo dạng quà tặng [Gift]. Bạn sẽ nhận được link claim quà tặng chính chủ để kích hoạt ngay vào tài khoản của mình mà không cần gửi tài khoản mật khẩu.",
    variants: [
      { id: "decor_gift_basic", name: "🎁 [Gift] Decor · Mẫu cơ bản", price: 49000, deliveryType: "gift", note: "Nhận link quà tặng, không cần tài khoản mật khẩu" },
      { id: "decor_gift_collection", name: "🎁 [Gift] Decor · Bộ sưu tập", price: 99000, deliveryType: "gift", note: "Nhận link quà tặng, không cần tài khoản mật khẩu" },
    ],
  },
  {
    id: "decor-log",
    name: "Discord Decor Log",
    category: "decor",
    image: "assets/decor.svg",
    badge: "PROFILE / DECOR",
    description: "Một chút điểm nhấn để hồ sơ của bạn mang chất riêng với khung avatar và hiệu ứng hồ sơ.",
    features: [
      "Khung avatar & hiệu ứng trang trí hồ sơ",
      "Shop đăng nhập nạp trực tiếp vào tài khoản (Log)",
      "Bảo hành đầy đủ suốt thời hạn",
    ],
    detail:
      "Trang trí hồ sơ đại diện Discord độc đáo dạng nạp tài khoản [Log]. Shop sẽ đăng nhập nạp trực tiếp vào tài khoản của bạn để nhận mẫu decor với giá tốt nhất.",
    variants: [
      { id: "decor_log_basic", name: "🔑 [Log] Decor · Mẫu cơ bản (Nạp Acc)", price: 39000, deliveryType: "log", note: "Shop đăng nhập nạp, cần Acc/Pass/3 mã dự phòng" },
      { id: "decor_log_collection", name: "🔑 [Log] Decor · Bộ sưu tập (Nạp Acc)", price: 79000, deliveryType: "log", note: "Shop đăng nhập nạp, cần Acc/Pass/3 mã dự phòng" },
    ],
  },
  {
    id: "boost",
    name: "Boost Server",
    category: "discord",
    image: "assets/boost.svg",
    badge: "COMMUNITY / BOOST",
    description: "Nâng cấp cấp độ server cộng đồng với âm thanh HD, emoji thêm và biểu tượng server.",
    features: [
      "Nâng cấp Level 1, 2, 3 cho Server",
      "Kích hoạt nhanh chóng trong ngày",
      "Bảo hành đầy đủ suốt thời hạn",
    ],
    detail:
      "Gói Boost Server giúp máy chủ của bạn đạt các cấp độ Level 1, 2, 3. Shop sẽ hỗ trợ boost trực tiếp vào link server bạn cung cấp.",
    variants: [
      { id: "two", name: "2 Boost Server · 1 tháng", price: 59000, deliveryType: "gift" },
      { id: "seven", name: "7 Boost Server · 1 tháng", price: 179000, deliveryType: "gift" },
      { id: "fourteen", name: "14 Boost Server · 1 tháng", price: 329000, deliveryType: "gift" },
    ],
  },
  {
    id: "youtube",
    name: "YouTube Premium",
    category: "entertainment",
    image: "assets/youtube.svg",
    badge: "WATCH / LISTEN",
    description: "Xem YouTube không quảng cáo, nghe nhạc tắt màn hình và tải ngoại tuyến.",
    features: [
      "Xem video không bị gián đoạn quảng cáo",
      "Bao gồm YouTube Music Premium",
      "Nâng cấp chính chủ trên email của bạn",
    ],
    detail:
      "YouTube Premium gia hạn hoặc nâng cấp chính chủ vào email của bạn. Không lo quảng cáo làm phiền khi học tập và giải trí.",
    variants: [
      { id: "monthly", name: "Premium · 1 tháng", price: 39000, deliveryType: "gift" },
      { id: "quarterly", name: "Premium · 3 tháng", price: 109000, deliveryType: "gift" },
    ],
  },
  {
    id: "capcut",
    name: "CapCut Pro",
    category: "creative",
    image: "assets/capcut.svg",
    badge: "CREATE / EDIT",
    description: "Mở khóa toàn bộ hiệu ứng, bộ lọc cao cấp và công cụ AI dựng video chuyên nghiệp.",
    features: [
      "Mở khóa toàn bộ hiệu ứng và mẫu Pro",
      "Xuất video độ nét cao 4K không watermark",
      "Hỗ trợ trên PC và điện thoại",
    ],
    detail:
      "CapCut Pro dành cho các nhà sáng tạo nội dung video, TikToker và Editor. Mở khóa toàn bộ tính năng và mẫu VIP.",
    variants: [
      { id: "monthly", name: "Pro · 1 tháng", price: 59000, deliveryType: "gift" },
      { id: "quarterly", name: "Pro · 3 tháng", price: 159000, deliveryType: "gift" },
    ],
  },
  {
    id: "netflix",
    name: "Netflix",
    category: "entertainment",
    image: "assets/netflix.svg",
    badge: "MOVIES / SERIES",
    description: "Thưởng thức hàng ngàn bộ phim điện ảnh và series bom tấn chất lượng 4K UHD.",
    features: [
      "Chất lượng hình ảnh 4K Ultra HD",
      "Profile riêng biệt có mã PIN bảo mật",
      "Xem mượt mà trên Smart TV, PC, Mobile",
    ],
    detail:
      "Tài khoản Netflix Premium xem phim bom tấn độ phân giải 4K sắc nét, hỗ trợ trên mọi thiết bị.",
    variants: [
      { id: "monthly", name: "Netflix · 1 tháng", price: 69000, deliveryType: "gift" },
      { id: "quarterly", name: "Netflix · 3 tháng", price: 189000, deliveryType: "gift" },
    ],
  },
  {
    id: "server-setup",
    name: "Setup Server Discord",
    category: "services",
    image: "assets/server.svg",
    badge: "SERVER / SETUP",
    description: "Thiết kế server chuyên nghiệp: phân quyền role, hệ thống kênh, bảo vệ anti-raid.",
    features: [
      "Thiết kế cấu trúc kênh và hệ thống role",
      "Cài đặt bot quản lý và phân quyền an toàn",
      "Trao đổi trực tiếp theo yêu cầu cụ thể",
    ],
    detail:
      "Gửi ý tưởng, quy mô cộng đồng và phong cách bạn thích qua Discord. Shop sẽ trao đổi hệ thống kênh, role, quyền và các thiết lập cần thiết trước khi báo giá.",
    service: true,
    variants: [],
  },
  {
    id: "custom-bot",
    name: "Custom Bot riêng",
    category: "services",
    image: "assets/bot.svg",
    badge: "YOUR BOT / YOUR RULES",
    description: "Lập trình Bot Discord mang thương hiệu và tính năng riêng biệt theo yêu cầu của bạn.",
    features: [
      "Xây dựng tính năng theo yêu cầu riêng",
      "Tùy chỉnh lệnh, ticket, XP, âm nhạc...",
      "Hỗ trợ triển khai và bảo trì uy tín",
    ],
    detail:
      "Mô tả tính năng bạn muốn: chào mừng, quản lý cộng đồng, ticket hoặc tiện ích riêng. Phạm vi, thời gian, hosting và hỗ trợ sau bàn giao cần được thống nhất với shop trên Discord.",
    service: true,
    variants: [],
  },
];

// Prices and package names are placeholders until the shop supplies its catalog.
const storeConfig = {
  name: "VietNam Legacy",
  discordUrl: "https://discord.gg/F3J7hWNRc4",
  storageKey: "vietnam-legacy-store-v1",
  currency: "VND",
};

const categoryNames = {
  all: "Tất cả",
  discord: "Discord",
  entertainment: "Giải trí",
  creative: "Sáng tạo",
  services: "Dịch vụ Discord",
};

const products = [
  {
    id: "nitro",
    name: "Discord Nitro",
    category: "discord",
    image: "assets/nitro.svg",
    badge: "DISCORD / NITRO",
    description: "Thêm màu sắc cho cách bạn trò chuyện và thể hiện bản thân.",
    features: [
      "Cá nhân hóa trải nghiệm Discord",
      "Chọn thời hạn phù hợp",
      "Hỏi shop về điều kiện kích hoạt",
    ],
    detail:
      "Chọn một gói Nitro để thử luồng mua hàng. Quyền lợi và phương thức kích hoạt cần được shop xác nhận trước khi mua thật.",
    variants: [
      { id: "monthly", name: "Nitro · 1 tháng", price: 79000 },
      { id: "quarterly", name: "Nitro · 3 tháng", price: 219000 },
    ],
  },
  {
    id: "decor",
    name: "Discord Decor",
    category: "discord",
    image: "assets/decor.svg",
    badge: "PROFILE / DECOR",
    description: "Một chút điểm nhấn để hồ sơ của bạn mang chất riêng.",
    features: [
      "Trang trí hồ sơ theo phong cách",
      "Chọn mẫu cùng shop trên Discord",
      "Xác nhận mẫu trước khi đặt",
    ],
    detail:
      "Danh mục trang trí hồ sơ minh họa. Mẫu decor, thời hạn và điều kiện sử dụng sẽ được shop cập nhật theo từng sản phẩm.",
    variants: [
      { id: "basic", name: "Decor · Mẫu cơ bản", price: 49000 },
      { id: "collection", name: "Decor · Bộ sưu tập", price: 99000 },
    ],
  },
  {
    id: "boost",
    name: "Boost Server",
    category: "discord",
    image: "assets/boost.svg",
    badge: "COMMUNITY / BOOST",
    description: "Tạo thêm điểm nhấn cho không gian cộng đồng của bạn.",
    features: [
      "Chọn số lượng boost",
      "Xác nhận server cần sử dụng",
      "Trao đổi thời hạn cùng shop",
    ],
    detail:
      "Gói Boost Server mẫu để minh họa việc chọn gói. Shop cần xác nhận số lượng, thời hạn và quyền lợi trước khi nhận đơn thực tế.",
    variants: [
      { id: "two", name: "2 boost · Gói mẫu", price: 59000 },
      { id: "seven", name: "7 boost · Gói mẫu", price: 179000 },
      { id: "fourteen", name: "14 boost · Gói mẫu", price: 329000 },
    ],
  },
  {
    id: "youtube",
    name: "YouTube Premium",
    category: "entertainment",
    image: "assets/youtube.svg",
    badge: "WATCH / LISTEN",
    description:
      "Không gian dành cho video, âm nhạc và những nội dung bạn thích.",
    features: [
      "Chọn thời hạn sử dụng",
      "Hỏi shop về khu vực áp dụng",
      "Xác nhận loại gói trước khi mua",
    ],
    detail:
      "Sản phẩm YouTube Premium mẫu. Loại gói, khu vực hỗ trợ và điều kiện kích hoạt sẽ được shop xác nhận khi tư vấn.",
    variants: [
      { id: "monthly", name: "Premium · 1 tháng", price: 39000 },
      { id: "quarterly", name: "Premium · 3 tháng", price: 109000 },
    ],
  },
  {
    id: "capcut",
    name: "CapCut Pro",
    category: "creative",
    image: "assets/capcut.svg",
    badge: "CREATE / EDIT",
    description: "Thêm lựa chọn cho những ý tưởng và câu chuyện bằng video.",
    features: [
      "Gói dành cho công việc sáng tạo",
      "Chọn thời hạn theo nhu cầu",
      "Hỏi shop về thiết bị hỗ trợ",
    ],
    detail:
      "Gói CapCut Pro minh họa. Phiên bản, nền tảng được hỗ trợ và phương thức kích hoạt cần được xác nhận với shop.",
    variants: [
      { id: "monthly", name: "Pro · 1 tháng", price: 59000 },
      { id: "quarterly", name: "Pro · 3 tháng", price: 159000 },
    ],
  },
  {
    id: "netflix",
    name: "Netflix",
    category: "entertainment",
    image: "assets/netflix.svg",
    badge: "MOVIES / SERIES",
    description: "Một lựa chọn cho những buổi tối cùng bộ phim yêu thích.",
    features: [
      "Gói giải trí theo thời hạn",
      "Trao đổi nhu cầu xem cùng shop",
      "Xác nhận quyền sử dụng và khu vực",
    ],
    detail:
      "Sản phẩm Netflix mẫu. Loại thuê bao, thiết bị, khu vực và điều kiện sử dụng cần được shop mô tả chính xác trước khi bán.",
    variants: [
      { id: "monthly", name: "Netflix · 1 tháng", price: 69000 },
      { id: "quarterly", name: "Netflix · 3 tháng", price: 189000 },
    ],
  },
  {
    id: "server-setup",
    name: "Setup Server Discord",
    category: "services",
    image: "assets/server.svg",
    badge: "SERVER / SETUP",
    description:
      "Một server có bố cục rõ ràng và phong cách riêng cho cộng đồng.",
    features: [
      "Thiết kế kênh và hệ thống role",
      "Tư vấn quyền và luồng thành viên",
      "Trao đổi cấu hình theo nhu cầu",
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
    description:
      "Bot mang dấu ấn server của bạn, xây dựng theo yêu cầu cụ thể.",
    features: [
      "Trao đổi chức năng cần phát triển",
      "Tùy chỉnh lệnh và luồng xử lý",
      "Thống nhất triển khai và bàn giao",
    ],
    detail:
      "Mô tả tính năng bạn muốn: chào mừng, quản lý cộng đồng, ticket hoặc tiện ích riêng. Phạm vi, thời gian, hosting và hỗ trợ sau bàn giao cần được thống nhất với shop trên Discord.",
    service: true,
    variants: [],
  },
];

(() => {
  'use strict';
  const root = document.documentElement;
  const read = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
  let language = read('vnl_language', 'vi') === 'en' ? 'en' : 'vi';
  let theme = read('vnl_theme', 'dark') === 'light' ? 'light' : 'dark';
  root.dataset.theme = theme;
  root.lang = language;
  const dictionary = {
"Hỗ trợ & liên hệ":"Support & contact",
"Discord chính của shop":"Official Discord",
"← Quay lại danh sách bài viết":"← Back to articles",
"Cần chọn gói, setup server hoặc phát triển bot? Gửi nhu cầu của bạn trong Discord chính của shop để trao đổi chi tiết.":"Need a plan, server setup or custom bot? Contact us on our official Discord to discuss your requirements.",
"Link cộng đồng chính do shop cung cấp.":"Official community link provided by the store.",
"bán Nitro, Decor, Boost Server và các gói giải trí, công cụ sáng tạo.":"offers Nitro, Decor, Server Boost, entertainment plans and creative tools.",
"Bạn có thể thanh toán bằng ví VietNam Legacy và nạp tiền qua mã VietQR ngân hàng. Theo dõi trạng thái đơn và nhận link quà tặng trong mục Đơn hàng của tôi.":"Pay with your VietNam Legacy wallet and top up using a bank VietQR code. Track orders and receive gift links in My orders.",
"Để hỏi về gói dịch vụ, đơn hàng hoặc bảo hành, hãy nhắn shop trên Discord chính thức.":"For questions about plans, orders or warranties, contact us on our official Discord.",
"Đặt hàng thành công!":"Order placed successfully!",
"Đơn hàng thành công!":"Order placed successfully!",
  "Còn trong kho:": "In stock:",
  "Thanh toán an toàn qua số dư ví tài khoản VietNam Legacy.": "Secure payment with your VietNam Legacy wallet balance.",
  "Quay lại danh sách bài viết": "Back to articles",
  "Tin Tức & Hướng Dẫn": "News & guides",
  "Hướng dẫn & Tin tức": "Guides & news",
  "KHÁM PHÁ": "EXPLORE",
  "Cửa hàng": "Store",
  "DANH MỤC": "CATEGORIES",
  "Nạp tiền & số dư": "Wallet & top up",
  "Đơn hàng của tôi": "My orders",
  "Sản phẩm yêu thích": "Favorites",
  "Dịch vụ Discord": "Discord services",
  "Giải trí & Premium": "Entertainment & Premium",
  "Sáng tạo & Công cụ": "Creative & tools",
  "ĐỒNG HÀNH CÙNG BẠN": "HERE FOR YOU",
  "Chọn gói phù hợp với bạn.": "Find your perfect plan.",
  "Xem các gói Discord, giải trí và công cụ sáng tạo tại shop.": "Browse Discord, entertainment and creative tools.",
  "Khám phá ngay": "Explore now",
  "Cửa hàng chính thức": "Official store",
  "TÌM KIẾM": "SEARCH",
  "Bạn đang tìm gì hôm nay?": "What are you looking for?",
  "Tìm kiếm sản phẩm": "Search products",
  "Đăng nhập": "Log in",
  "Giỏ hàng": "Cart",
  "Đăng xuất": "Log out",
  "THÔNG BÁO": "ANNOUNCEMENT",
  "Khám phá sản phẩm": "Explore products",
  "Mua hàng tiện lợi": "Easy shopping",
  "An toàn tuyệt đối": "Secure shopping",
  "Thanh toán tự động": "Automatic payment",
  "Giá cả phải chăng": "Affordable prices",
  "Nitro, Decor, Boost Server và những gói Premium, AI,...": "Nitro, Decor, Server Boost, Premium and AI plans.",
  "Hãy là một người mua hàng thông minh.": "Make every purchase a smart one.",
  "Chọn thứ bạn thích - Mua thứ bạn cần": "Choose what you like - Buy what you need",
  "Hướng dẫn mua hàng": "Shopping guides",
  "Cách mua hàng": "How to buy",
  "Xem tất cả ↗": "View all ↗",
  "Thông tin rõ ràng": "Clear information",
  "Mô tả và giá ngay trên sản phẩm": "Descriptions and prices on every product",
  "Mua sắm thuận tiện": "Convenient shopping",
  "Đặt mua nhanh chóng và tiện lợi": "Order quickly and easily",
  "Sẵn sàng kết nối": "Here to help",
  "Thông tin hỗ trợ ở một nơi": "All support details in one place",
  "DANH MỤC SẢN PHẨM": "PRODUCT CATALOG",
  "Tìm gói bạn đang cần": "Find the plan you need",
  "Giá và ưu đãi cập nhật từ cửa hàng": "Latest prices and offers from the store",
  "Sắp xếp sản phẩm": "Sort products",
  "Nổi bật nhất": "Featured",
  "Giá thấp đến cao": "Price: low to high",
  "Giá cao đến thấp": "Price: high to low",
  "Tên A → Z": "Name A → Z",
  "Tất cả": "All",
  "Giải trí": "Entertainment",
  "Sáng tạo": "Creative",
  "Thứ tự": "Custom order",
  "Hạng mục": "Categories",
  "Xóa bộ lọc ×": "Clear filters ×",
  "Chưa tìm thấy sản phẩm phù hợp": "No matching products",
  "Thử một từ khóa khác hoặc xem tất cả danh mục.": "Try another keyword or browse all categories.",
  "HƯỚNG DẪN MUA HÀNG": "SHOPPING GUIDES",
  "Cách mua hàng tại VietNam Legacy": "How to shop at VietNam Legacy",
  "DISCORD CỦA SHOP": "OUR DISCORD",
  "Gặp shop trên Discord.": "Meet us on Discord.",
  "Ghé Discord VietNam Legacy để hỏi về sản phẩm và kết nối cùng shop.": "Join VietNam Legacy on Discord for product questions and support.",
  "Tham gia Discord": "Join Discord",
  "© 2026 VietNam Legacy. Cửa hàng số chính hãng.": "© 2026 VietNam Legacy. Authentic digital products.",
  "Thông tin cửa hàng": "About the store",
  "Quản trị Admin": "Administration",
  "Giỏ hàng của bạn": "Your cart",
  "HOÀN TẤT ĐƠN HÀNG": "COMPLETE YOUR ORDER",
  "Thanh toán đơn hàng": "Checkout",
  "Tên người nhận": "Recipient name",
  "Email nhận thông tin": "Contact email",
  "🎁 GÓI GIFT (LINK QUÀ TẶNG)": "🎁 GIFT PLAN (GIFT LINK)",
  "không cần cung cấp tài khoản hay mật khẩu": "no account or password required",
  "🔑 GÓI NẠP ACC (LOG DISCORD)": "🔑 ACCOUNT ACTIVATION (DISCORD LOGIN)",
  "chỉ riêng Admin shop mới có quyền xem": "only the store administrator can view this",
  "3 Mã dự phòng Discord (Backup Codes)": "3 Discord backup codes",
  "Xem hướng dẫn chi tiết & video": "View detailed instructions & video",
  "🚀 GÓI BOOST SERVER DISCORD": "🚀 DISCORD SERVER BOOST",
  "Link mời vô thời hạn": "Invite link with no expiration",
  "🎨 MẪU DECOR CẦN MUA (AVATAR & PROFILE EFFECT)": "🎨 DECOR REFERENCE (AVATAR & PROFILE EFFECT)",
  "tải lên ảnh chụp màn hình": "upload a screenshot",
  "hoặc dán link ảnh mẫu bên dưới": "or paste a reference image link below",
  "Xem trước ảnh mẫu:": "Reference preview:",
  "✕ Xóa ảnh": "✕ Remove image",
  "Ghi chú đơn hàng": "Order notes",
  "(tùy chọn)": "(optional)",
  "Phương thức thanh toán:": "Payment method:",
  "Số dư Ví VietNam Legacy": "VietNam Legacy wallet balance",
  "Số dư hiện tại:": "Current balance:",
  "Đang kiểm tra...": "Checking...",
  "Mã giảm giá": "Discount code",
  "Áp dụng": "Apply",
  "Mỗi đơn áp dụng một mã giảm giá.": "One discount code per order.",
  "Bỏ mã": "Remove code",
  "Giá niêm yết": "List price",
  "Ưu đãi sản phẩm": "Product discount",
  "Tổng thanh toán": "Total payment",
  "Tài khoản & ví": "Account & wallet",
  "Đang tải giá...": "Loading prices...",
  "Hết hàng": "Out of stock",
  "Tạm hết": "Sold out",
  "Mua ngay": "Buy now",
  "Tư vấn": "Contact us",
  "MUA TRỰC TIẾP · Chọn gói bạn muốn để tiến hành thanh toán ngay": "BUY DIRECT · Select a plan to proceed to checkout",
  "Tạm thời hết hàng": "Temporarily unavailable",
  "🔥 Đã bán:": "🔥 Sold:",
  "Báo giá sau khi thống nhất yêu cầu và phạm vi thực hiện.": "A quote is provided once requirements and scope are agreed.",
  "Chọn gói sản phẩm": "Choose a plan",
  "Mặt hàng này hiện đang tạm hết trong kho. Vui lòng quay lại sau.": "This product is currently out of stock. Please check back later.",
  "Thanh toán an toàn qua số dư ví VietNam Legacy.": "Secure payment with your VietNam Legacy wallet.",
  "Giỏ hàng còn trống": "Your cart is empty",
  "Chọn một gói bạn thích để bắt đầu.": "Choose a plan to get started.",
  "Xóa": "Remove",
  "Tạm tính sau ưu đãi": "Subtotal after discounts",
  "Bạn có thể nhập mã giảm giá ở bước thanh toán.": "You can enter a discount code at checkout.",
  "Tiếp tục thanh toán": "Proceed to checkout",
  "Đang tải danh sách đơn hàng từ tài khoản của bạn...": "Loading your orders...",
  "Đăng nhập để xem số đơn đã mua và lịch sử của tài khoản.": "Log in to view your purchases and order history.",
  "Đăng nhập tài khoản": "Log in to your account",
  "Chưa tải được lịch sử mua hàng. Vui lòng kiểm tra kết nối và thử lại.": "Could not load your order history. Check your connection and try again.",
  "Thử lại": "Try again",
  "Đơn đã mua": "Orders placed",
  "Đã hoàn tất": "Completed",
  "Tổng tiền mua": "Total spent",
  "Không tính đơn đã hủy hoặc đang chờ thanh toán.": "Excludes cancelled orders and orders awaiting payment.",
  "← Trang trước": "← Previous page",
  "Trang sau →": "Next page →",
  "Tài khoản khách hàng": "Customer account",
  "🎁 Link Claim quà tặng / Thông tin nhận hàng của bạn:": "🎁 Gift claim link / Delivery details:",
  "Sao chép": "Copy",
  "Đã sao chép": "Copied",
  "Link Server Discord cần Boost:": "Discord server to boost:",
  "🎨 Ảnh mẫu Decor bạn yêu cầu mua:": "🎨 Your Decor reference image:",
  "Xem ảnh kích thước đầy đủ ↗": "View full-size image ↗",
  "Thanh toán: Ví VietNam Legacy": "Payment: VietNam Legacy wallet",
  "Chưa có đơn mua hàng nào trong tài khoản này.": "No orders in this account yet.",
  "Lịch sử mua hàng": "Order history",
  "Đọc tiếp →": "Read more →",
  "Không tìm thấy bài viết hoặc hướng dẫn nào phù hợp.": "No matching articles or guides.",
  "Không tải được video do trình duyệt chặn?": "Video blocked by your browser?",
  "Hình ảnh minh họa": "Illustrations",
  "🔍 Phóng to": "🔍 Enlarge",
  "Các bước thực hiện": "Instructions",
  "Đang tải hướng dẫn...": "Loading guide...",
  "Đang tải danh sách bài viết & hướng dẫn...": "Loading articles & guides...",
  "Không tìm thấy bài viết nào phù hợp.": "No matching articles.",
  "Hướng dẫn": "Guides",
  "Mẹo & Thủ thuật": "Tips & tricks",
  "Tin tức": "News",
  "Khác": "Other",
  "Tìm kiếm bài viết...": "Search articles...",
  "Quay lại danh sách": "Back to list",
  "← Quay lại": "← Back",
  "Mã đơn hàng:": "Order ID:",
  "Đã thanh toán:": "Paid:",
  "qua Ví VietNam Legacy.": "via VietNam Legacy wallet.",
  "Mẫu Decor:": "Decor reference:",
  "Gói Boost Server:": "Server Boost plan:",
  "Shop sẽ tham gia server theo link mời bạn cung cấp để thực hiện Boost.": "We will join your server using the invite link you provided to apply the boosts.",
  "Gói Nạp Acc (Log):": "Account activation plan:",
  "Tài khoản & mã dự phòng của bạn đã được mã hóa bảo mật, chỉ riêng Admin shop mới xem được để đăng nhập nạp gói.": "Your account and backup codes are encrypted. Only the store administrator can view them to activate your plan.",
  "Gói Link Gift:": "Gift link plan:",
  "Shop sẽ sớm gửi Link Claim trực tiếp trong mục \"Đơn hàng của tôi\".": "Your claim link will be sent to the My orders section shortly.",
  "Xem Đơn hàng của tôi": "View my orders",
  "Tiếp tục mua sắm": "Continue shopping",
  "Nhấn để kết nối ↗": "Click to connect ↗",
  "HỖ TRỢ": "SUPPORT",
  "Đăng ký": "Sign up",
  "Tạo tài khoản": "Create account",
  "Mật khẩu": "Password",
  "Nhập lại mật khẩu": "Confirm password",
  "Tối thiểu 10 ký tự": "At least 10 characters",
  "Hai mật khẩu chưa khớp.": "Passwords do not match.",
  "Số dư và lịch sử nạp được lưu theo tài khoản trên máy chủ.": "Your balance and top-up history are saved to your account.",
  "SỐ DƯ KHẢ DỤNG": "AVAILABLE BALANCE",
  "Xem lịch sử mua hàng →": "View order history →",
  "Tạo yêu cầu nạp rồi chuyển khoản đúng số tiền và nội dung. Số dư tự cập nhật khi ngân hàng xác nhận.": "Create a top-up request, then transfer the exact amount with the reference shown. Your balance updates after bank confirmation.",
  "Shop chưa mở nạp tiền. Đừng chuyển khoản trước khi yêu cầu nạp và mã QR được cấp tại đây.": "Top-ups are currently unavailable. Wait for a top-up request and QR code before making a transfer.",
  "Số tiền nạp (VND)": "Top-up amount (VND)",
  "Tạo yêu cầu nạp": "Create top-up request",
  "Lịch sử nạp tiền": "Top-up history",
  "Bạn chưa có giao dịch nạp tiền.": "You have no top-ups yet.",
  "← Quay lại ví": "← Back to wallet",
  "🙈 Che mã QR": "🙈 Hide QR code",
  "👁 Hiện mã QR": "👁 Show QR code",
  "Ngân hàng": "Bank",
  "Tài khoản nhận": "Recipient account",
  "Chủ tài khoản": "Account holder",
  "Số tiền": "Amount",
  "Nội dung chuyển khoản": "Transfer reference",
  "Kiểm tra giao dịch": "Check transaction",
  "Nếu số tiền hoặc nội dung không khớp, vui lòng liên hệ shop để đối soát.": "If the amount or reference does not match, please contact the store for verification.",
  "Hỗ trợ trên Discord ↗": "Get support on Discord ↗",
  "Đang tải tài khoản…": "Loading account…",
  "Đang xử lý": "Processing",
  "Đang xử lý.": "Processing.",
  "Chờ thanh toán": "Awaiting payment",
  "Đang chờ": "Pending",
  "Đã hủy": "Cancelled",
  "Hoàn thành": "Completed",
  "Đã hoàn thành": "Completed",
  "Chờ chuyển khoản": "Awaiting transfer",
  "Đã cộng tiền": "Credited",
  "Cần đối soát": "Verification required",
  "Hết hạn": "Expired",
  "Đang chờ hệ thống tự động cộng tiền (tự cập nhật mỗi 4 giây)...": "Waiting for automatic credit (updates every 4 seconds)...",
  "🎉 Nạp tiền thành công! Đã tự động cộng tiền vào ví.": "🎉 Top-up successful! Your wallet has been credited.",
  "Giao dịch cần shop đối soát. Số dư chưa được cộng.": "This transaction needs verification. Your balance has not been credited yet.",
  "Yêu cầu đã hết hạn. Nếu đã chuyển khoản, liên hệ shop để đối soát.": "This request has expired. If you already transferred, contact the store for verification.",
  "Đang tải giá sản phẩm, vui lòng thử lại.": "Loading product prices. Please try again.",
  "Chưa tải được giá từ cửa hàng.": "Could not load store prices.",
  "Tối đa 10 gói cùng loại trong một đơn.": "Maximum 10 units of the same plan per order.",
  "Đã đăng xuất tài khoản thành công.": "You have been logged out.",
  "Đóng": "Close",
  "Đóng menu": "Close menu",
  "Mở menu": "Open menu",
  "Menu cửa hàng": "Store menu",
  "Mở ví và tài khoản": "Open wallet and account",
  "Xem đơn hàng": "View orders",
  "Đăng xuất tài khoản": "Log out",
  "Thông báo cửa hàng": "Store announcement",
  "Lọc theo danh mục": "Filter by category",
  "Chế độ hiển thị mặt hàng": "Product display mode",
  "Xem theo thứ tự sắp xếp tùy chỉnh": "View custom order",
  "Phân chia theo từng hạng mục": "Group by category",
  "Lọc riêng hạng mục này": "Filter this category",
  "Mặt hàng hiện đã hết": "This item is out of stock",
  "Tài khoản": "Account",
  "Thống kê mua hàng": "Purchase summary",
  "Bấm để che hoặc hiện mã QR": "Show or hide the QR code",
  "Còn:": "Stock:",
  "TỪ": "FROM",
  "DỊCH VỤ DISCORD": "DISCORD SERVICES",
  "GIẢI TRÍ": "ENTERTAINMENT",
  "SÁNG TẠO": "CREATIVE",
  "Nhận đơn": "Available",
  "BÁO GIÁ THEO YÊU CẦU": "CUSTOM QUOTE",
  "Liên hệ": "Contact us",
  "Xem video & hướng dẫn mua": "Watch video & shopping guide",
  "Xem video và hướng dẫn nạp tiền vào ví, đặt đơn, nhận link quà tặng Discord.": "Watch how to top up your wallet, place an order and receive your Discord gift link.",
  "Xác nhận thanh toán": "Confirm payment",
  "Tài khoản Discord (Email hoặc SĐT)": "Discord account (email or phone)",
  "Mật khẩu Discord": "Discord password",
  "Nhập mật khẩu Discord của bạn": "Enter your Discord password",
  "VD: discord_user@gmail.com hoặc 0912345678": "Example: discord_user@gmail.com or phone number",
  "VD: 12345678, 87654321, 99887766": "Example: 12345678, 87654321, 99887766",
  "VD: https://discord.gg/vnlcommunity": "Example: https://discord.gg/vnlcommunity",
  "Nhập mã ưu đãi": "Enter discount code",
  "Ghi chú thêm về yêu cầu hoặc lưu ý...": "Additional requirements or notes...",
  "Nhập tên của bạn": "Enter your name",
  "📖 Hướng dẫn lấy mã 2FA ↗": "📖 How to get backup codes ↗",
  "Link mời vô thời hạn Server cần Boost": "Permanent invite link for the server to boost",
  "📷 Tải ảnh từ máy / điện thoại": "📷 Upload from computer / phone",
  "https://... hoặc tải ảnh trực tiếp ở nút trên": "https://... or upload using the button above",
  "Bạn": "You",
  ". Sau khi đặt đơn thành công, shop sẽ gửi link claim quà Discord trực tiếp vào mục Đơn hàng của bạn!": ". After your order is placed, we will send your Discord gift claim link to My orders!",
  "Đơn của bạn có gói nạp trực tiếp vào tài khoản Discord. Thông tin được mã hóa bảo mật,": "Your order includes direct activation on your Discord account. Your details are encrypted;",
  "để đăng nhập nạp gói.": "to sign in and activate your plan.",
  "(Cài đặt Discord → Tài khoản → Xem mã dự phòng 2FA. Nhập 3 mã 8 số cách nhau bằng dấu phẩy ·": "(Discord Settings → My Account → View Backup Codes. Enter three 8-digit codes separated by commas ·",
  "Vui lòng cung cấp": "Please provide a",
  "để shop có thể vào server và thực hiện boost.": "so we can join your server and apply the boosts.",
  "(Vào Discord Server → Tạo lời mời → Chỉnh sửa link mời → Chọn \"Không bao giờ hết hạn\")": "(Discord server → Invite People → Edit invite link → Choose Never expire)",
  "Vui lòng": "Please",
  "hoặc nhập link ảnh mẫu Decor (Khung Avatar / Hiệu ứng hồ sơ) trong Shop Discord mà bạn muốn mua để shop biết và giao đúng mẫu.": "or enter an image link of the Decor (avatar decoration / profile effect) you want from the Discord Shop so we can deliver the right item.",
  "Đang kiểm tra giá và ưu đãi...": "Checking prices and discounts...",
  "Vui lòng đăng nhập tài khoản để thanh toán bằng ví.": "Please log in to pay with your wallet.",
  "Email hoặc mật khẩu không đúng.": "Incorrect email or password.",
  "Không thể sao chép tự động. Hãy bôi đen link để chép.": "Could not copy automatically. Select the link and copy it manually.",
  "Hệ thống tài khoản và nạp tiền chưa được kết nối trên địa chỉ này. Chức năng sẽ mở khi máy chủ của shop sẵn sàng.": "Accounts and top-ups are not connected at this address. They will be available once the store server is ready.",
  "Hiện chưa thể đăng ký, chuyển khoản hoặc nhận số dư tại đây.": "Sign-up, transfers and wallet credit are currently unavailable here.",
  "Đóng ví": "Close wallet",
  "Chưa đăng nhập": "Not logged in",
  "Chưa kết nối máy chủ": "Server unavailable",
  "Đang xử lý...": "Processing...",
  "Đã chép!": "Copied!",
  "Bấm Áp dụng để kiểm tra mã hoặc Bỏ mã để tiếp tục.": "Click Apply to check the code or Remove code to continue.",
  "⚠️ Bạn chưa đăng nhập ví. Vui lòng bấm vào nút 'Đăng nhập' ở thanh trên để đăng nhập tài khoản trước khi thanh toán.": "⚠️ Please use Log in in the top bar to sign in before paying.",
  "Vui lòng nhập tên người nhận.": "Please enter the recipient name.",
  "Vui lòng tải lên ảnh chụp màn hình hoặc nhập link ảnh mẫu Decor bạn cần mua để shop biết và giao đúng mẫu.": "Please upload a screenshot or enter a Decor reference image link so we can deliver the right item.",
  "Vui lòng nhập link mời vô thời hạn của server Discord cần Boost.": "Please enter a permanent invite link for the Discord server to boost.",
  "Link mời server Discord không hợp lệ. Vui lòng cung cấp link mời dạng https://discord.gg/abcxyz hoặc discord.gg/abcxyz": "Invalid Discord server invite. Use a link such as https://discord.gg/abcxyz or discord.gg/abcxyz.",
  "Vui lòng nhập tài khoản Discord (Email hoặc SĐT) để nạp gói.": "Please enter your Discord account (email or phone) for activation.",
  "Vui lòng nhập mật khẩu Discord để nạp gói.": "Please enter your Discord password for activation.",
  "Vui lòng nhập tối thiểu 3 mã dự phòng Discord (Backup Codes) cách nhau bởi dấu phẩy.": "Please enter at least three Discord backup codes, separated by commas.",
  "Vui lòng chọn tệp hình ảnh (JPG, PNG, WEBP...)": "Please choose an image file (JPG, PNG, WEBP...).",
  "Không thể đọc tệp ảnh. Vui lòng chọn ảnh khác.": "Could not read this image. Please choose another one."
};
  const normalize = value => value.replace(/\s+/g, ' ').trim();
  function translate(value) {
    const key = normalize(value);
    if (language !== 'en') return value;
    let translated = dictionary[key];
    if (!translated) {
      const rules = [
        [/^Số dư ví (.+), cần thanh toán (.+)\. Vui lòng nạp thêm tiền\.$/, 'Wallet balance: $1. Payment due: $2. Please top up.'],
        [/^⚠️ Số dư ví không đủ (.+)\. Vui lòng nạp thêm tiền vào ví để thanh toán đơn\.$/, '⚠️ Insufficient balance $1. Please top up your wallet to pay.'],
        [/^(\d+) sản phẩm & dịch vụ( yêu thích)?$/, '$1 products & services$2'],
        [/^Đã bán được (\d+) sản phẩm$/, '$1 products sold'],
        [/^👁 ([\d.,]+) lượt xem$/, '👁 $1 views'],
        [/^Đã áp dụng (.+): tiết kiệm (.+)\.$/, 'Applied $1: saved $2.'],
        [/^Chuyển đúng số tiền và giữ nguyên nội dung\. Chỉ chuyển một lần cho mỗi yêu cầu\. Yêu cầu có hiệu lực đến (.+)\.$/, 'Transfer the exact amount with the reference shown. Make only one transfer per request. Valid until $1.'],
        [/^Hiển thị (\d+) (?:sản phẩm|mặt hàng)$/, '$1 products'],
        [/^(\d+) (sản phẩm|mặt hàng & gói dịch vụ)$/, '$1 products & services'],
        [/^Tất cả \((\d+)\)$/, 'All ($1)'],
        [/^Hướng dẫn \((\d+)\)$/, 'Guides ($1)'],
        [/^Mẹo & Thủ thuật \((\d+)\)$/, 'Tips & tricks ($1)'],
        [/^Tin tức \((\d+)\)$/, 'News ($1)'],
        [/^Đã thêm (.+) vào giỏ hàng$/, 'Added $1 to your cart'],
        [/^Xem chi tiết (.+)$/, 'View details: $1'],
        [/^Minh họa (.+)$/, 'Illustration: $1'],
        [/^Đọc hướng dẫn: (.+)$/, 'Read guide: $1'],
        [/^Giảm số lượng (.+)$/, 'Decrease quantity: $1'],
        [/^Tăng số lượng (.+)$/, 'Increase quantity: $1'],
        [/^Xóa (.+) khỏi giỏ$/, 'Remove $1 from cart'],
        [/^Bỏ yêu thích (.+)$/, 'Remove $1 from favorites'],
        [/^Yêu thích (.+)$/, 'Add $1 to favorites'],
        [/^(\d[\d.,]*) lượt xem$/, '$1 views'],
        [/^Trang (\d+) \/ (\d+)$/, 'Page $1 / $2'],
      ];
      for (const [pattern, replacement] of rules) {
        if (pattern.test(key)) { translated = key.replace(pattern, replacement); break; }
      }
    }
    return translated ? value.replace(value.trim(), translated.replace(' yêu thích', ' favorites')) : value;
  }
  window.VNLPreferences = { t: translate, get language() { return language; }, get theme() { return theme; } };
  const headingState = new WeakMap();
  const textState = new WeakMap();
  const attrState = new WeakMap();
  const excluded = '#hero-title .intro-line-content,script,style,textarea,code,pre,[contenteditable], [data-no-i18n],.product-heading,#product-title,.guide-reader-title,.guide-reader-content,.guide-store-card-title,.hero-guide-card strong,.announcement-text';
  function translateText(node) {
    if (!node.parentElement || node.parentElement.closest(excluded)) return;
    let state = textState.get(node);
    if (!state || node.nodeValue !== state.output) state = { original: node.nodeValue };
    const output = translate(state.original);
    if (node.nodeValue !== output) node.nodeValue = output;
    state.output = output;
    textState.set(node, state);
  }
  function translateAttributes(element) {
    if (element.closest(excluded)) return;
    let states = attrState.get(element);
    if (!states) { states = {}; attrState.set(element, states); }
    for (const attr of ['placeholder', 'title', 'aria-label']) {
      if (!element.hasAttribute(attr)) continue;
      const value = element.getAttribute(attr);
      let state = states[attr];
      if (!state || state.output !== value) state = { original: value };
      state.output = translate(state.original);
      if (state.output !== value) element.setAttribute(attr, state.output);
      states[attr] = state;
    }
  }
  function translateTree(node) {
    if (node.nodeType === Node.TEXT_NODE) return translateText(node);
    if (node.nodeType !== Node.ELEMENT_NODE || node.closest(excluded)) return;
    node.querySelectorAll('#hero-title .intro-line-content').forEach(element => {
      if (!headingState.has(element)) headingState.set(element, element.textContent);
      const output = translate(headingState.get(element));
      if (normalize(element.textContent) !== normalize(output)) element.textContent = output;
    });
    translateAttributes(node);
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const child = walker.currentNode;
      if (child.nodeType === Node.TEXT_NODE) translateText(child);
      else translateAttributes(child);
    }
  }
  function applyTheme() {
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#fafafa' : '#090909');
    const button = document.querySelector('#theme-toggle');
    if (button) {
      button.textContent = theme === 'dark' ? '☾' : '☀';
      button.setAttribute('aria-pressed', String(theme === 'light'));
      button.setAttribute('aria-label', language === 'en' ? (theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme') : (theme === 'dark' ? 'Chuyển sang giao diện trắng' : 'Chuyển sang giao diện đen'));
      button.title = button.getAttribute('aria-label');
    }
    document.dispatchEvent(new CustomEvent('vnl:theme', { detail: { theme } }));
  }
  function start() {
    const observer = new MutationObserver(records => {
      observer.disconnect();
      for (const record of records) {
        if (record.type === 'characterData') translateText(record.target);
        else if (record.type === 'attributes') translateAttributes(record.target);
        else record.addedNodes.forEach(translateTree);
      }
      observe();
    });
    const observe = () => observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder','title','aria-label'] });
    const select = document.querySelector('#language-select');
    if (select) {
      select.value = language;
      select.addEventListener('change', () => {
        observer.disconnect();
        language = select.value === 'en' ? 'en' : 'vi';
        root.lang = language;
        try { localStorage.setItem('vnl_language', language); } catch {}
        translateTree(document.body);
        applyTheme();
        document.dispatchEvent(new CustomEvent('vnl:language', { detail: { language } }));
        observe();
      });
    }
    document.querySelector('#theme-toggle')?.addEventListener('click', () => {
      theme = theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('vnl_theme', theme); } catch {}
      applyTheme();
    });
    translateTree(document.body);
    applyTheme();
    observe();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

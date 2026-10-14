# Chạy VietNam Legacy trên Vercel

Giao diện được build vào `dist`; các đường dẫn `/api/*` chạy qua một Vercel Function. Tài khoản, phiên đăng nhập, đơn hàng và ví được lưu trong Turso **libSQL**. Không dùng file SQLite trên Vercel. Bản chạy trên máy vẫn dùng SQLite cục bộ.

## Kết nối database

1. Mở đúng dự án Vercel gắn domain `vietnamlegacy.shop` (không chọn nhầm dự án khác cùng repository).
2. Storage → tạo/kết nối Turso. Dùng database libSQL tương thích `@libsql/client`.
3. Kết nối môi trường Production với **một database cố định**, giữ nguyên qua các lần deploy. Tắt tạo database branch mới cho từng production deployment. Không xóa database hoặc đổi URL nếu đã có dữ liệu.
4. Nếu thử nghiệm Preview, dùng database thử nghiệm riêng, không chứa tiền thật; để `PAYMENTS_MODE=disabled`.
5. Settings → Environment Variables: kiểm tra các biến dưới đây. Không đưa token hoặc mật khẩu vào GitHub hay chat.

| Biến | Giá trị |
| --- | --- |
| `PUBLIC_ORIGIN` | `https://vietnamlegacy.shop` (đúng domain khách đang dùng, không có đường dẫn) |
| `TURSO_DATABASE_URL` | URL database do Turso cung cấp; cũng nhận `TURSO_URL` nếu integration dùng prefix TURSO |
| `TURSO_AUTH_TOKEN` | Database auth token do Turso cung cấp; cũng nhận `TURSO_DATABASE_AUTH_TOKEN` |
| `ADMIN_PASSWORD` | Mật khẩu quản trị riêng, đủ mạnh; bỏ trống sẽ khóa API quản trị |
| `PAYMENTS_MODE` | `disabled` trong lúc cấu hình |

Nếu integration tạo tên khác, tạo biến tương ứng trong bảng bằng giá trị nhận được từ Turso. Không dùng management/API token của tài khoản thay cho database auth token. Sau khi đổi biến, Redeploy deployment mới nhất. Mã tự tạo bảng trên database trống; không tự nhập dữ liệu từ SQLite cũ.

Nếu đã có tài khoản hoặc số dư trong database cũ, cần sao lưu và chuyển dữ liệu trước khi cho khách dùng database mới. Không tạo lại số dư bằng cách phát lại webhook.

## Cấu hình build

Root Directory là thư mục chứa `package.json` và `vercel.json`. `vercel.json` đặt Framework là Other, Build Command `npm run build`, Output Directory `dist`. Dùng Node.js 24.x. Không chọn `server` làm Root Directory.

## Kiểm tra sau deploy

- Trang chủ mở được kể cả khi database chưa cấu hình.
- `/api/health` trả `{"ok":true}` khi kết nối database thành công. Nếu thiếu cấu hình, API trả 503 có thông báo; xem Function Logs, không công khai token.
- Tạo tài khoản thử, đăng xuất/đăng nhập, kiểm tra số dư ban đầu bằng 0.
- Redeploy và đăng nhập lại: tài khoản vẫn tồn tại vì URL database không đổi.
- Chỉ bật nạp tiền sau khi cấu hình SePay và kiểm thử webhook. Cần các biến `BANK_CODE`, `BANK_GATEWAY`, `BANK_ACCOUNT_NUMBER`, `BANK_ACCOUNT_NAME`, `SEPAY_WEBHOOK_SECRET` như `.env.example`; đặt `PAYMENTS_MODE=live` sau cùng.
- Webhook: `https://vietnamlegacy.shop/api/webhooks/sepay`. Backend hiện kiểm tra HMAC-SHA256 với timestamp trên **nguyên bản body**. Cấu hình SePay phải khớp phương thức này; chưa kết nối/kiểm thử SePay thật thì chưa coi tự cộng tiền là đã hoạt động.

## Kiểm thử mã nguồn

`npm ci`, `npm test`, `npm run build`.

Các test dùng ngân hàng và giao dịch giả. Không kiểm thử ghi tiền vào database production. Giới hạn tần suất hiện lưu trong bộ nhớ từng function; khi vận hành quy mô lớn cần bổ sung giới hạn dùng chung/WAF.

# VietNam Legacy

Cửa hàng và backend tài khoản/ví: đăng ký, đăng nhập bằng email và mật khẩu, xem số dư, tạo yêu cầu chuyển khoản, lịch sử nạp và webhook SePay tự động cộng tiền.

**Hiện nạp tiền đang khóa (`PAYMENTS_MODE=disabled`). Chưa có kết nối SePay hoặc hosting và chưa xác nhận giao dịch ngân hàng thật.** Giao diện cửa hàng vẫn dùng bảng giá và đơn hàng thử; ví chưa được dùng để trừ tiền mua hàng.

## Chạy trên máy

Cài Node.js 24 hoặc mới hơn. Không cần cài thư viện ngoài.

```powershell
cd C:\Users\Administrator\Documents\GitHub\webVNL
Copy-Item .env.example .env
npm start
```

Mở http://localhost:3000. Không mở `index.html` trực tiếp nếu muốn đăng ký/đăng nhập. Muốn chạy kiểm thử: `npm test` (dùng ngân hàng giả và cơ sở dữ liệu tạm; không tạo giao dịch tiền thật).

File `.env` chỉ lưu trên máy hoặc cấu hình bằng Variables của hosting; không đưa lên GitHub. `data/vnl.sqlite` lưu tài khoản, phiên đăng nhập và dữ liệu ví, không đưa lên GitHub.

## Railway

1. Đưa mã nguồn lên repository GitHub của bạn, gồm `server/`, `Dockerfile`, `package.json`, `railway.json`, `wallet.js`, `wallet.css` và các tệp giao diện. Không đưa `.env` hoặc `data/` lên repository. Bản cập nhật này chỉ thay tệp trên máy, không tự commit/push.
2. Trong Railway chọn **New Project → Deploy from GitHub repo**, chọn repository. Dockerfile cố định Node.js 24; không cần build hoặc cài gói npm.
3. Thêm **Volume** gắn vào service web, mount tại **`/data`**. Giữ **1 replica**. SQLite cần một service và ổ lưu trữ bền vững, không dùng ổ tạm.
4. Tạo domain HTTPS trong phần Networking, rồi đặt Variables:

```text
HOST=0.0.0.0
NODE_ENV=production
PUBLIC_ORIGIN=https://TEN-DOMAIN-CUA-BAN.up.railway.app
DATABASE_PATH=/data/vnl.sqlite
PAYMENTS_MODE=disabled
BANK_CODE=970415
BANK_GATEWAY=VietinBank
BANK_ACCOUNT_NUMBER=YOUR_BANK_ACCOUNT_NUMBER
BANK_ACCOUNT_NAME=YOUR_BANK_ACCOUNT_NAME
```

Thay `PUBLIC_ORIGIN` bằng domain thật, không thêm đường dẫn hoặc dấu `/` cuối. Railway tự cấp `PORT`; ứng dụng đọc biến này. Healthcheck: `/api/health`. Khi đổi domain, cập nhật `PUBLIC_ORIGIN` và địa chỉ webhook.

5. Deploy và kiểm tra đăng ký, đăng nhập, đăng xuất. Nút nạp vẫn khóa. Không thêm secret vào mã nguồn hay ảnh chụp công khai.
6. Sao lưu dữ liệu ví định kỳ và trước mỗi cập nhật backend. Volume giữ dữ liệu qua các lần deploy nhưng không thay thế backup. Với SQLite đang chạy, dùng công cụ SQLite backup hoặc dừng service trước khi sao chép dữ liệu; không chỉ sao chép file chính trong khi đang ghi WAL.

Railway có giới hạn dùng thử/credit và chi phí tài nguyên, gồm Volume. Xem bảng giá hiện tại: https://docs.railway.com/pricing/plans và https://docs.railway.com/pricing/free-trial. Khi hết credit hoặc xóa Volume, dịch vụ/dữ liệu có thể không còn khả dụng.

## Kết nối SePay

1. Đăng ký SePay, kết nối tài khoản **VietinBank YOUR_BANK_ACCOUNT_NUMBER**. Xác nhận ứng dụng ngân hàng hiển thị đúng chủ tài khoản **YOUR_BANK_ACCOUNT_NAME**. Kiểm tra gói và ngân hàng được SePay hỗ trợ trước khi bật.
2. Tạo webhook sự kiện **Có tiền vào**, chọn đúng tài khoản, URL:

```text
https://DOMAIN-CUA-BAN/api/webhooks/sepay
```

3. Chọn định dạng JSON và bảo mật **HMAC-SHA256**. Lưu cùng secret (tối thiểu 32 ký tự) vào Variable `SEPAY_WEBHOOK_SECRET` trên Railway. Secret này là secret ký webhook, không phải mật khẩu ngân hàng hay API token tài khoản. Không gửi secret trong chat.
4. Cấu hình mã thanh toán của SePay để nhận dạng tiền tố `VNL`. Ứng dụng vẫn đọc mã trong `content` nếu trường `code` trống. Mỗi yêu cầu có mã riêng, ví dụ `VNL` và 12 ký tự hex.
5. Chỉ khi domain HTTPS, Volume, ngân hàng, secret và webhook đã cấu hình đúng mới đổi `PAYMENTS_MODE=live`. Thực hiện kiểm thử trên tài khoản của chủ shop trước khi cho khách dùng. Không gửi webhook giả trong môi trường live để thử cộng số dư.
6. Tạo một yêu cầu nạp nhỏ và tự chuyển đúng số tiền/nội dung từ tài khoản của bạn. Kiểm tra nhật ký SePay, trạng thái yêu cầu và số dư. Nếu chưa khớp, tắt nạp và đối soát trước khi mở cho khách.

Tài liệu chính thức: https://docs.sepay.vn/tich-hop-webhooks.html và https://developer.sepay.vn/vi/sepay-webhooks/xac-thuc.

## Quy tắc cộng tiền

- Chỉ webhook có chữ ký HMAC hợp lệ trên bytes gốc và timestamp trong 5 phút được xử lý.
- Chỉ tiền vào đúng ngân hàng/tài khoản, đúng mã yêu cầu, đúng số tiền nguyên VND được cộng tự động. Từ 10.000 đến 10.000.000 đồng mỗi yêu cầu.
- Yêu cầu hết hạn sau 24 giờ; tối đa 3 yêu cầu đang chờ mỗi tài khoản và 10 yêu cầu mới mỗi giờ.
- ID giao dịch và mã tham chiếu được kiểm tra trùng. Một yêu cầu chỉ có một bút toán cộng tiền. Webhook gửi lại được nhận thành công nhưng không cộng thêm.
- Ghi giao dịch, bút toán và cập nhật yêu cầu cùng một transaction SQLite. Nếu ghi lỗi, toàn bộ thao tác rollback để retry không làm mất hoặc cộng trùng tiền.
- Sai số tiền hoặc yêu cầu hết hạn được chuyển sang `review`, chưa cộng số dư. Sai mã, sai tài khoản và giao dịch tiền ra được lưu kết quả trong `bank_events`, không cộng tiền. Chủ shop cần đối chiếu sao kê/SePay trước khi giải quyết; chưa có giao diện quản trị hoặc nút cộng thủ công.
- Trình duyệt chỉ đọc số dư từ máy chủ. Không có API cho khách tự đặt số dư, cộng tiền hoặc xác nhận “đã trả”.

## Tài khoản và phạm vi hiện tại

Mật khẩu lưu bằng scrypt với salt riêng; cookie phiên HttpOnly/SameSite, Secure khi chạy production. Các thao tác ví yêu cầu đúng origin và CSRF token. Phiên hết hạn sau 7 ngày. Truy vấn yêu cầu nạp kiểm tra chủ tài khoản. Secret, cơ sở dữ liệu và mã backend không được phục vụ như file tĩnh.

Đã có giới hạn tốc độ đăng nhập và tạo yêu cầu, nhưng giới hạn trong bộ nhớ áp dụng cho một process. Hệ thống chưa có xác minh quyền sở hữu email, quên mật khẩu, 2FA, quản trị, đối soát thủ công, hoàn tiền hoặc thanh toán đơn hàng bằng ví. Cần bổ sung các luồng vận hành đó trước khi mở bán đầy đủ; đừng kích hoạt tiền thật chỉ để xem giao diện.

## Tệp chính

- `index.html`, `styles.css`, `app.js`, `products.js`, `assets/`: cửa hàng; màu sản phẩm và nút mua xanh đã giữ nguyên.
- `wallet.js`, `wallet.css`: tài khoản, số dư, trang nạp QR, kiểm tra trạng thái và lịch sử.
- `server/app.js`: API và phục vụ giao diện cùng domain.
- `server/security.js`: mật khẩu, phiên/CSRF, chữ ký webhook và giới hạn yêu cầu.
- `server/store.js`, `server/schema.sql`: lưu dữ liệu và cộng tiền nguyên tử.
- `.env.example`: tên biến cấu hình và thông tin ngân hàng; nạp tiền mặc định khóa.
- `Dockerfile`, `railway.json`: chạy trên Railway.
- `tests/payments.test.js`: kiểm thử tiền/ví/tài khoản, chỉ dùng dữ liệu giả.

Discord hỗ trợ: https://discord.gg/F3J7hWNRc4

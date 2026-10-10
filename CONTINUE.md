# Điểm lưu để tiếp tục

Đã tạm dừng theo yêu cầu của chủ shop ngày 10/10/2026.

## Đã làm

- Giữ giao diện VNL đỏ/vàng, màu riêng của từng ứng dụng, nút thêm giỏ xanh nước biển.
- Thêm giao diện đăng ký/đăng nhập email, ví, yêu cầu nạp QR, trạng thái và lịch sử.
- Backend Node.js 24 + SQLite: mật khẩu scrypt, cookie phiên, kiểm tra chủ tài khoản và CSRF.
- Tích hợp webhook SePay HMAC-SHA256 và chống cộng trùng; lưu tiền nguyên VND, cộng trong transaction.
- Thông tin nhận tiền VietinBank đã điền trong `.env.example`; chưa có secret SePay.
- Dockerfile, cấu hình và hướng dẫn Railway + Volume trong README.
- 10 kiểm thử backend đã đạt; kiểm thử luồng giao diện bằng jsdom đã đạt. Chưa kiểm tra giao diện bản ví trong trình duyệt thực và chưa chạy giao dịch ngân hàng thật.

## Trạng thái

`PAYMENTS_MODE=disabled`. Chưa có hosting, SePay hoặc secret webhook. Không có giao dịch tiền thật. Bản website trên chatgpt.site chưa có phần ví này. Chỉ cập nhật tệp nguồn trên máy; chưa commit/push GitHub hoặc triển khai Railway.

## Khi tiếp tục

1. Kiểm tra giao diện tài khoản/ví trên máy và điện thoại.
2. Đưa repository lên Railway, gắn Volume `/data`, cấu hình Variables theo README; giữ nạp khóa.
3. Kết nối ngân hàng với SePay và cấu hình webhook HMAC. Secret nhập trực tiếp trong Railway/SePay, không gửi trong chat hoặc commit.
4. Bổ sung luồng xác minh email/khôi phục tài khoản, quản trị/đối soát phù hợp trước khi mở bán đầy đủ. Ví chưa trừ tiền mua hàng; giá và đơn hàng vẫn là mẫu.
5. Chỉ mở nạp thật sau khi đối chiếu cấu hình và kiểm thử với tài khoản chủ shop.

Không ghi đè `.env`, `data/` hoặc cơ sở dữ liệu khi cập nhật mã nguồn. Dữ liệu ví cần backup riêng.

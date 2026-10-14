// Mở file HTML bằng cách nhấp đúp vẫn đi đến bản có dữ liệu của cửa hàng.
// Khi website chạy trên HTTP/HTTPS, giữ nguyên địa chỉ hiện tại.
(() => {
  if (window.location.protocol !== "file:") return;
  const isAdmin = /\/admin\.html$/i.test(window.location.pathname);
  const destination = new URL(isAdmin ? "/admin" : "/", "http://127.0.0.1:3201");
  destination.hash = window.location.hash;
  window.location.replace(destination.href);
})();

import fs from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1200px;
    height: 720px;
    background: #140b0d;
    font-family: "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #fff8ee;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 22px 32px;
    position: relative;
    overflow: hidden;
  }
  
  /* Website tone radial ambient glows */
  .bg-glow-gold {
    position: absolute;
    top: -80px;
    right: 120px;
    width: 600px;
    height: 400px;
    background: radial-gradient(circle, rgba(255, 209, 92, 0.16) 0%, rgba(255, 209, 92, 0) 70%);
    pointer-events: none;
  }
  .bg-glow-wine {
    position: absolute;
    bottom: -80px;
    left: 80px;
    width: 650px;
    height: 420px;
    background: radial-gradient(circle, rgba(180, 35, 65, 0.22) 0%, rgba(180, 35, 65, 0) 70%);
    pointer-events: none;
  }
  .bg-grid {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba(255, 209, 92, 0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 209, 92, 0.04) 1px, transparent 1px);
    background-size: 28px 28px;
    pointer-events: none;
  }

  /* Header */
  .header {
    position: relative;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #3b292c;
    padding-bottom: 12px;
  }
  .brand-group {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .logo-box {
    width: 44px;
    height: 44px;
    background: linear-gradient(135deg, #2a161b, #3d1e24);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    font-weight: 900;
    color: #ffd15c;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.5), inset 0 0 12px rgba(255, 209, 92, 0.15);
    border: 1px solid rgba(255, 209, 92, 0.35);
    letter-spacing: 0.5px;
  }
  .title-group h1 {
    font-size: 22px;
    font-weight: 900;
    letter-spacing: 0.5px;
    background: linear-gradient(135deg, #fff8ee 40%, #ffd15c 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    text-transform: uppercase;
  }
  .title-group p {
    font-size: 12px;
    color: #b8a8a8;
    margin-top: 2px;
  }
  .badge-tag {
    background: rgba(255, 209, 92, 0.1);
    border: 1px solid rgba(255, 209, 92, 0.38);
    color: #ffd15c;
    padding: 6px 16px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.8px;
    box-shadow: 0 0 16px rgba(255, 209, 92, 0.15);
  }

  /* Content Columns */
  .content-grid {
    position: relative;
    z-index: 2;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    flex: 1;
    margin: 14px 0;
  }
  
  .card-col {
    background: rgba(30, 18, 20, 0.92);
    border: 1px solid #3b292c;
    border-radius: 12px;
    padding: 12px 16px;
    backdrop-filter: blur(10px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .col-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 8px;
    margin-bottom: 6px;
    border-bottom: 1px solid #3b292c;
  }
  .col-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 800;
    color: #fff8ee;
    letter-spacing: 0.2px;
  }
  .col-title-bar {
    width: 3px;
    height: 14px;
    background: #ffd15c;
    border-radius: 2px;
    box-shadow: 0 0 8px rgba(255, 209, 92, 0.6);
  }
  .col-subtitle {
    font-size: 11px;
    color: #ffd15c;
    background: rgba(255, 209, 92, 0.1);
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: 700;
    border: 1px solid rgba(255, 209, 92, 0.25);
  }

  .tier-list {
    display: flex;
    flex-direction: column;
    gap: 5.5px;
    flex: 1;
    justify-content: space-between;
  }

  .tier-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5.5px 12px;
    border-radius: 7px;
    background: rgba(255, 248, 238, 0.025);
    border: 1px solid rgba(68, 48, 54, 0.55);
    font-size: 13px;
  }
  .tier-row:nth-child(even) {
    background: rgba(255, 248, 238, 0.045);
  }

  .tier-left {
    display: flex;
    align-items: baseline;
    gap: 7px;
  }
  .tier-name {
    font-weight: 700;
    letter-spacing: 0.2px;
  }
  .tier-detail {
    font-size: 11.5px;
    color: #b8a8a8;
    font-weight: 500;
  }

  .tier-price {
    font-weight: 800;
    font-size: 12px;
    color: #ffd15c;
    background: #201215;
    padding: 3px 10px;
    border-radius: 6px;
    border: 1px solid #443036;
    letter-spacing: 0.3px;
  }

  /* Tier color accents */
  .c-gray { color: #d1c7bd; }
  .c-lightgreen { color: #86efac; }
  .c-green { color: #4ade80; }
  .c-cyan { color: #38bdf8; }
  .c-skyblue { color: #60a5fa; }
  .c-blue { color: #818cf8; }
  .c-purple { color: #c084fc; }
  .c-magenta { color: #f472b6; }
  .c-rose { color: #fb7185; }
  .c-gold {
    color: #ffd15c;
    font-weight: 800;
    text-shadow: 0 0 10px rgba(255, 209, 92, 0.4);
  }

  /* Max Tier Gold Glow */
  .tier-row.gold-tier {
    background: linear-gradient(90deg, rgba(255, 209, 92, 0.15) 0%, rgba(255, 209, 92, 0.03) 100%);
    border: 1px solid rgba(255, 209, 92, 0.45);
    box-shadow: 0 0 12px rgba(255, 209, 92, 0.1);
  }
  .tier-row.gold-tier .tier-price {
    background: rgba(255, 209, 92, 0.22);
    border-color: rgba(255, 209, 92, 0.6);
    color: #fff8ee;
    font-weight: 900;
    box-shadow: 0 0 10px rgba(255, 209, 92, 0.3);
  }

  /* Footer */
  .footer {
    position: relative;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid #3b292c;
    padding-top: 10px;
  }
  .guarantees {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 12px;
    font-weight: 600;
    color: #b8a8a8;
  }
  .guarantee-dot {
    color: #ffd15c;
    font-weight: 900;
    font-size: 13px;
    line-height: 1;
  }
  .guarantee-item {
    color: #fff8ee;
  }
  .web-url {
    font-size: 13.5px;
    font-weight: 800;
    color: #ffd15c;
    letter-spacing: 0.5px;
  }
</style>
</head>
<body>
  <div class="bg-glow-gold"></div>
  <div class="bg-glow-wine"></div>
  <div class="bg-grid"></div>

  <header class="header">
    <div class="brand-group">
      <div class="logo-box">VNL</div>
      <div class="title-group">
        <h1>Huy Hiệu Game Discord</h1>
        <p>Bảng giá cày giờ chơi & số lượng game mở khóa huy hiệu</p>
      </div>
    </div>
    <div class="badge-tag">VIETNAM LEGACY</div>
  </header>

  <main class="content-grid">
    <!-- Column 1: Giờ chơi game -->
    <div class="card-col">
      <div class="col-header">
        <div class="col-title">
          <span class="col-title-bar"></span>
          <span>Giờ Chơi Game</span>
        </div>
        <span class="col-subtitle">10 mốc</span>
      </div>
      <div class="tier-list">
        <div class="tier-row">
          <div class="tier-left">
            <span class="tier-name c-gray">Giải trí</span>
            <span class="tier-detail">– 1 giờ</span>
          </div>
          <span class="tier-price">15.000 VNĐ</span>
        </div>
        <div class="tier-row">
          <div class="tier-left">
            <span class="tier-name c-lightgreen">Thư giãn</span>
            <span class="tier-detail">– 5 giờ</span>
          </div>
          <span class="tier-price">20.000 VNĐ</span>
        </div>
        <div class="tier-row">
          <div class="tier-left">
            <span class="tier-name c-green">Tận tâm</span>
            <span class="tier-detail">– 20 giờ</span>
          </div>
          <span class="tier-price">30.000 VNĐ</span>
        </div>
        <div class="tier-row">
          <div class="tier-left">
            <span class="tier-name c-cyan">Gắn bó</span>
            <span class="tier-detail">– 75 giờ</span>
          </div>
          <span class="tier-price">40.000 VNĐ</span>
        </div>
        <div class="tier-row">
          <div class="tier-left">
            <span class="tier-name c-skyblue">Nghiêm túc</span>
            <span class="tier-detail">– 150 giờ</span>
          </div>
          <span class="tier-price">50.000 VNĐ</span>
        </div>
        <div class="tier-row">
          <div class="tier-left">
            <span class="tier-name c-blue">Cống hiến</span>
            <span class="tier-detail">– 300 giờ</span>
          </div>
          <span class="tier-price">60.000 VNĐ</span>
        </div>
        <div class="tier-row">
          <div class="tier-left">
            <span class="tier-name c-purple">Kỳ cựu</span>
            <span class="tier-detail">– 500 giờ</span>
          </div>
          <span class="tier-price">70.000 VNĐ</span>
        </div>
        <div class="tier-row">
          <div class="tier-left">
            <span class="tier-name c-magenta">Kiên cường</span>
            <span class="tier-detail">– 1.000 giờ</span>
          </div>
          <span class="tier-price">80.000 VNĐ</span>
        </div>
        <div class="tier-row">
          <div class="tier-left">
            <span class="tier-name c-rose">Kiên định</span>
            <span class="tier-detail">– 2.000 giờ</span>
          </div>
          <span class="tier-price">90.000 VNĐ</span>
        </div>
        <div class="tier-row gold-tier">
          <div class="tier-left">
            <span class="tier-name c-gold">Vĩnh cửu</span>
            <span class="tier-detail">– 5.000 giờ (MAX)</span>
          </div>
          <span class="tier-price">100.000 VNĐ</span>
        </div>
      </div>
    </div>

    <!-- Column 2: Số game đã chơi -->
    <div class="card-col">
      <div class="col-header">
        <div class="col-title">
          <span class="col-title-bar"></span>
          <span>Số Game Đã Chơi</span>
        </div>
        <span class="col-subtitle">10 mốc</span>
      </div>
      <div class="tier-list">
        <div class="tier-row">
          <div class="tier-left">
            <span class="tier-name c-gray">Tập chơi</span>
            <span class="tier-detail">– 2 game</span>
          </div>
          <span class="tier-price">15.000 VNĐ</span>
        </div>
        <div class="tier-row">
          <div class="tier-left">
            <span class="tier-name c-lightgreen">Dạo chơi</span>
            <span class="tier-detail">– 5 game</span>
          </div>
          <span class="tier-price">20.000 VNĐ</span>
        </div>
        <div class="tier-row">
          <div class="tier-left">
            <span class="tier-name c-green">Đam mê</span>
            <span class="tier-detail">– 10 game</span>
          </div>
          <span class="tier-price">30.000 VNĐ</span>
        </div>
        <div class="tier-row">
          <div class="tier-left">
            <span class="tier-name c-cyan">Thám hiểm</span>
            <span class="tier-detail">– 15 game</span>
          </div>
          <span class="tier-price">40.000 VNĐ</span>
        </div>
        <div class="tier-row">
          <div class="tier-left">
            <span class="tier-name c-skyblue">Khai phá</span>
            <span class="tier-detail">– 20 game</span>
          </div>
          <span class="tier-price">50.000 VNĐ</span>
        </div>
        <div class="tier-row">
          <div class="tier-left">
            <span class="tier-name c-blue">Phiêu lưu</span>
            <span class="tier-detail">– 30 game</span>
          </div>
          <span class="tier-price">60.000 VNĐ</span>
        </div>
        <div class="tier-row">
          <div class="tier-left">
            <span class="tier-name c-purple">Du hành</span>
            <span class="tier-detail">– 40 game</span>
          </div>
          <span class="tier-price">70.000 VNĐ</span>
        </div>
        <div class="tier-row">
          <div class="tier-left">
            <span class="tier-name c-magenta">Độc hành</span>
            <span class="tier-detail">– 60 game</span>
          </div>
          <span class="tier-price">80.000 VNĐ</span>
        </div>
        <div class="tier-row">
          <div class="tier-left">
            <span class="tier-name c-rose">Toàn năng</span>
            <span class="tier-detail">– 80 game</span>
          </div>
          <span class="tier-price">90.000 VNĐ</span>
        </div>
        <div class="tier-row gold-tier">
          <div class="tier-left">
            <span class="tier-name c-gold">Vũ trụ</span>
            <span class="tier-detail">– 100 game (MAX)</span>
          </div>
          <span class="tier-price">100.000 VNĐ</span>
        </div>
      </div>
    </div>
  </main>

  <footer class="footer">
    <div class="guarantees">
      <span class="guarantee-item">Cày tự động siêu tốc</span>
      <span class="guarantee-dot">•</span>
      <span class="guarantee-item">An toàn 100% tài khoản</span>
      <span class="guarantee-dot">•</span>
      <span class="guarantee-item">Bảo hành trọn đời</span>
      <span class="guarantee-dot">•</span>
      <span class="guarantee-item">Huy hiệu hiện vĩnh viễn</span>
    </div>
    <div class="web-url">vietnamlegacy.shop</div>
  </footer>
</body>
</html>`;

const tempHtmlPath = path.resolve("scripts/banner_temp.html");
const outPngPath = path.resolve("assets/discord-game-badges.png");

fs.writeFileSync(tempHtmlPath, htmlContent, "utf8");

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const chromeCmd = `"${chromePath}" --headless=new --screenshot="${outPngPath}" --window-size=1200,720 --default-background-color=00000000 --force-device-scale-factor=2 --virtual-time-budget=2000 --run-all-compositor-stages-before-draw "file://${tempHtmlPath.replace(/\\\\/g, "/")}"`;

try {
  execSync(chromeCmd, { stdio: "inherit" });
  console.log("Successfully generated:", outPngPath);
} catch (e) {
  console.error("Failed to render:", e.message);
} finally {
  if (fs.existsSync(tempHtmlPath)) {
    fs.unlinkSync(tempHtmlPath);
  }
}

import fs from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

// 10 Cấp Độ Huy Hiệu Game Time Discord (chuẩn tiếng Việt Discord)
const tiers = [
  {
    id: "tier-1",
    name: "Giải Trí",
    hours: "1 giờ",
    bladeLight: "#f8fafc",
    bladeDark: "#cbd5e1",
    guard: "#94a3b8",
    glow: "rgba(241, 245, 249, 0.45)",
    tagBg: "rgba(203, 213, 225, 0.16)",
    tagColor: "#e2e8f0",
  },
  {
    id: "tier-2",
    name: "Giải trí",
    hours: "5 giờ",
    bladeLight: "#bef264",
    bladeDark: "#84cc16",
    guard: "#65a30d",
    glow: "rgba(163, 230, 53, 0.5)",
    tagBg: "rgba(132, 204, 22, 0.16)",
    tagColor: "#bef264",
  },
  {
    id: "tier-3",
    name: "Gắn bó",
    hours: "20 giờ",
    bladeLight: "#4ade80",
    bladeDark: "#16a34a",
    guard: "#15803d",
    glow: "rgba(34, 197, 94, 0.5)",
    tagBg: "rgba(22, 163, 74, 0.16)",
    tagColor: "#4ade80",
  },
  {
    id: "tier-4",
    name: "Tâm huyết",
    hours: "75 giờ",
    bladeLight: "#38bdf8",
    bladeDark: "#0284c7",
    guard: "#0369a1",
    glow: "rgba(14, 165, 233, 0.55)",
    tagBg: "rgba(2, 132, 199, 0.18)",
    tagColor: "#38bdf8",
  },
  {
    id: "tier-5",
    name: "Nghiêm túc",
    hours: "150 giờ",
    bladeLight: "#60a5fa",
    bladeDark: "#2563eb",
    guard: "#1d4ed8",
    glow: "rgba(37, 99, 235, 0.55)",
    tagBg: "rgba(37, 99, 235, 0.18)",
    tagColor: "#60a5fa",
  },
  {
    id: "tier-6",
    name: "Tận hiến",
    hours: "300 giờ",
    bladeLight: "#818cf8",
    bladeDark: "#4f46e5",
    guard: "#4338ca",
    glow: "rgba(79, 70, 229, 0.55)",
    tagBg: "rgba(79, 70, 229, 0.18)",
    tagColor: "#818cf8",
  },
  {
    id: "tier-7",
    name: "Lão luyện",
    hours: "500 giờ",
    bladeLight: "#c084fc",
    bladeDark: "#9333ea",
    guard: "#7e22ce",
    glow: "rgba(168, 85, 247, 0.55)",
    tagBg: "rgba(147, 51, 234, 0.18)",
    tagColor: "#c084fc",
  },
  {
    id: "tier-8",
    name: "Sắt đá",
    hours: "1.000 giờ",
    bladeLight: "#f472b6",
    bladeDark: "#db2777",
    guard: "#be185d",
    glow: "rgba(236, 72, 153, 0.55)",
    tagBg: "rgba(219, 39, 119, 0.18)",
    tagColor: "#f472b6",
  },
  {
    id: "tier-9",
    name: "Kiên định",
    hours: "2.000 giờ",
    bladeLight: "#fb7185",
    bladeDark: "#e11d48",
    guard: "#be123c",
    glow: "rgba(244, 63, 94, 0.6)",
    tagBg: "rgba(225, 29, 72, 0.18)",
    tagColor: "#fb7185",
  },
  {
    id: "tier-10",
    name: "Vĩnh cửu",
    hours: "5.000+ giờ",
    bladeLight: "#fef08a",
    bladeDark: "#eab308",
    guard: "#ca8a04",
    glow: "rgba(234, 179, 8, 0.75)",
    tagBg: "rgba(202, 138, 4, 0.24)",
    tagColor: "#fde047",
    isMax: true,
  },
];

function renderSwordSvg(t, size = 44) {
  return `
    <svg viewBox="0 0 48 48" width="${size}" height="${size}" style="filter: drop-shadow(0 0 9px ${t.glow}); flex-shrink: 0;">
      <!-- Guard -->
      <path d="M12 26 L22 36 L19 39 L9 29 Z" fill="${t.guard}" stroke="rgba(0,0,0,0.35)" stroke-width="0.6"/>
      <!-- Pommel -->
      <circle cx="10" cy="38" r="3.2" fill="${t.guard}" stroke="rgba(0,0,0,0.35)" stroke-width="0.6"/>
      <circle cx="9.5" cy="37.5" r="1.2" fill="${t.bladeLight}" opacity="0.6"/>
      <!-- Grip -->
      <line x1="12" y1="36" x2="16" y2="32" stroke="#1e1f22" stroke-width="3.2" stroke-linecap="round"/>
      <line x1="13.5" y1="34.5" x2="14.5" y2="33.5" stroke="${t.bladeLight}" stroke-width="1"/>
      <!-- Blade Upper Facet (Highlight) -->
      <path d="M15 30 L35 10 L39 9 L27 21 Z" fill="${t.bladeLight}"/>
      <!-- Blade Lower Facet (Shadow) -->
      <path d="M18 33 L39 9 L38 13 L27 21 Z" fill="${t.bladeDark}"/>
      <!-- Center Spine Highlight -->
      <line x1="16.5" y1="31.5" x2="39" y2="9" stroke="#ffffff" stroke-width="1" stroke-opacity="0.85"/>
      <!-- Tip Shine Sparkle -->
      <circle cx="39" cy="9" r="1.4" fill="#ffffff"/>
    </svg>
  `;
}

// Render the Discord Modal Card component
function renderDiscordBoard(options = {}) {
  const { isFullBleed = false } = options;
  return `
    <div class="discord-card ${isFullBleed ? "full-bleed" : ""}">
      <!-- Top Bar -->
      <div class="discord-top-bar">
        <div class="discord-header-center">
          <div class="discord-eyebrow">Thời gian chơi</div>
          <div class="discord-badge-title">VĨNH CỬU</div>
          <div class="discord-stats-row"><span>5.000+ giờ chơi</span> đã tích lũy • Đã mở khóa vĩnh viễn</div>
        </div>
        <div class="discord-close-btn" title="Đóng">✕</div>
      </div>

      <!-- Progress Box -->
      <div class="discord-progress-box">
        <div class="progress-head">
          <span class="progress-title">Tiến trình của bạn</span>
          <span class="progress-badge">ĐÃ ĐẠT CẤP TỐI ĐA (MAX TIER)</span>
        </div>
        <div class="progress-bar-wrap">
          ${renderSwordSvg(tiers[0], 24)}
          <div class="progress-track">
            <div class="progress-fill"></div>
          </div>
          ${renderSwordSvg(tiers[9], 24)}
        </div>
        <div class="progress-desc">
          Chơi thêm nhiều giờ các trò chơi PC có thể phát hiện khi Discord đang mở để tăng cấp huy hiệu này.
        </div>
      </div>

      <!-- 10 Badges Grid: 4 in Row 1, 4 in Row 2, 2 Centered in Row 3 -->
      <div class="swords-grid">
        ${tiers.map((t, idx) => `
          <div class="sword-card tier-item-${idx + 1} ${t.isMax ? "max-tier" : ""}">
            ${renderSwordSvg(t, 42)}
            <span class="sword-name">${t.name}</span>
            <span class="sword-hours" style="background:${t.tagBg}; color:${t.tagColor};">${t.hours}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

const sharedCss = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #fff8ee;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }
  
  /* Ambient shop background */
  .bg-glow-gold {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(255, 209, 92, 0.12) 0%, rgba(255, 209, 92, 0) 65%);
    pointer-events: none;
  }
  .bg-glow-wine {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 750px;
    height: 750px;
    background: radial-gradient(circle, rgba(180, 35, 65, 0.15) 0%, rgba(180, 35, 65, 0) 70%);
    pointer-events: none;
  }

  /* Discord Modal Card */
  .discord-card {
    width: 580px;
    background: #1e1f22;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 18px;
    padding: 24px 26px;
    box-shadow: 
      0 20px 50px rgba(0, 0, 0, 0.75),
      0 0 0 1px rgba(255, 209, 92, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .discord-card.full-bleed {
    width: 100%;
    height: 100%;
    border-radius: 0;
    border: none;
    padding: 28px 32px;
    background: #1e1f22;
    justify-content: space-between;
  }

  /* Top Bar */
  .discord-top-bar {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    text-align: center;
  }
  .discord-header-center {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .discord-eyebrow {
    font-size: 13px;
    font-weight: 700;
    color: #949ba4;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .discord-badge-title {
    font-size: 32px;
    font-weight: 900;
    letter-spacing: 1.5px;
    background: linear-gradient(135deg, #ffffff 0%, #fff3c4 25%, #ffd15c 65%, #f59e0b 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    text-shadow: 0 0 30px rgba(255, 209, 92, 0.45);
    margin: 2px 0 4px;
    line-height: 1.1;
  }
  .discord-stats-row {
    font-size: 13px;
    color: #949ba4;
  }
  .discord-stats-row span {
    color: #f2f3f5;
    font-weight: 700;
  }
  .discord-close-btn {
    position: absolute;
    top: -4px;
    right: 0;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #949ba4;
    font-size: 16px;
    font-weight: 700;
    border-radius: 6px;
  }

  /* Progress Box */
  .discord-progress-box {
    background: rgba(43, 45, 49, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 12px 16px;
  }
  .progress-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .progress-title {
    font-size: 13.5px;
    font-weight: 800;
    color: #f2f3f5;
  }
  .progress-badge {
    font-size: 11px;
    color: #ffd15c;
    font-weight: 800;
    letter-spacing: 0.5px;
  }
  .progress-bar-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .progress-track {
    flex: 1;
    height: 8px;
    background: #111214;
    border-radius: 5px;
    overflow: hidden;
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.5);
  }
  .progress-fill {
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, #38bdf8 0%, #a855f7 50%, #ffd15c 100%);
    box-shadow: 0 0 12px rgba(255, 209, 92, 0.7);
  }
  .progress-desc {
    font-size: 11.5px;
    color: #949ba4;
    margin-top: 8px;
    line-height: 1.4;
  }

  /* 10 Badges: 4 in Row 1, 4 in Row 2, 2 Centered in Row 3 */
  .swords-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }
  .sword-card {
    background: rgba(43, 45, 49, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 12px 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 6px;
    transition: transform 0.2s;
  }
  /* Center tier 9 & 10 in 4-column layout */
  .sword-card.tier-item-9 {
    grid-column: 2;
  }
  .sword-card.tier-item-10 {
    grid-column: 3;
  }

  .sword-card.max-tier {
    border-color: rgba(255, 209, 92, 0.65);
    background: linear-gradient(180deg, rgba(255, 209, 92, 0.16) 0%, rgba(43, 45, 49, 0.95) 100%);
    box-shadow: 0 0 20px rgba(255, 209, 92, 0.3);
  }
  .sword-name {
    font-size: 12.5px;
    font-weight: 800;
    color: #f2f3f5;
    line-height: 1.1;
  }
  .sword-hours {
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 12px;
    line-height: 1.2;
  }
`;

// HTML for Landscape (1200 x 720) - for web product cards (Ratio ~ 16:9 / 5:3)
const bannerHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
  ${sharedCss}
  body {
    width: 1200px;
    height: 720px;
    background: #12090c;
  }
  .bg-grid {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba(255, 209, 92, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 209, 92, 0.03) 1px, transparent 1px);
    background-size: 28px 28px;
    pointer-events: none;
  }
  .discord-card {
    width: 620px;
    transform: scale(1.04);
  }
</style>
</head>
<body>
  <div class="bg-glow-gold"></div>
  <div class="bg-glow-wine"></div>
  <div class="bg-grid"></div>
  ${renderDiscordBoard({ isFullBleed: false })}
</body>
</html>`;

// HTML for Square (800 x 800) - for 1:1 square media
const squareHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
  ${sharedCss}
  body {
    width: 800px;
    height: 800px;
    background: #12090c;
  }
  .bg-grid {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba(255, 209, 92, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 209, 92, 0.03) 1px, transparent 1px);
    background-size: 26px 26px;
    pointer-events: none;
  }
  .discord-card {
    width: 640px;
    transform: scale(1.08);
  }
</style>
</head>
<body>
  <div class="bg-glow-gold"></div>
  <div class="bg-glow-wine"></div>
  <div class="bg-grid"></div>
  ${renderDiscordBoard({ isFullBleed: false })}
</body>
</html>`;

// HTML for Clean Card-Only (640 x 780) - exact card proportions without outside background
const cardOnlyHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
  ${sharedCss}
  body {
    width: 620px;
    height: 750px;
    background: #1e1f22;
  }
</style>
</head>
<body>
  ${renderDiscordBoard({ isFullBleed: true })}
</body>
</html>`;

// Render using Chrome
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const tempBanner = path.resolve("scripts/temp_b_landscape.html");
const tempSquare = path.resolve("scripts/temp_b_square.html");
const tempCard = path.resolve("scripts/temp_b_card.html");

const outBanner = path.resolve("assets/discord-game-time-banner.png");
const outSquare = path.resolve("assets/discord-game-time-square.png");
const outCard = path.resolve("assets/discord-game-time-card.png");
const outThumb = path.resolve("assets/discord-game-time-thumb.png");

const artifactDir = "C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\215b4bb9-16c9-48dc-9023-225ff66ec7e6";
const artBanner = path.join(artifactDir, "discord-game-time-banner.png");
const artSquare = path.join(artifactDir, "discord-game-time-square.png");
const artCard = path.join(artifactDir, "discord-game-time-card.png");

try {
  // 1. Landscape Banner (1200 x 720 @2x = 2400 x 1440)
  fs.writeFileSync(tempBanner, bannerHtml, "utf8");
  execSync(`"${chromePath}" --headless=new --screenshot="${outBanner}" --window-size=1200,720 --default-background-color=00000000 --force-device-scale-factor=2 --virtual-time-budget=2500 --run-all-compositor-stages-before-draw "file://${tempBanner.replace(/\\\\/g, "/")}"`, { stdio: "inherit" });
  fs.copyFileSync(outBanner, outThumb);
  fs.copyFileSync(outBanner, artBanner);
  console.log("Generated landscape banner:", outBanner);

  // 2. Square Banner (800 x 800 @2x = 1600 x 1600)
  fs.writeFileSync(tempSquare, squareHtml, "utf8");
  execSync(`"${chromePath}" --headless=new --screenshot="${outSquare}" --window-size=800,800 --default-background-color=00000000 --force-device-scale-factor=2 --virtual-time-budget=2500 --run-all-compositor-stages-before-draw "file://${tempSquare.replace(/\\\\/g, "/")}"`, { stdio: "inherit" });
  fs.copyFileSync(outSquare, artSquare);
  console.log("Generated square banner:", outSquare);

  // 3. Card-Only Clean (620 x 750 @2x = 1240 x 1500)
  fs.writeFileSync(tempCard, cardOnlyHtml, "utf8");
  execSync(`"${chromePath}" --headless=new --screenshot="${outCard}" --window-size=620,750 --default-background-color=00000000 --force-device-scale-factor=2 --virtual-time-budget=2500 --run-all-compositor-stages-before-draw "file://${tempCard.replace(/\\\\/g, "/")}"`, { stdio: "inherit" });
  fs.copyFileSync(outCard, artCard);
  console.log("Generated card-only banner:", outCard);

  console.log("ALL BANNERS GENERATED SUCCESSFULLY!");
} catch (e) {
  console.error("Render failed:", e.message);
  process.exit(1);
} finally {
  if (fs.existsSync(tempBanner)) fs.unlinkSync(tempBanner);
  if (fs.existsSync(tempSquare)) fs.unlinkSync(tempSquare);
  if (fs.existsSync(tempCard)) fs.unlinkSync(tempCard);
}

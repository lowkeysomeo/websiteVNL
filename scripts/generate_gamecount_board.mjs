import fs from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

// 10 Cấp Độ Huy Hiệu Số Trò Chơi Discord (chuẩn tiếng Việt Discord chính thức)
const countTiers = [
  {
    id: "count-1",
    name: "Người dùng thử",
    count: "2 trò chơi",
    bladeLight: "#f8fafc",
    bladeDark: "#cbd5e1",
    guard: "#94a3b8",
    glow: "rgba(241, 245, 249, 0.45)",
    tagBg: "rgba(203, 213, 225, 0.16)",
    tagColor: "#e2e8f0",
  },
  {
    id: "count-2",
    name: "Người chơi qua",
    count: "5 trò chơi",
    bladeLight: "#bef264",
    bladeDark: "#84cc16",
    guard: "#65a30d",
    glow: "rgba(163, 230, 53, 0.5)",
    tagBg: "rgba(132, 204, 22, 0.16)",
    tagColor: "#bef264",
  },
  {
    id: "count-3",
    name: "Người đam mê",
    count: "10 trò chơi",
    bladeLight: "#4ade80",
    bladeDark: "#16a34a",
    guard: "#15803d",
    glow: "rgba(34, 197, 94, 0.5)",
    tagBg: "rgba(22, 163, 74, 0.16)",
    tagColor: "#4ade80",
  },
  {
    id: "count-4",
    name: "Trinh Sát",
    count: "15 trò chơi",
    bladeLight: "#38bdf8",
    bladeDark: "#0284c7",
    guard: "#0369a1",
    glow: "rgba(14, 165, 233, 0.55)",
    tagBg: "rgba(2, 132, 199, 0.18)",
    tagColor: "#38bdf8",
  },
  {
    id: "count-5",
    name: "Người khám phá",
    count: "20 trò chơi",
    bladeLight: "#60a5fa",
    bladeDark: "#2563eb",
    guard: "#1d4ed8",
    glow: "rgba(37, 99, 235, 0.55)",
    tagBg: "rgba(37, 99, 235, 0.18)",
    tagColor: "#60a5fa",
  },
  {
    id: "count-6",
    name: "Nhà Thám Hiểm",
    count: "30 trò chơi",
    bladeLight: "#818cf8",
    bladeDark: "#4f46e5",
    guard: "#4338ca",
    glow: "rgba(79, 70, 229, 0.55)",
    tagBg: "rgba(79, 70, 229, 0.18)",
    tagColor: "#818cf8",
  },
  {
    id: "count-7",
    name: "Nhà du hành",
    count: "40 trò chơi",
    bladeLight: "#c084fc",
    bladeDark: "#9333ea",
    guard: "#7e22ce",
    glow: "rgba(168, 85, 247, 0.55)",
    tagBg: "rgba(147, 51, 234, 0.18)",
    tagColor: "#c084fc",
  },
  {
    id: "count-8",
    name: "Người khác biệt",
    count: "60 trò chơi",
    bladeLight: "#f472b6",
    bladeDark: "#db2777",
    guard: "#be185d",
    glow: "rgba(236, 72, 153, 0.55)",
    tagBg: "rgba(219, 39, 119, 0.18)",
    tagColor: "#f472b6",
  },
  {
    id: "count-9",
    name: "Người đa tài",
    count: "80 trò chơi",
    bladeLight: "#fb7185",
    bladeDark: "#e11d48",
    guard: "#be123c",
    glow: "rgba(244, 63, 94, 0.6)",
    tagBg: "rgba(225, 29, 72, 0.18)",
    tagColor: "#fb7185",
  },
  {
    id: "count-10",
    name: "Thuyết phổ quát",
    count: "100+ trò chơi",
    bladeLight: "#fef08a",
    bladeDark: "#eab308",
    guard: "#ca8a04",
    glow: "rgba(234, 179, 8, 0.75)",
    tagBg: "rgba(202, 138, 4, 0.24)",
    tagColor: "#fde047",
    isMax: true,
  },
];

// SVG Gamepad Icon mô phỏng chính xác tay cầm chơi game Discord
function renderGamepadSvg(t, size = 42) {
  return `
    <svg viewBox="0 0 48 48" width="${size}" height="${size}" style="filter: drop-shadow(0 0 9px ${t.glow}); flex-shrink: 0;" xmlns="http://www.w3.org/2000/svg">
      <!-- Controller Outer Body -->
      <path d="M13 17 C17 14.8 31 14.8 35 17 C39 18.5 41.5 24 40.5 30.5 C39.5 34.5 36.5 36.5 33.5 33 C30.5 29.8 28.5 27 24 27 C19.5 27 17.5 29.8 14.5 33 C11.5 36.5 8.5 34.5 7.5 30.5 C6.5 24 9 18.5 13 17 Z" 
        fill="${t.bladeDark}" stroke="${t.guard}" stroke-width="1.3" stroke-linejoin="round"/>
      
      <!-- Top Shoulder / Bevel Highlight -->
      <path d="M14 17.8 C17.5 15.8 30.5 15.8 34 17.8 C37 19.2 39 23 39 27.5 C36.5 21 32 18.8 24 18.8 C16 18.8 11.5 21 9 27.5 C9 23 11 19.2 14 17.8 Z" 
        fill="${t.bladeLight}" opacity="0.85"/>
      
      <!-- D-Pad (Left) -->
      <path d="M13.5 21.5 H16 V19 H18 V21.5 H20.5 V23.5 H18 V26 H16 V23.5 H13.5 Z" 
        fill="#1e1f22" stroke="${t.bladeLight}" stroke-width="0.5"/>
      <circle cx="17" cy="22.5" r="0.75" fill="${t.bladeLight}"/>
      
      <!-- Action Buttons (Right 4 dots diamond) -->
      <circle cx="31" cy="22.5" r="1.3" fill="#1e1f22" stroke="${t.bladeLight}" stroke-width="0.6"/>
      <circle cx="35" cy="22.5" r="1.3" fill="#1e1f22" stroke="${t.bladeLight}" stroke-width="0.6"/>
      <circle cx="33" cy="20.5" r="1.3" fill="#1e1f22" stroke="${t.bladeLight}" stroke-width="0.6"/>
      <circle cx="33" cy="24.5" r="1.3" fill="#1e1f22" stroke="${t.bladeLight}" stroke-width="0.6"/>
      <circle cx="31" cy="22.5" r="0.65" fill="${t.bladeLight}"/>
      <circle cx="35" cy="22.5" r="0.65" fill="${t.bladeLight}"/>
      <circle cx="33" cy="20.5" r="0.65" fill="${t.bladeLight}"/>
      <circle cx="33" cy="24.5" r="0.65" fill="${t.bladeLight}"/>
      
      <!-- Thumbsticks (Lower Center) -->
      <circle cx="19.5" cy="28.5" r="2.6" fill="#1e1f22" stroke="${t.bladeDark}" stroke-width="0.9"/>
      <circle cx="19.5" cy="28.5" r="1.3" fill="${t.guard}"/>
      <circle cx="19.2" cy="28.2" r="0.5" fill="${t.bladeLight}" opacity="0.8"/>
      
      <circle cx="28.5" cy="28.5" r="2.6" fill="#1e1f22" stroke="${t.bladeDark}" stroke-width="0.9"/>
      <circle cx="28.5" cy="28.5" r="1.3" fill="${t.guard}"/>
      <circle cx="28.2" cy="28.2" r="0.5" fill="${t.bladeLight}" opacity="0.8"/>
    </svg>
  `;
}

// Render the Discord Modal Card component for Game Count
function renderDiscordBoard(options = {}) {
  const { isFullBleed = false } = options;
  return `
    <div class="discord-card ${isFullBleed ? "full-bleed" : ""}">
      <!-- Top Bar -->
      <div class="discord-top-bar">
        <div class="discord-header-center">
          <div class="discord-eyebrow">Trò chơi đã chơi</div>
          <div class="discord-badge-title">THUYẾT PHỔ QUÁT</div>
          <div class="discord-stats-row"><span>100+ trò chơi</span> đã tích lũy • Đã mở khóa vĩnh viễn</div>
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
          ${renderGamepadSvg(countTiers[0], 24)}
          <div class="progress-track">
            <div class="progress-fill"></div>
          </div>
          ${renderGamepadSvg(countTiers[9], 24)}
        </div>
        <div class="progress-desc">
          Chơi nhiều trò chơi PC có thể phát hiện hơn khi Discord đang mở để tăng cấp huy hiệu này.
        </div>
      </div>

      <!-- 10 Badges Grid: 4 in Row 1, 4 in Row 2, 2 Centered in Row 3 -->
      <div class="swords-grid">
        ${countTiers.map((t, idx) => `
          <div class="sword-card tier-item-${idx + 1} ${t.isMax ? "max-tier" : ""}">
            ${renderGamepadSvg(t, 42)}
            <span class="sword-name">${t.name}</span>
            <span class="sword-hours" style="background:${t.tagBg}; color:${t.tagColor};">${t.count}</span>
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

// HTML for Clean Card-Only (620 x 750) - exact card proportions
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
const tempBanner = path.resolve("scripts/temp_count_landscape.html");
const tempSquare = path.resolve("scripts/temp_count_square.html");
const tempCard = path.resolve("scripts/temp_count_card.html");

const outBanner = path.resolve("assets/discord-game-count-banner.png");
const outSquare = path.resolve("assets/discord-game-count-square.png");
const outCard = path.resolve("assets/discord-game-count-card.png");
const outThumb = path.resolve("assets/discord-game-count-thumb.png");

// Also update the alias assets/discord-game-badges.png & square
const outLegacyBanner = path.resolve("assets/discord-game-badges.png");
const outLegacySquare = path.resolve("assets/discord-game-badges-square.png");

const artifactDir = "C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\215b4bb9-16c9-48dc-9023-225ff66ec7e6";
const artBanner = path.join(artifactDir, "discord-game-count-banner.png");
const artSquare = path.join(artifactDir, "discord-game-count-square.png");
const artCard = path.join(artifactDir, "discord-game-count-card.png");

try {
  // 1. Landscape Banner (1200 x 720 @2x = 2400 x 1440)
  fs.writeFileSync(tempBanner, bannerHtml, "utf8");
  execSync(`"${chromePath}" --headless=new --screenshot="${outBanner}" --window-size=1200,720 --default-background-color=00000000 --force-device-scale-factor=2 --virtual-time-budget=2500 --run-all-compositor-stages-before-draw "file://${tempBanner.replace(/\\\\/g, "/")}"`, { stdio: "inherit" });
  fs.copyFileSync(outBanner, outThumb);
  fs.copyFileSync(outBanner, outLegacyBanner);
  fs.copyFileSync(outBanner, artBanner);
  console.log("Generated landscape banner:", outBanner);

  // 2. Square Banner (800 x 800 @2x = 1600 x 1600)
  fs.writeFileSync(tempSquare, squareHtml, "utf8");
  execSync(`"${chromePath}" --headless=new --screenshot="${outSquare}" --window-size=800,800 --default-background-color=00000000 --force-device-scale-factor=2 --virtual-time-budget=2500 --run-all-compositor-stages-before-draw "file://${tempSquare.replace(/\\\\/g, "/")}"`, { stdio: "inherit" });
  fs.copyFileSync(outSquare, outLegacySquare);
  fs.copyFileSync(outSquare, artSquare);
  console.log("Generated square banner:", outSquare);

  // 3. Card-Only Clean (620 x 750 @2x = 1240 x 1500)
  fs.writeFileSync(tempCard, cardOnlyHtml, "utf8");
  execSync(`"${chromePath}" --headless=new --screenshot="${outCard}" --window-size=620,750 --default-background-color=00000000 --force-device-scale-factor=2 --virtual-time-budget=2500 --run-all-compositor-stages-before-draw "file://${tempCard.replace(/\\\\/g, "/")}"`, { stdio: "inherit" });
  fs.copyFileSync(outCard, artCard);
  console.log("Generated card-only banner:", outCard);

  console.log("ALL GAME COUNT BANNERS GENERATED SUCCESSFULLY!");
} catch (e) {
  console.error("Render failed:", e.message);
  process.exit(1);
} finally {
  if (fs.existsSync(tempBanner)) fs.unlinkSync(tempBanner);
  if (fs.existsSync(tempSquare)) fs.unlinkSync(tempSquare);
  if (fs.existsSync(tempCard)) fs.unlinkSync(tempCard);
}

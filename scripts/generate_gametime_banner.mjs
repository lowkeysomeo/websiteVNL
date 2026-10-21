import fs from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

// 10 Cấp Độ Huy Hiệu Game Time Discord (chính xác theo bản dịch tiếng Việt của Discord)
const tiers = [
  {
    id: "tier-1",
    name: "Giải Trí",
    hours: "1 giờ",
    bladeLight: "#f8fafc",
    bladeDark: "#cbd5e1",
    guard: "#94a3b8",
    glow: "rgba(241, 245, 249, 0.45)",
    tagBg: "rgba(203, 213, 225, 0.15)",
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
    tagBg: "rgba(132, 204, 22, 0.15)",
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
    tagBg: "rgba(22, 163, 74, 0.15)",
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
    tagBg: "rgba(202, 138, 4, 0.22)",
    tagColor: "#fde047",
    isMax: true,
  },
];

function renderSwordSvg(t, size = 36) {
  return `
    <svg viewBox="0 0 48 48" width="${size}" height="${size}" style="filter: drop-shadow(0 0 7px ${t.glow}); flex-shrink: 0;">
      <!-- Guard -->
      <path d="M12 26 L22 36 L19 39 L9 29 Z" fill="${t.guard}" stroke="rgba(0,0,0,0.35)" stroke-width="0.6"/>
      <!-- Pommel -->
      <circle cx="10" cy="38" r="3.2" fill="${t.guard}" stroke="rgba(0,0,0,0.35)" stroke-width="0.6"/>
      <circle cx="9.5" cy="37.5" r="1.2" fill="${t.bladeLight}" opacity="0.6"/>
      <!-- Grip -->
      <line x1="12" y1="36" x2="16" y2="32" stroke="#1e1f22" stroke-width="3" stroke-linecap="round"/>
      <line x1="13.5" y1="34.5" x2="14.5" y2="33.5" stroke="${t.bladeLight}" stroke-width="0.9"/>
      <!-- Blade Upper Facet (Highlight) -->
      <path d="M15 30 L35 10 L39 9 L27 21 Z" fill="${t.bladeLight}"/>
      <!-- Blade Lower Facet (Shadow) -->
      <path d="M18 33 L39 9 L38 13 L27 21 Z" fill="${t.bladeDark}"/>
      <!-- Center Spine Highlight -->
      <line x1="16.5" y1="31.5" x2="39" y2="9" stroke="#ffffff" stroke-width="0.9" stroke-opacity="0.8"/>
      <!-- Tip Shine Sparkle -->
      <circle cx="39" cy="9" r="1.3" fill="#ffffff"/>
    </svg>
  `;
}

// 1. LANDSCAPE BANNER (1200 x 720)
const bannerHtml = `<!DOCTYPE html>
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
    background: #11090c;
    font-family: "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #fff8ee;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 24px 32px;
    position: relative;
    overflow: hidden;
  }
  
  /* Radial Ambient Backgrounds */
  .bg-glow-gold {
    position: absolute;
    top: -90px;
    right: 80px;
    width: 650px;
    height: 420px;
    background: radial-gradient(circle, rgba(255, 209, 92, 0.17) 0%, rgba(255, 209, 92, 0) 70%);
    pointer-events: none;
  }
  .bg-glow-wine {
    position: absolute;
    bottom: -90px;
    left: 60px;
    width: 680px;
    height: 440px;
    background: radial-gradient(circle, rgba(180, 35, 65, 0.24) 0%, rgba(180, 35, 65, 0) 70%);
    pointer-events: none;
  }
  .bg-grid {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba(255, 209, 92, 0.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 209, 92, 0.035) 1px, transparent 1px);
    background-size: 26px 26px;
    pointer-events: none;
  }

  /* Header */
  .header {
    position: relative;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #382428;
    padding-bottom: 14px;
  }
  .brand-group {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .logo-box {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #2b1419, #3f1c24);
    border-radius: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 900;
    color: #ffd15c;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.55), inset 0 0 12px rgba(255, 209, 92, 0.2);
    border: 1px solid rgba(255, 209, 92, 0.4);
    letter-spacing: 0.6px;
  }
  .title-group h1 {
    font-size: 23px;
    font-weight: 900;
    letter-spacing: 0.8px;
    background: linear-gradient(135deg, #ffffff 30%, #ffd15c 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    text-transform: uppercase;
  }
  .title-group p {
    font-size: 12px;
    color: #bda8ab;
    margin-top: 3px;
  }
  .header-tags {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .tag-pill {
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.5px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .tag-gold {
    background: rgba(255, 209, 92, 0.12);
    border: 1px solid rgba(255, 209, 92, 0.4);
    color: #ffd15c;
    box-shadow: 0 0 14px rgba(255, 209, 92, 0.15);
  }
  .tag-green {
    background: rgba(34, 197, 94, 0.12);
    border: 1px solid rgba(34, 197, 94, 0.4);
    color: #4ade80;
  }
  .tag-cyan {
    background: rgba(6, 182, 212, 0.12);
    border: 1px solid rgba(6, 182, 212, 0.4);
    color: #38bdf8;
  }

  /* Main Grid */
  .main-grid {
    position: relative;
    z-index: 2;
    display: grid;
    grid-template-columns: 1.08fr 0.92fr;
    gap: 22px;
    flex: 1;
    margin: 16px 0;
  }

  /* Left: Discord Badge Showcase */
  .discord-card {
    background: rgba(22, 23, 27, 0.94);
    border: 1px solid #33363f;
    border-radius: 16px;
    padding: 18px 20px;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
  }
  .discord-top-bar {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .discord-title-area {
    text-align: left;
  }
  .discord-eyebrow {
    font-size: 12px;
    font-weight: 700;
    color: #949ba4;
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }
  .discord-badge-title {
    font-size: 26px;
    font-weight: 900;
    letter-spacing: 1.2px;
    background: linear-gradient(135deg, #fff3c4 0%, #ffd15c 50%, #f59e0b 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    text-shadow: 0 0 24px rgba(255, 209, 92, 0.35);
    margin: 2px 0;
  }
  .discord-stats-row {
    font-size: 11.5px;
    color: #949ba4;
  }
  .discord-stats-row span {
    color: #f2f3f5;
    font-weight: 600;
  }
  .discord-close {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #949ba4;
    font-size: 14px;
    cursor: pointer;
  }

  /* Progress Section */
  .discord-progress-box {
    background: rgba(30, 31, 35, 0.8);
    border: 1px solid #2b2d31;
    border-radius: 10px;
    padding: 10px 14px;
    margin: 10px 0;
  }
  .progress-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }
  .progress-title {
    font-size: 12px;
    font-weight: 800;
    color: #f2f3f5;
  }
  .progress-bar-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .progress-track {
    flex: 1;
    height: 7px;
    background: #2b2d31;
    border-radius: 4px;
    overflow: hidden;
    position: relative;
  }
  .progress-fill {
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, #38bdf8 0%, #a855f7 45%, #ffd15c 100%);
    box-shadow: 0 0 10px rgba(255, 209, 92, 0.6);
  }
  .progress-desc {
    font-size: 10.5px;
    color: #949ba4;
    margin-top: 6px;
    line-height: 1.35;
  }

  /* 10 Swords Grid */
  .swords-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
    margin-top: 4px;
  }
  .sword-card {
    background: rgba(28, 29, 34, 0.9);
    border: 1px solid #2b2d31;
    border-radius: 10px;
    padding: 8px 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 4px;
    transition: transform 0.2s;
  }
  .sword-card.max-tier {
    border-color: rgba(255, 209, 92, 0.6);
    background: linear-gradient(180deg, rgba(255, 209, 92, 0.12) 0%, rgba(28, 29, 34, 0.95) 100%);
    box-shadow: 0 0 16px rgba(255, 209, 92, 0.25);
  }
  .sword-name {
    font-size: 11px;
    font-weight: 800;
    color: #f2f3f5;
    line-height: 1.1;
  }
  .sword-hours {
    font-size: 9.5px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 10px;
    line-height: 1.2;
  }

  /* Right: Service Tiers & Perks */
  .perks-card {
    background: rgba(25, 14, 18, 0.94);
    border: 1px solid #3d242a;
    border-radius: 16px;
    padding: 18px 20px;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 209, 92, 0.08);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .perks-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #3d242a;
    padding-bottom: 10px;
  }
  .perks-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14.5px;
    font-weight: 900;
    color: #ffd15c;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .perks-title-bar {
    width: 3px;
    height: 16px;
    background: #ffd15c;
    border-radius: 2px;
    box-shadow: 0 0 8px rgba(255, 209, 92, 0.6);
  }
  .perks-badge {
    font-size: 11px;
    color: #bda8ab;
    font-weight: 600;
  }

  /* Tier Packages List */
  .packages-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 10px 0;
  }
  .package-row {
    background: rgba(36, 20, 25, 0.7);
    border: 1px solid #452830;
    border-radius: 8px;
    padding: 7px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .package-row.highlight {
    border-color: rgba(255, 209, 92, 0.5);
    background: linear-gradient(90deg, rgba(255, 209, 92, 0.12), rgba(45, 22, 28, 0.8));
    box-shadow: 0 0 12px rgba(255, 209, 92, 0.15);
  }
  .pkg-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pkg-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }
  .pkg-name {
    font-size: 12px;
    font-weight: 800;
    color: #fff8ee;
  }
  .pkg-desc {
    font-size: 11px;
    color: #bda8ab;
  }
  .pkg-tag {
    font-size: 10.5px;
    font-weight: 800;
    padding: 3px 8px;
    border-radius: 12px;
  }

  /* Key Guarantees Box */
  .guarantees-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    background: rgba(18, 9, 12, 0.8);
    border: 1px solid #3d242a;
    border-radius: 10px;
    padding: 10px 12px;
  }
  .guarantee-box {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }
  .guarantee-icon {
    font-size: 15px;
    line-height: 1;
    margin-top: 1px;
  }
  .guarantee-text h4 {
    font-size: 11.5px;
    font-weight: 800;
    color: #fff8ee;
  }
  .guarantee-text p {
    font-size: 10px;
    color: #bda8ab;
    line-height: 1.25;
    margin-top: 1px;
  }

  /* Footer */
  .footer {
    position: relative;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid #382428;
    padding-top: 12px;
  }
  .footer-left {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 11.5px;
    color: #bda8ab;
    font-weight: 600;
  }
  .footer-dot {
    color: #ffd15c;
  }
  .web-url {
    font-size: 13.5px;
    font-weight: 900;
    letter-spacing: 1px;
    color: #ffd15c;
    text-shadow: 0 0 12px rgba(255, 209, 92, 0.4);
  }
</style>
</head>
<body>
  <div class="bg-glow-gold"></div>
  <div class="bg-glow-wine"></div>
  <div class="bg-grid"></div>

  <!-- Header -->
  <header class="header">
    <div class="brand-group">
      <div class="logo-box">VNL</div>
      <div class="title-group">
        <h1>Auto Badge Discord Game Time</h1>
        <p>Cày giờ chơi PC tự động 24/7 · Mở khóa trọn bộ 10 cấp huy hiệu Hồ sơ Discord</p>
      </div>
    </div>
    <div class="header-tags">
      <div class="tag-pill tag-gold">⚡ Treo Cloud 24/7</div>
      <div class="tag-pill tag-green">🛡️ An toàn 100%</div>
      <div class="tag-pill tag-cyan">💎 Hiện vĩnh viễn</div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="main-grid">
    <!-- Left Column: Discord Badge Interface -->
    <div class="discord-card">
      <div class="discord-top-bar">
        <div class="discord-title-area">
          <div class="discord-eyebrow">Thời gian chơi</div>
          <div class="discord-badge-title">VĨNH CỬU</div>
          <div class="discord-stats-row"><span>5.000+ giờ chơi</span> đã tích lũy • Đã mở khóa vĩnh viễn</div>
        </div>
        <div class="discord-close">✕</div>
      </div>

      <div class="discord-progress-box">
        <div class="progress-head">
          <span class="progress-title">Tiến trình của bạn</span>
          <span style="font-size: 10.5px; color: #ffd15c; font-weight: 700;">ĐÃ ĐẠT CẤP TỐI ĐA (MAX TIER)</span>
        </div>
        <div class="progress-bar-wrap">
          ${renderSwordSvg(tiers[0], 22)}
          <div class="progress-track">
            <div class="progress-fill"></div>
          </div>
          ${renderSwordSvg(tiers[9], 22)}
        </div>
        <div class="progress-desc">
          Tự động tích lũy giờ chơi tất cả trò chơi PC được Discord phát hiện để tăng cấp huy hiệu hồ sơ lên mốc cao nhất.
        </div>
      </div>

      <!-- 10 Badges in Grid -->
      <div class="swords-grid">
        ${tiers.map(t => `
          <div class="sword-card ${t.isMax ? "max-tier" : ""}">
            ${renderSwordSvg(t, 34)}
            <span class="sword-name">${t.name}</span>
            <span class="sword-hours" style="background:${t.tagBg}; color:${t.tagColor};">${t.hours}</span>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- Right Column: Service Packages & Privileges -->
    <div class="perks-card">
      <div class="perks-header">
        <div class="perks-title">
          <span class="perks-title-bar"></span>
          <span>Bảng Mốc Huy Hiệu Game Time</span>
        </div>
        <span class="perks-badge">10 mốc chính hãng</span>
      </div>

      <div class="packages-list">
        <div class="package-row">
          <div class="pkg-left">
            <span class="pkg-dot" style="background:#4ade80;"></span>
            <div>
              <div class="pkg-name">Mốc 1 – 20 Giờ</div>
              <div class="pkg-desc">Mở khóa: Giải Trí (1h, 5h) & Gắn Bó (20h)</div>
            </div>
          </div>
          <span class="pkg-tag" style="background:rgba(74, 222, 128, 0.15); color:#4ade80;">Khởi động</span>
        </div>

        <div class="package-row">
          <div class="pkg-left">
            <span class="pkg-dot" style="background:#38bdf8;"></span>
            <div>
              <div class="pkg-name">Mốc 75 – 150 Giờ</div>
              <div class="pkg-desc">Mở khóa: Tâm Huyết (75h) & Nghiêm Túc (150h)</div>
            </div>
          </div>
          <span class="pkg-tag" style="background:rgba(56, 189, 248, 0.15); color:#38bdf8;">Tâm huyết</span>
        </div>

        <div class="package-row">
          <div class="pkg-left">
            <span class="pkg-dot" style="background:#c084fc;"></span>
            <div>
              <div class="pkg-name">Mốc 300 – 500 Giờ</div>
              <div class="pkg-desc">Mở khóa: Tận Hiến (300h) & Lão Luyện (500h)</div>
            </div>
          </div>
          <span class="pkg-tag" style="background:rgba(192, 132, 252, 0.15); color:#c084fc;">Quý hiếm</span>
        </div>

        <div class="package-row">
          <div class="pkg-left">
            <span class="pkg-dot" style="background:#fb7185;"></span>
            <div>
              <div class="pkg-name">Mốc 1.000 – 2.000 Giờ</div>
              <div class="pkg-desc">Mở khóa: Sắt Đá (1.000h) & Kiên Định (2.000h)</div>
            </div>
          </div>
          <span class="pkg-tag" style="background:rgba(251, 113, 133, 0.15); color:#fb7185;">Huyền thoại</span>
        </div>

        <div class="package-row highlight">
          <div class="pkg-left">
            <span class="pkg-dot" style="background:#ffd15c; box-shadow:0 0 6px #ffd15c;"></span>
            <div>
              <div class="pkg-name" style="color:#ffd15c;">Mốc 5.000+ Giờ (VĨNH CỬU)</div>
              <div class="pkg-desc">Cấp tối đa MAX TIER · Kiếm Vàng Hoàng Kim</div>
            </div>
          </div>
          <span class="pkg-tag" style="background:rgba(255, 209, 92, 0.25); color:#ffd15c; border:1px solid rgba(255, 209, 92, 0.5);">Đỉnh cao</span>
        </div>
      </div>

      <!-- Guarantees Grid -->
      <div class="guarantees-grid">
        <div class="guarantee-box">
          <div class="guarantee-icon">⚡</div>
          <div class="guarantee-text">
            <h4>Treo Cloud 24/7</h4>
            <p>Hệ thống tự cày ngầm, tắt máy vẫn tăng giờ.</p>
          </div>
        </div>
        <div class="guarantee-box">
          <div class="guarantee-icon">🔐</div>
          <div class="guarantee-text">
            <h4>Bảo Mật Token</h4>
            <p>Khách tự nhập Token, không cần đưa mật khẩu.</p>
          </div>
        </div>
        <div class="guarantee-box">
          <div class="guarantee-icon">🛡️</div>
          <div class="guarantee-text">
            <h4>An Toàn 100%</h4>
            <p>Hoạt động chuẩn Activity Discord, không vi phạm.</p>
          </div>
        </div>
        <div class="guarantee-box">
          <div class="guarantee-icon">✨</div>
          <div class="guarantee-text">
            <h4>Hiện Vĩnh Viễn</h4>
            <p>Ghim vĩnh viễn trên profile cá nhân Discord.</p>
          </div>
        </div>
      </div>
    </div>
  </main>

  <!-- Footer -->
  <footer class="footer">
    <div class="footer-left">
      <span>Tự động siêu tốc</span>
      <span class="footer-dot">•</span>
      <span>An toàn 100% tài khoản</span>
      <span class="footer-dot">•</span>
      <span>Bảo hành trọn đời</span>
      <span class="footer-dot">•</span>
      <span>Huy hiệu hiển thị vĩnh viễn</span>
    </div>
    <div class="web-url">vietnamlegacy.shop</div>
  </footer>
</body>
</html>`;

// 2. SQUARE CARD (800 x 800)
const squareHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 800px;
    height: 800px;
    background: #11090c;
    font-family: "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #fff8ee;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 24px 26px;
    position: relative;
    overflow: hidden;
  }
  
  .bg-glow-gold {
    position: absolute;
    top: -80px;
    right: 40px;
    width: 520px;
    height: 380px;
    background: radial-gradient(circle, rgba(255, 209, 92, 0.18) 0%, rgba(255, 209, 92, 0) 70%);
    pointer-events: none;
  }
  .bg-glow-wine {
    position: absolute;
    bottom: -60px;
    left: 20px;
    width: 540px;
    height: 380px;
    background: radial-gradient(circle, rgba(180, 35, 65, 0.24) 0%, rgba(180, 35, 65, 0) 70%);
    pointer-events: none;
  }
  .bg-grid {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba(255, 209, 92, 0.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 209, 92, 0.035) 1px, transparent 1px);
    background-size: 26px 26px;
    pointer-events: none;
  }

  .header {
    position: relative;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #382428;
    padding-bottom: 12px;
  }
  .brand-group {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .logo-box {
    width: 44px;
    height: 44px;
    background: linear-gradient(135deg, #2b1419, #3f1c24);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    font-weight: 900;
    color: #ffd15c;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.5), inset 0 0 12px rgba(255, 209, 92, 0.15);
    border: 1px solid rgba(255, 209, 92, 0.35);
  }
  .title-group h1 {
    font-size: 19px;
    font-weight: 900;
    letter-spacing: 0.6px;
    background: linear-gradient(135deg, #ffffff 40%, #ffd15c 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    text-transform: uppercase;
  }
  .title-group p {
    font-size: 11px;
    color: #bda8ab;
    margin-top: 2px;
  }
  .badge-tag {
    background: rgba(255, 209, 92, 0.12);
    border: 1px solid rgba(255, 209, 92, 0.4);
    color: #ffd15c;
    padding: 5px 12px;
    border-radius: 16px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.5px;
  }

  /* Center Discord Card */
  .center-content {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 12px 0;
  }
  .discord-card {
    background: rgba(22, 23, 27, 0.94);
    border: 1px solid #33363f;
    border-radius: 16px;
    padding: 18px 20px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }
  .discord-top-bar {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .discord-eyebrow {
    font-size: 11.5px;
    font-weight: 700;
    color: #949ba4;
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }
  .discord-badge-title {
    font-size: 26px;
    font-weight: 900;
    letter-spacing: 1.2px;
    background: linear-gradient(135deg, #fff3c4 0%, #ffd15c 50%, #f59e0b 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    text-shadow: 0 0 20px rgba(255, 209, 92, 0.4);
    margin: 2px 0;
  }
  .discord-stats-row {
    font-size: 11.5px;
    color: #949ba4;
  }
  .discord-stats-row span {
    color: #f2f3f5;
    font-weight: 600;
  }

  .discord-progress-box {
    background: rgba(30, 31, 35, 0.85);
    border: 1px solid #2b2d31;
    border-radius: 10px;
    padding: 10px 14px;
    margin: 12px 0;
  }
  .progress-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }
  .progress-title {
    font-size: 12px;
    font-weight: 800;
    color: #f2f3f5;
  }
  .progress-bar-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .progress-track {
    flex: 1;
    height: 7px;
    background: #2b2d31;
    border-radius: 4px;
    overflow: hidden;
  }
  .progress-fill {
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, #38bdf8 0%, #a855f7 45%, #ffd15c 100%);
    box-shadow: 0 0 10px rgba(255, 209, 92, 0.6);
  }

  /* 10 Swords Grid */
  .swords-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
  }
  .sword-card {
    background: rgba(28, 29, 34, 0.9);
    border: 1px solid #2b2d31;
    border-radius: 10px;
    padding: 8px 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 4px;
  }
  .sword-card.max-tier {
    border-color: rgba(255, 209, 92, 0.6);
    background: linear-gradient(180deg, rgba(255, 209, 92, 0.15) 0%, rgba(28, 29, 34, 0.95) 100%);
    box-shadow: 0 0 16px rgba(255, 209, 92, 0.25);
  }
  .sword-name {
    font-size: 11px;
    font-weight: 800;
    color: #f2f3f5;
  }
  .sword-hours {
    font-size: 9.5px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 10px;
  }

  /* 4 Bottom Highlight Cards */
  .bottom-cards-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  .bottom-card {
    background: rgba(25, 14, 18, 0.9);
    border: 1px solid #3d242a;
    border-radius: 10px;
    padding: 10px 8px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
  }
  .bottom-icon {
    font-size: 16px;
  }
  .bottom-title {
    font-size: 11.5px;
    font-weight: 800;
    color: #fff8ee;
  }
  .bottom-desc {
    font-size: 9.5px;
    color: #bda8ab;
  }

  /* Footer */
  .footer {
    position: relative;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid #382428;
    padding-top: 12px;
  }
  .footer-left {
    font-size: 11px;
    color: #bda8ab;
    font-weight: 600;
  }
  .web-url {
    font-size: 13px;
    font-weight: 900;
    color: #ffd15c;
    text-shadow: 0 0 10px rgba(255, 209, 92, 0.4);
  }
</style>
</head>
<body>
  <div class="bg-glow-gold"></div>
  <div class="bg-glow-wine"></div>
  <div class="bg-grid"></div>

  <!-- Header -->
  <header class="header">
    <div class="brand-group">
      <div class="logo-box">VNL</div>
      <div class="title-group">
        <h1>Auto Badge Game Time</h1>
        <p>Treo giờ chơi PC tự động · 10 Cấp Huy Hiệu Profile</p>
      </div>
    </div>
    <div class="badge-tag">🔥 DISCORD PROFILE</div>
  </header>

  <!-- Center Card -->
  <div class="center-content">
    <div class="discord-card">
      <div class="discord-top-bar">
        <div>
          <div class="discord-eyebrow">Thời gian chơi</div>
          <div class="discord-badge-title">VĨNH CỬU</div>
          <div class="discord-stats-row"><span>5.000+ giờ chơi</span> đã tích lũy • Đã mở khóa vĩnh viễn</div>
        </div>
        <div style="color:#949ba4; font-size:14px;">✕</div>
      </div>

      <div class="discord-progress-box">
        <div class="progress-head">
          <span class="progress-title">Tiến trình của bạn</span>
          <span style="font-size: 10px; color: #ffd15c; font-weight: 700;">ĐÃ ĐẠT CẤP TỐI ĐA (MAX TIER)</span>
        </div>
        <div class="progress-bar-wrap">
          ${renderSwordSvg(tiers[0], 20)}
          <div class="progress-track">
            <div class="progress-fill"></div>
          </div>
          ${renderSwordSvg(tiers[9], 20)}
        </div>
      </div>

      <!-- 10 Badges in Grid -->
      <div class="swords-grid">
        ${tiers.map(t => `
          <div class="sword-card ${t.isMax ? "max-tier" : ""}">
            ${renderSwordSvg(t, 34)}
            <span class="sword-name">${t.name}</span>
            <span class="sword-hours" style="background:${t.tagBg}; color:${t.tagColor};">${t.hours}</span>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- 4 Bottom Highlights -->
    <div class="bottom-cards-grid">
      <div class="bottom-card">
        <span class="bottom-icon">⚡</span>
        <span class="bottom-title">Treo Cloud 24/7</span>
        <span class="bottom-desc">Tự động, không cần mở máy</span>
      </div>
      <div class="bottom-card">
        <span class="bottom-icon">🔐</span>
        <span class="bottom-title">Bảo Mật Token</span>
        <span class="bottom-desc">Không cần mật khẩu</span>
      </div>
      <div class="bottom-card">
        <span class="bottom-icon">🛡️</span>
        <span class="bottom-title">An Toàn 100%</span>
        <span class="bottom-desc">Chuẩn Activity Discord</span>
      </div>
      <div class="bottom-card">
        <span class="bottom-icon">💎</span>
        <span class="bottom-title">Hiện Vĩnh Viễn</span>
        <span class="bottom-desc">Ghim trọn đời trên hồ sơ</span>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <footer class="footer">
    <div class="footer-left">
      ⭐ Cày tự động siêu tốc • An toàn 100% • Bảo hành trọn đời
    </div>
    <div class="web-url">vietnamlegacy.shop</div>
  </footer>
</body>
</html>`;

// Render using Chrome
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const tempBannerHtml = path.resolve("scripts/gametime_banner_temp.html");
const tempSquareHtml = path.resolve("scripts/gametime_square_temp.html");

const outBannerPng = path.resolve("assets/discord-game-time-banner.png");
const outSquarePng = path.resolve("assets/discord-game-time-square.png");
const outThumbPng = path.resolve("assets/discord-game-time-thumb.png");

// Artifact paths
const artifactDir = "C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\215b4bb9-16c9-48dc-9023-225ff66ec7e6";
const artBanner = path.join(artifactDir, "discord-game-time-banner.png");
const artSquare = path.join(artifactDir, "discord-game-time-square.png");

try {
  // 1. Generate Landscape Banner (1200x720, 2x scale = 2400x1440)
  fs.writeFileSync(tempBannerHtml, bannerHtml, "utf8");
  const cmdBanner = `"${chromePath}" --headless=new --screenshot="${outBannerPng}" --window-size=1200,720 --default-background-color=00000000 --force-device-scale-factor=2 --virtual-time-budget=2500 --run-all-compositor-stages-before-draw "file://${tempBannerHtml.replace(/\\\\/g, "/")}"`;
  execSync(cmdBanner, { stdio: "inherit" });
  console.log("Successfully generated landscape banner:", outBannerPng);

  // Copy to thumb and artifact
  fs.copyFileSync(outBannerPng, outThumbPng);
  fs.copyFileSync(outBannerPng, artBanner);

  // 2. Generate Square Card (800x800, 2x scale = 1600x1600)
  fs.writeFileSync(tempSquareHtml, squareHtml, "utf8");
  const cmdSquare = `"${chromePath}" --headless=new --screenshot="${outSquarePng}" --window-size=800,800 --default-background-color=00000000 --force-device-scale-factor=2 --virtual-time-budget=2500 --run-all-compositor-stages-before-draw "file://${tempSquareHtml.replace(/\\\\/g, "/")}"`;
  execSync(cmdSquare, { stdio: "inherit" });
  console.log("Successfully generated square card:", outSquarePng);

  fs.copyFileSync(outSquarePng, artSquare);
  console.log("Copied all banners to assets and artifact directory!");
} catch (e) {
  console.error("Failed to generate banners:", e.message);
  process.exit(1);
} finally {
  if (fs.existsSync(tempBannerHtml)) fs.unlinkSync(tempBannerHtml);
  if (fs.existsSync(tempSquareHtml)) fs.unlinkSync(tempSquareHtml);
}

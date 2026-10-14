import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const stylesCss = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const walletJs = fs.readFileSync(new URL('../wallet.js', import.meta.url), 'utf8');
const appJs = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

test('Customer logout: index.html has topbar and sidebar logout buttons', () => {
  // Topbar logout button in .topbar-actions
  assert.match(indexHtml, /id="topbar-logout"/, 'index.html must have #topbar-logout');
  assert.match(indexHtml, /data-wallet="logout"/, 'logout button must trigger data-wallet="logout"');
  assert.match(indexHtml, /class="logout-topbar"/, '#topbar-logout must have logout-topbar class');

  // Sidebar logout button in mobile main-nav
  assert.match(indexHtml, /id="sidebar-logout"/, 'index.html must have #sidebar-logout in mobile navigation');
  assert.match(indexHtml, /class="nav-item nav-logout"/, '#sidebar-logout must have nav-logout class');
});

test('Customer logout: styles.css contains topbar, sidebar and mobile responsive styling', () => {
  assert.match(stylesCss, /\.logout-topbar\s*\{/, 'styles.css must style .logout-topbar');
  assert.match(stylesCss, /\.nav-item\.nav-logout\s*\{/, 'styles.css must style .nav-item.nav-logout');
  assert.match(stylesCss, /\.orders-account-bar\s*\{/, 'styles.css must style .orders-account-bar');
  assert.match(stylesCss, /\.logout-topbar\s*\.\s*logout-text\s*\{\s*display:\s*none;?\s*\}/, 'mobile media query must hide logout text to keep button compact');
});

test('Customer logout: wallet.js synchronizes logout button visibility and handles logout', () => {
  // Exposes wallet to window
  assert.match(walletJs, /window\.vnlWallet\s*=\s*wallet;/, 'wallet.js must expose window.vnlWallet');

  // updateLabel toggles #topbar-logout and #sidebar-logout
  assert.match(walletJs, /#topbar-logout/, 'wallet.js must reference #topbar-logout');
  assert.match(walletJs, /#sidebar-logout/, 'wallet.js must reference #sidebar-logout');
  assert.match(walletJs, /topbarLogout\.style\.display\s*=\s*isLoggedIn\s*\?\s*"inline-flex"\s*:\s*"none"/, 'topbarLogout must toggle based on login status');
  assert.match(walletJs, /sidebarLogout\.style\.display\s*=\s*isLoggedIn\s*\?\s*"flex"\s*:\s*"none"/, 'sidebarLogout must toggle based on login status');

  // Confirmation on logout and dispatching vnl:logout
  assert.match(walletJs, /window\.confirm\("Bạn có chắc chắn muốn đăng xuất tài khoản\?"\)/, 'wallet.js must ask for confirmation on logout');
  assert.match(walletJs, /vnl:logout/, 'wallet.js must dispatch vnl:logout event on logout');
});

test('Customer logout: app.js contains logout icon, handles vnl:logout, and displays account bar in orders modal', () => {
  // SVG logout icon registered
  assert.match(appJs, /logout:\s*'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/, 'app.js must register logout SVG icon');

  // Orders modal displays customer email and logout button
  assert.match(appJs, /orders-account-bar/, 'app.js showOrders must include orders-account-bar');
  assert.match(appJs, /data-wallet="logout"/, 'orders modal must have a logout button');

  // vnl:logout listener
  assert.match(appJs, /document\.addEventListener\("vnl:logout"/, 'app.js must listen to vnl:logout event');
  assert.match(appJs, /notify\("Đã đăng xuất tài khoản thành công\."\)/, 'app.js must notify user when logged out');
});

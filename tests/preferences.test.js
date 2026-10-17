import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../preferences.js',import.meta.url),'utf8');
function setup(saved={},blocked=false){
 const root={dataset:{},lang:'vi'};
 const document={documentElement:root,readyState:'loading',addEventListener(){}};
 const context={document,window:{},localStorage:{getItem(key){if(blocked)throw new Error('blocked');return saved[key];}},WeakMap};
 vm.runInNewContext(source,context);
 return {root,prefs:context.window.VNLPreferences};
}
test('Preferences default to black/Vietnamese and tolerate blocked storage',()=>{
 for(const blocked of [false,true]){
 const {root,prefs}=setup({},blocked);
 assert.equal(root.dataset.theme,'dark');assert.equal(root.lang,'vi');assert.equal(prefs.t('Đăng nhập'),'Đăng nhập');
 }
});
test('Saved white/English settings load before page rendering',()=>{
 const {root,prefs}=setup({vnl_theme:'light',vnl_language:'en'});
 assert.equal(root.dataset.theme,'light');assert.equal(root.lang,'en');
 assert.equal(prefs.t('Đăng nhập'),'Log in');assert.equal(prefs.t('  Mua ngay  '),'  Buy now  ');
 assert.equal(prefs.t('12 sản phẩm & dịch vụ'),'12 products & services');
 assert.equal(prefs.t('Tin tức (3)'),'News (3)');
 assert.equal(prefs.t('Mã giảm giá'),'Discount code');
 assert.equal(prefs.t('Custom product <b>name</b>'),'Custom product <b>name</b>');
 assert.equal(prefs.t('59.000đ'),'59.000đ');
});
test('Invalid preferences fall back to supported values',()=>{
 const {root}=setup({vnl_theme:'invalid',vnl_language:'invalid'});
 assert.equal(root.dataset.theme,'dark');assert.equal(root.lang,'vi');
});

test('Wallet dollar symbol and topbar maintain high contrast across themes', () => {
  const walletCss = readFileSync(new URL('../wallet.css', import.meta.url), 'utf8');
  const themesCss = readFileSync(new URL('../themes.css', import.meta.url), 'utf8');

  // wallet.css has base dark contrast
  assert.match(walletCss, /\.wallet-symbol\s*\{[^}]*background:\s*#0e1013/);
  assert.match(walletCss, /\.wallet-symbol\s*\{[^}]*border:\s*1px solid #75b7fb/);

  // themes.css has light theme contrast rules so the $ image is never lost on white background
  assert.match(themesCss, /html\[data-theme="light"\]\s+\.wallet-symbol\s*\{[^}]*background:\s*#172554/);
  assert.match(themesCss, /html\[data-theme="light"\]\s+\.wallet-symbol\s*\{[^}]*border-color:\s*#3b82f6/);
  assert.match(themesCss, /html\[data-theme="light"\]\s+\.wallet-topbar\s*\{[^}]*background:\s*#edf3fa/);
});


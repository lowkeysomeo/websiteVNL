import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function setupMobileDOM() {
  const listeners = new Map();
  function addEventListener(event, handler) {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push(handler);
  }
  function dispatch(event, payload = {}) {
    for (const fn of listeners.get(event) || []) {
      fn({ ...payload, preventDefault() {} });
    }
  }

  class Element {
    constructor(id = '', className = '') {
      this.id = id;
      this.className = className;
      this.classList = {
        _classes: new Set(className ? className.split(' ') : []),
        add(c) { this._classes.add(c); },
        remove(c) { this._classes.delete(c); },
        contains(c) { return this._classes.has(c); },
      };
      this.hidden = false;
      this.inert = false;
      this.attributes = new Map();
      this.listeners = new Map();
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) || null; }
    hasAttribute(name) { return this.attributes.has(name); }
    addEventListener(event, handler) {
      if (!this.listeners.has(event)) this.listeners.set(event, []);
      this.listeners.get(event).push(handler);
    }
    dispatch(event, payload = {}) {
      let prevented = false;
      const ev = {
        target: this,
        preventDefault() { prevented = true; },
        ...payload,
      };
      for (const fn of this.listeners.get(event) || []) {
        fn(ev);
      }
      return { prevented };
    }
    contains(child) {
      if (!child) return false;
      if (child === this) return true;
      return child.parent === this;
    }
    closest(selector) {
      if (selector === '#sidebar' && this.id === 'sidebar') return this;
      if (this.parent) return this.parent.closest(selector);
      return null;
    }
  }

  const sidebar = new Element('sidebar', 'sidebar');
  const closeBtn = new Element('close-menu', 'sidebar-close');
  closeBtn.parent = sidebar;
  const navItem = new Element('nav-store', 'nav-item');
  navItem.parent = sidebar;
  const overlay = new Element('menu-overlay', 'menu-overlay');
  overlay.hidden = true;
  const openBtn = new Element('open-menu', 'menu-toggle');
  const pageShell = new Element('home', 'page-shell');
  const body = new Element('body', '');

  const sortSelect = new Element('sort', 'sort');
  const openCart = new Element('open-cart', 'cart-button');
  const resetFilters = new Element('reset-filters', 'button');
  const emptyReset = new Element('empty-reset', 'button');

  const elements = {
    '#sidebar': sidebar,
    '#close-menu': closeBtn,
    '#menu-overlay': overlay,
    '#open-menu': openBtn,
    '.page-shell': pageShell,
    '#sort': sortSelect,
    '#open-cart': openCart,
    '#reset-filters': resetFilters,
    '#empty-reset': emptyReset,
  };

  const document = {
    body,
    querySelector: (sel) => elements[sel] || null,
    querySelectorAll: (sel) => elements[sel] ? [elements[sel]] : [],
    addEventListener,
    dispatch,
  };

  const window = {
    matchMedia: (query) => ({
      matches: query.includes('max-width: 760px') ? true : false,
    }),
    addEventListener() {},
  };

  return { document, window, sidebar, closeBtn, overlay, openBtn, pageShell, body, navItem };
}

test('openMenu và closeMenu đồng bộ trạng thái mở/đóng thanh bên trên mobile', () => {
  const env = setupMobileDOM();
  // Extract openMenu and closeMenu from source
  const startIdx = source.indexOf('function closeMenu()');
  const endIdx = source.indexOf('// Touch swipe-left to close sidebar', startIdx);
  assert(startIdx >= 0 && endIdx > startIdx);

  const snippet = source.slice(startIdx, endIdx);
  const context = vm.createContext({
    document: env.document,
    window: env.window,
    state: { favorites: [], cart: [], category: 'all' },
    search: { addEventListener() {} },
    cartDialog: { showModal() {} },
    resetFilters() {},
    showProduct() {},
    addToCart() {},
    handleAction() {},
    renderProducts() {},
    renderCart() {},
    smoothScrollTo() {},
    startCheckout() {},
    saveState() {},
  });

  vm.runInContext(snippet, context);

  // Initial state check
  assert.equal(env.sidebar.classList.contains('open'), false);
  assert.equal(env.overlay.hidden, true);

  // Call openMenu
  context.openMenu();
  assert.equal(env.sidebar.classList.contains('open'), true, 'Sidebar có class open');
  assert.equal(env.overlay.hidden, false, 'Overlay hiển thị khi mở menu');
  assert.equal(env.body.classList.contains('menu-open'), true, 'Body có class menu-open');
  assert.equal(env.openBtn.getAttribute('aria-expanded'), 'true');
  assert.equal(env.pageShell.inert, true, 'Page shell bị inert để tránh tương tác nền');

  // Trigger close button via touchend
  const touchResult = env.closeBtn.dispatch('touchend');
  assert.equal(touchResult.prevented, true, 'touchend phải gọi preventDefault để tránh click trễ');
  assert.equal(env.sidebar.classList.contains('open'), false, 'Sidebar đã đóng');
  assert.equal(env.overlay.hidden, true, 'Overlay đã ẩn');
  assert.equal(env.body.classList.contains('menu-open'), false, 'Body bỏ class menu-open');
  assert.equal(env.pageShell.inert, false, 'Page shell hết inert');

  // Open again and close via overlay touchend
  context.openMenu();
  assert.equal(env.sidebar.classList.contains('open'), true);
  env.overlay.dispatch('touchend');
  assert.equal(env.sidebar.classList.contains('open'), false, 'Chạm overlay đóng được sidebar');

  // Open again and tap outside on mobile (pointerdown)
  context.openMenu();
  assert.equal(env.sidebar.classList.contains('open'), true);
  env.document.dispatch('pointerdown', { target: env.pageShell });
  assert.equal(env.sidebar.classList.contains('open'), false, 'Chạm ra ngoài vùng sidebar đóng được menu');
});

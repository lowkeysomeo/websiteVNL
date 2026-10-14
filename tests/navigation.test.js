import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const start = source.indexOf('class SmoothInertiaScroll {');
const end = source.indexOf('function initScrollFeatures()', start);
assert(start >= 0 && end > start);
const navigation = source.slice(start, end) + '\nthis.Engine = SmoothInertiaScroll; this.navigate = smoothScrollTo;';

function setup({ reduced = false, mobile = false } = {}) {
  const calls = [], frames = new Map();
  let frameId = 0;
  class HTMLElement { getBoundingClientRect() { return { top: 500 }; } }
  const catalog = new HTMLElement();
  const window = { scrollY: 100, innerHeight: 400,
    matchMedia: query => ({ matches: query.includes('reduced') ? reduced : mobile }),
    addEventListener() {},
    scrollTo(first, second) {
      calls.push(first);
      window.scrollY = typeof first === 'object' ? first.top : second;
    },
  };
  const document = { body: { classList: { contains: () => false } },
    documentElement: { scrollHeight: 2000, classList: { add() {} } },
    querySelector: selector => selector === '#catalog' ? catalog : null,
  };
  const context = vm.createContext({ window, document, HTMLElement,
    performance: { now: () => 100 },
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
  });
  vm.runInContext(navigation, context);
  window.__smoothScroll = new context.Engine();
  return { context, window, calls, frames, catalog };
}

test('Khám phá sản phẩm cuộn chuẩn khi bật giảm chuyển động', () => {
  const env = setup({ reduced: true });
  assert.equal(env.window.__smoothScroll.enabled, false);
  env.context.navigate('#catalog');
  assert.equal(env.calls[0].top, 515);
  assert.equal(env.calls[0].behavior, 'auto');
  assert.equal(env.frames.size, 0, 'Không chạy vòng cuộn với trạng thái chưa khởi tạo');
});

test('Điện thoại vẫn đi đến sản phẩm bằng cuộn của trình duyệt', () => {
  const env = setup({ mobile: true });
  env.context.navigate(env.catalog);
  assert.equal(env.calls[0].top, 515);
  assert.equal(env.calls[0].behavior, 'smooth');
  assert.equal(env.frames.size, 0);
});

test('Desktop giữ cuộn mượt và kết thúc tại đúng danh sách sản phẩm', () => {
  const env = setup();
  assert.equal(env.window.__smoothScroll.enabled, true);
  env.context.navigate('#catalog');
  let time = 100, count = 0;
  while (env.frames.size && count++ < 200) {
    const [id, callback] = env.frames.entries().next().value;
    env.frames.delete(id); callback(time += 16.67);
  }
  assert(count < 200);
  assert.equal(env.window.scrollY, 515);
  assert.equal(env.window.__smoothScroll.isScrolling, false);
  assert(env.calls.every(call => call === 0));
});

test('Không cuộn khi mục tiêu không tồn tại; trở về đầu trang vẫn hoạt động', () => {
  const env = setup({ reduced: true });
  env.context.navigate('#missing');
  assert.equal(env.calls.length, 0);
  env.context.navigate('#home');
  assert.equal(env.calls[0].top, 0);
});

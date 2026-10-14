import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../hero3d.js', import.meta.url), 'utf8');
const start = source.indexOf('    const clock = new THREE.Clock();');
const end = source.indexOf('      const delta =', start);
const loop = source.slice(start, end) + 'renders++; } scheduleFrame();';
function setup(reduced = false) {
  const frames = new Map(), events = {};
  let id = 0, observe;
  const context = { renders: 0, card: {},
    THREE: { Clock: class { getDelta() { return 0; } } },
    window: { IntersectionObserver: true },
    document: { hidden: false, addEventListener(name, fn) { events[name] = fn; } },
    reducedMotion: { matches: reduced, addEventListener(name, fn) { events.motion = fn; } },
    IntersectionObserver: class { constructor(fn) { observe = fn; } observe() {} },
    requestAnimationFrame(fn) { frames.set(++id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); }
  };
  vm.runInNewContext(loop, context);
  return { context, frames, events,
    visible(value) { observe([{ isIntersecting: value }]); },
    tick(time) { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(time)); }
  };
}
test('3D dừng hoàn toàn ngoài màn hình và tab ẩn, tiếp tục với một vòng RAF', () => {
  const h = setup();
  assert.equal(h.frames.size, 0);
  h.visible(true); h.tick(0);
  assert.equal(h.context.renders, 1);
  assert.equal(h.frames.size, 1);
  h.visible(false);
  assert.equal(h.frames.size, 0);
  h.visible(true); h.visible(true);
  assert.equal(h.frames.size, 1);
  h.context.document.hidden = true; h.events.visibilitychange();
  assert.equal(h.frames.size, 0);
  h.context.document.hidden = false; h.events.visibilitychange(); h.tick(1000);
  assert.equal(h.context.renders, 2);
});
test('Giới hạn vẽ trên màn hình tần số cao nhưng vẫn chạy khi hệ thống giảm chuyển động', () => {
  const h = setup(true); h.visible(true);
  h.tick(0); h.tick(7); h.tick(14);
  assert.equal(h.context.renders, 1);
  h.tick(21); assert.equal(h.context.renders, 2);
  assert.equal(h.frames.size, 1);
  h.tick(42); assert.equal(h.context.renders, 3);
  h.visible(false); assert.equal(h.frames.size, 0);
  h.visible(true); h.tick(100);
  assert.equal(h.context.renders, 4);
  assert.equal(h.frames.size, 1);
});

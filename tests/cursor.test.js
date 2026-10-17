import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Custom cursor effects are completely removed and default cursor is retained', () => {
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const stylesCss = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const bg3dJs = readFileSync(new URL('../bg3d.js', import.meta.url), 'utf8');

  // DOM: no custom cursor elements in index.html
  assert.equal(indexHtml.includes('id="cursor-dot"'), false, 'cursor-dot element should be removed');
  assert.equal(indexHtml.includes('id="cursor-ring"'), false, 'cursor-ring element should be removed');
  assert.equal(indexHtml.includes('class="cursor-dot"'), false, 'cursor-dot class should be removed');
  assert.equal(indexHtml.includes('class="cursor-ring"'), false, 'cursor-ring class should be removed');

  // CSS: no custom cursor classes or rules forcing cursor: none
  assert.equal(stylesCss.includes('.cursor-dot'), false, 'styles.css should not contain .cursor-dot');
  assert.equal(stylesCss.includes('.cursor-ring'), false, 'styles.css should not contain .cursor-ring');
  assert.equal(stylesCss.includes('has-custom-cursor'), false, 'styles.css should not contain has-custom-cursor');
  assert.equal(stylesCss.includes('cursor: none'), false, 'styles.css should never hide standard cursor');

  // JS: bg3d.js does not inject or track custom cursor DOM
  assert.equal(bg3dJs.includes('#cursor-dot'), false, 'bg3d.js should not query or create cursor-dot');
  assert.equal(bg3dJs.includes('#cursor-ring'), false, 'bg3d.js should not query or create cursor-ring');
  assert.equal(bg3dJs.includes('has-custom-cursor'), false, 'bg3d.js should not toggle has-custom-cursor class');
});

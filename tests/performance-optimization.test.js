import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

test('Web performance optimizations: prevent 10s initial load lag', () => {
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const stylesCss = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const bg3dJs = readFileSync(new URL('../bg3d.js', import.meta.url), 'utf8');
  const hero3dJs = readFileSync(new URL('../hero3d.js', import.meta.url), 'utf8');
  const introJs = readFileSync(new URL('../intro.js', import.meta.url), 'utf8');

  // 1. styles.css does NOT contain render-blocking @import for fonts
  assert.equal(
    stylesCss.includes('@import url("https://fonts.googleapis.com'),
    false,
    'styles.css should not contain render-blocking @import'
  );
  assert.equal(
    stylesCss.includes('-apple-system'),
    true,
    'styles.css should provide fast native fallback fonts'
  );

  // 2. index.html contains preconnect and font links
  assert.equal(
    indexHtml.includes('rel="preconnect" href="https://fonts.googleapis.com"'),
    true,
    'index.html should preconnect to Google Fonts'
  );
  assert.equal(
    indexHtml.includes('rel="preconnect" href="https://fonts.gstatic.com"'),
    true,
    'index.html should preconnect to gstatic'
  );

  // 3. Asset sizes: font and avatar must be optimized
  const avatarPath = new URL('../assets/vnl-avatar.png', import.meta.url);
  const avatarStat = statSync(avatarPath);
  assert.ok(
    avatarStat.size < 250000,
    `vnl-avatar.png should be optimized under 250KB (current: ${avatarStat.size} bytes)`
  );

  const fontPath = new URL('../assets/fonts/vnl-font.js', import.meta.url);
  const fontStat = statSync(fontPath);
  assert.ok(
    fontStat.size < 50000,
    `vnl-font.js should be subsetted under 50KB (current: ${fontStat.size} bytes)`
  );

  // 4. bg3d.js skips WebGL on mobile devices to prevent dual-WebGL GPU thrashing
  assert.equal(
    bg3dJs.includes('if (isMobile) return;'),
    true,
    'bg3d.js should return early on mobile'
  );

  // 5. hero3d.js uses adaptive curveSegments / bevelSegments
  assert.equal(
    hero3dJs.includes('lightDevice ? 6 : 8'),
    true,
    'hero3d.js should use adaptive geometry segments'
  );

  // 6. intro.js does not use expensive filter: blur software rasterization
  assert.equal(
    introJs.includes('filter:'),
    false,
    'intro.js should not use expensive filter: blur on animating elements'
  );
});

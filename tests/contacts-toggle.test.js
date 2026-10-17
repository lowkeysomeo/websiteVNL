import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Floating support contacts bar has arrow toggle button to collapse and expand', () => {
  const appJs = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const stylesCss = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const themesCss = readFileSync(new URL('../themes.css', import.meta.url), 'utf8');

  // 1. Check app.js logic and markup
  assert.equal(
    appJs.includes('class="floating-contacts-toggle"'),
    true,
    'app.js should render .floating-contacts-toggle button'
  );
  assert.equal(
    appJs.includes('floating-toggle-arrow'),
    true,
    'app.js should render .floating-toggle-arrow SVG icon'
  );
  assert.equal(
    appJs.includes('vnl_contacts_collapsed'),
    true,
    'app.js should persist collapse state via vnl_contacts_collapsed in localStorage'
  );
  assert.equal(
    appJs.includes('is-collapsed'),
    true,
    'app.js should toggle is-collapsed class on container'
  );
  assert.equal(
    appJs.includes('aria-expanded'),
    true,
    'app.js should update aria-expanded on toggle button for accessibility'
  );

  // 2. Check styles.css rules
  assert.equal(
    stylesCss.includes('.floating-contacts.is-collapsed'),
    true,
    'styles.css should define .floating-contacts.is-collapsed rule'
  );
  assert.equal(
    stylesCss.includes('.floating-contacts-toggle'),
    true,
    'styles.css should style .floating-contacts-toggle'
  );
  assert.equal(
    stylesCss.includes('.floating-contacts.is-collapsed .floating-toggle-arrow'),
    true,
    'styles.css should rotate arrow 180deg when collapsed'
  );
  assert.equal(
    stylesCss.includes('translateX(calc(100% + 20px - 34px))'),
    true,
    'styles.css should translate collapsed dock leaving handle visible'
  );

  // 3. Check themes.css light mode styles
  assert.equal(
    themesCss.includes('html[data-theme="light"] .floating-contacts-toggle'),
    true,
    'themes.css should style toggle button in light mode'
  );
  assert.equal(
    themesCss.includes('html[data-theme="light"] .floating-contacts-dock'),
    true,
    'themes.css should style dock in light mode'
  );
});

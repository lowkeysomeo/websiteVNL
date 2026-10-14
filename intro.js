// Intro chạy một lần khi mở trang; thao tác của người dùng luôn được ưu tiên.
(function () {
  'use strict';

  function init() {
    if (document.documentElement.dataset.introReady) return;
    document.documentElement.dataset.introReady = 'true';
    if (typeof Element.prototype.animate !== 'function') return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animations = [];
    const groups = [
      ['.logo, .topbar', 0, 'soft'],
      ['.sidebar .nav-item', 60, 'soft'],
      ['.breadcrumb', 120, 'soft'],
      ['.hero-eyebrow', 220, 'soft'],
      ['#hero-title .intro-line-content', 340, 'words'],
      ['.hero-copy p .intro-line-content', 1400, 'line'],
      ['.hero-actions > *', 1700, 'soft'],
      ['.hero-footnote, .hero-media-caption', 1850, 'soft'],
      ['.benefits > *', 1950, 'soft'],
    ];

    function reveal(element, delay, kind) {
      const motion = kind === 'word' ? 'translate3d(0, 110%, 0)' :
        kind === 'line' ? 'translate3d(0, 105%, 0)' : 'translate3d(0, 12px, 0)';
      const start = { opacity: 0, transform: motion, filter: reduced ? 'blur(0)' : 'blur(1px)' };
      const end = { opacity: 1, transform: 'translate3d(0, 0, 0)', filter: 'blur(0)' };
      const animation = element.animate([start, end], {
        duration: kind === 'word' ? 1200 : 900,
        delay,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'backwards',
      });
      animations.push(animation);
    }

    for (const [selector, delay, kind] of groups) {
      document.querySelectorAll(selector).forEach((element, index) => {
        if (kind !== 'words') {
          reveal(element, delay + index * 80, kind);
          return;
        }
        // Giữ dấu cách thật để đọc, chọn và sao chép tiêu đề như văn bản bình thường.
        const words = element.textContent.trim().split(/\s+/);
        const fragment = document.createDocumentFragment();
        words.forEach((word, wordIndex) => {
          const span = document.createElement('span');
          span.className = 'intro-word';
          span.textContent = word;
          fragment.appendChild(span);
          if (wordIndex < words.length - 1) fragment.appendChild(document.createTextNode(' '));
        });
        element.replaceChildren(fragment);
        element.querySelectorAll('.intro-word').forEach((word, wordIndex) => {
          reveal(word, delay + index * 340 + wordIndex * 110, 'word');
        });
      });
    }

    function finish() {
      animations.forEach(animation => animation.cancel());
      window.removeEventListener('pointerdown', finish);
      window.removeEventListener('wheel', finish);
      window.removeEventListener('touchstart', finish);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', finish);
    }
    function onKey(event) { if (['Tab', 'Enter', 'Escape', ' '].includes(event.key)) finish(); }
    function onVisibility() { if (document.hidden) finish(); }
    window.addEventListener('pointerdown', finish, { passive: true, once: true });
    window.addEventListener('wheel', finish, { passive: true, once: true });
    window.addEventListener('touchstart', finish, { passive: true, once: true });
    window.addEventListener('pagehide', finish, { once: true });
    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    Promise.allSettled(animations.map(animation => animation.finished)).then(finish);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

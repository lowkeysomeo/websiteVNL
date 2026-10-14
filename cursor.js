// Con trỏ kép và sao Canvas dùng chung một vòng vẽ theo nhu cầu.
(function () {
  'use strict';

  function init() {
    const dot = document.querySelector('#cursor-dot');
    const ring = document.querySelector('#cursor-ring');
    const canvas = document.querySelector('#cursor-particles');
    if (!dot || !ring || !canvas) return;

    const context = canvas.getContext('2d');
    const finePointer = window.matchMedia('(any-hover: hover) and (any-pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const interactive = 'a[href], button, [role="button"], summary, .product-card';
    const nativeControls = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), iframe';
    const surfaces = '.hero, .product-card, .support-card, .bottom-banner, .benefit-item, .order-card, .catalog-controls';
    const pointer = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    const spring = { x: 0, y: 0, vx: 0, vy: 0 };
    const particles = [];
    const colors = ['#ffd15c', '#ffd15c', '#fff1c7', '#c084fc'];
    let visible = false;
    let pressStarted = 0;
    let releaseTimer = 0;
    let frame = 0;
    let lastTime = 0;
    let lastTrailTime = 0;
    let trailX = 0;
    let trailY = 0;
    let surface = null;
    let surfaceDirty = false;
    let width = 0;
    let height = 0;

    function resize() {
      if (!context || !finePointer.matches) return;
      width = window.innerWidth;
      height = window.innerHeight;
      // Giới hạn độ phân giải để màn hình lớn không tốn quá nhiều bộ nhớ.
      const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(6000000 / Math.max(1, width * height)));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      schedule();
    }

    function clearSurface() {
      if (surface) {
        surface.style.removeProperty('--mouse-x');
        surface.style.removeProperty('--mouse-y');
        surface.classList.remove('cursor-lit');
      }
      surface = null;
      surfaceDirty = false;
    }

    function hide() {
      clearTimeout(releaseTimer);
      releaseTimer = 0;
      visible = false;
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      lastTrailTime = 0;
      spring.vx = spring.vy = 0;
      particles.length = 0;
      if (document.body.classList.contains('has-custom-cursor')) document.body.classList.remove('has-custom-cursor');
      [dot, ring, canvas].forEach(element => element.classList.remove('active', 'hover', 'clicking'));
      if (context) context.clearRect(0, 0, width, height);
      clearSurface();
    }

    function blocked() {
      return !finePointer.matches || document.hidden || document.body.classList.contains('modal-open') ||
        Boolean(document.querySelector('dialog[open]'));
    }

    function schedule() {
      if (!frame && visible) frame = requestAnimationFrame(draw);
    }

    function addStar(x, y, vx, vy, burst) {
      if (!context) return;
      const limit = reducedMotion.matches ? 24 : 80;
      if (particles.length >= limit) particles.shift();
      particles.push({ x, y, vx, vy, burst,
        size: burst ? 2 + Math.random() * 1.6 : 1.2 + Math.random() * 1.3,
        age: 0, life: reducedMotion.matches ? 0.32 : (burst ? 0.65 : 0.64) + Math.random() * 0.16,
        angle: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 0.6,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    function paintStars(dt) {
      if (!context) return;
      context.clearRect(0, 0, width, height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const star = particles[i];
        star.age += dt;
        if (star.age >= star.life) { particles.splice(i, 1); continue; }
        star.x += star.vx * dt;
        star.y += star.vy * dt;
        const drag = Math.exp(-2.8 * dt);
        star.vx *= drag; star.vy *= drag;
        star.angle += star.spin * dt;
        const progress = star.age / star.life;
        const size = star.size * (1 - progress * 0.4);
        context.save();
        context.translate(star.x, star.y);
        context.rotate(star.angle);
        context.globalAlpha = Math.pow(1 - progress, 1.4) * (star.burst ? 0.9 : 0.65);
        context.fillStyle = star.color;
        // Bốn cánh cong nhẹ tạo hình ✦ sắc nét ngay cả với hạt rất nhỏ.
        context.beginPath();
        context.moveTo(0, -size * 1.5);
        context.quadraticCurveTo(size * 0.15, -size * 0.15, size * 1.5, 0);
        context.quadraticCurveTo(size * 0.15, size * 0.15, 0, size * 1.5);
        context.quadraticCurveTo(-size * 0.15, size * 0.15, -size * 1.5, 0);
        context.quadraticCurveTo(-size * 0.15, -size * 0.15, 0, -size * 1.5);
        context.closePath();
        context.fill();
        context.restore();
      }
    }

    function draw(time) {
      frame = 0;
      if (!visible) return;
      if (blocked()) { hide(); return; }
      // Tối đa khoảng 60 khung/giây, không chạy nhanh gấp đôi trên màn hình 120 Hz.
      if (lastTime && time - lastTime < 15) { schedule(); return; }
      const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.04) : 1 / 60;
      lastTime = time;
      // Vòng luôn có độ lướt; chế độ nhẹ tăng giảm chấn để không nảy mạnh.
      const stiffness = reducedMotion.matches ? 620 : 420;
      const damping = reducedMotion.matches ? 42 : 28;
      const steps = Math.ceil(dt / (1 / 120));
      const step = dt / steps;
      for (let i = 0; i < steps; i++) {
        spring.vx += ((target.x - spring.x) * stiffness - spring.vx * damping) * step;
        spring.vy += ((target.y - spring.y) * stiffness - spring.vy * damping) * step;
        spring.x += spring.vx * step;
        spring.y += spring.vy * step;
      }
      dot.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0) translate(-50%, -50%)`;
      ring.style.transform = `translate3d(${spring.x}px, ${spring.y}px, 0) translate(-50%, -50%)`;
      if (surfaceDirty && surface && surface.isConnected) {
        const rect = surface.getBoundingClientRect();
        surface.style.setProperty('--mouse-x', `${pointer.x - rect.left}px`);
        surface.style.setProperty('--mouse-y', `${pointer.y - rect.top}px`);
        surfaceDirty = false;
      }
      paintStars(dt);
      const settled = Math.hypot(target.x - spring.x, target.y - spring.y) < 0.15 &&
        Math.hypot(spring.vx, spring.vy) < 0.5;
      if (particles.length || !settled) schedule();
      else lastTime = 0;
    }

    function move(event, trail = true) {
      if (event.pointerType !== 'mouse' || blocked()) { hide(); return false; }
      const element = event.target instanceof Element ? event.target : null;
      if (!element || element.closest(nativeControls) || element.closest(':disabled, [aria-disabled="true"]')) {
        hide(); return false;
      }
      pointer.x = target.x = event.clientX;
      pointer.y = target.y = event.clientY;
      if (!visible) {
        if (context && !width) resize();
        spring.x = trailX = pointer.x;
        spring.y = trailY = pointer.y;
        spring.vx = spring.vy = 0;
        visible = true;
        document.body.classList.add('has-custom-cursor');
        [dot, ring, canvas].forEach(item => item.classList.add('active'));
      }
      // Chấm luôn đi đúng vị trí thật; chỉ vòng ngoài chịu lực hút nhẹ từ nút/link.
      dot.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0) translate(-50%, -50%)`;
      const hover = element.closest(interactive);
      ring.classList.toggle('hover', Boolean(hover));
      dot.classList.toggle('hover', Boolean(hover));
      if (hover && !hover.matches('.product-card') && !reducedMotion.matches) {
        const rect = hover.getBoundingClientRect();
        const dx = rect.left + rect.width / 2 - pointer.x;
        const dy = rect.top + rect.height / 2 - pointer.y;
        target.x += Math.max(-7, Math.min(7, dx * 0.12));
        target.y += Math.max(-7, Math.min(7, dy * 0.12));
      }
      const nextSurface = element.closest(surfaces);
      if (nextSurface !== surface) {
        clearSurface(); surface = nextSurface;
        if (surface) surface.classList.add('cursor-lit');
      }
      surfaceDirty = Boolean(surface);
      const now = performance.now();
      const dx = pointer.x - trailX, dy = pointer.y - trailY;
      if (trail && Math.hypot(dx, dy) > 4 && now - lastTrailTime > (reducedMotion.matches ? 40 : 16)) {
        addStar(pointer.x, pointer.y, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12 - 4, false);
        lastTrailTime = now; trailX = pointer.x; trailY = pointer.y;
      }
      schedule();
      return true;
    }

    window.addEventListener('pointermove', event => move(event), { passive: true });
    window.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !move(event, false)) return;
      clearTimeout(releaseTimer);
      releaseTimer = 0;
      pressStarted = performance.now();
      ring.classList.add('clicking');
      dot.classList.add('clicking');
      const count = reducedMotion.matches ? 6 : 12;
      for (let i = 0; i < count; i++) {
        const angle = Math.PI * 2 * i / count + Math.random() * 0.2;
        const speed = reducedMotion.matches ? 14 : 36 + Math.random() * 38;
        addStar(pointer.x, pointer.y, Math.cos(angle) * speed, Math.sin(angle) * speed, true);
      }
      schedule();
    }, { passive: true });
    window.addEventListener('pointerup', event => {
      if (event.button !== 0 || !visible) return;
      const delay = Math.max(0, 140 - (performance.now() - pressStarted));
      clearTimeout(releaseTimer);
      releaseTimer = setTimeout(() => {
        [ring, dot].forEach(item => item.classList.remove('clicking'));
        releaseTimer = 0;
      }, delay);
    }, { passive: true });
    window.addEventListener('pointercancel', hide, { passive: true });
    window.addEventListener('touchstart', hide, { passive: true });
    window.addEventListener('blur', hide);
    window.addEventListener('pagehide', hide);
    window.addEventListener('resize', () => { hide(); resize(); }, { passive: true });
    window.addEventListener('scroll', hide, { passive: true, capture: true });
    document.documentElement.addEventListener('pointerleave', hide);
    document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });
    document.addEventListener('keydown', event => { if (event.key === 'Tab') hide(); });
    finePointer.addEventListener('change', () => { hide(); resize(); });
    reducedMotion.addEventListener('change', hide);

    // Không sửa trạng thái modal của ứng dụng, chỉ theo dõi để khôi phục con trỏ chuẩn.
    const observer = new MutationObserver(() => { if (blocked()) hide(); });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    document.querySelectorAll('dialog').forEach(dialog => observer.observe(dialog, { attributes: true, attributeFilter: ['open'] }));
    resize();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

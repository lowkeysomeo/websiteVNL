/**
 * VietNam Legacy · Interactive Cursor & Ambient Spotlight Engine
 * 
 * Tinh chỉnh cao cấp:
 * 1. Vầng sáng Ambient Spotlight dịu nhẹ, nhỏ gọn (bán kính ~110px, loại bỏ hoàn toàn ánh sáng chói)
 * 2. Con trỏ kép (Dual Precision):
 *    - Chấm định vị 4px sắc nét, tinh tế
 *    - Vòng tròn thanh mảnh 18px (hover nút bấm nhẹ nhàng nở 26px, không gây choán màn hình)
 * 3. Hạt bụi sao lấp lánh li ti (✦) trôi nhẹ bồng bềnh
 * 4. Tự động tương thích hoàn hảo mọi thiết bị & khôi phục khi mở modal
 */

(function () {
  'use strict';

  function init() {
    const glow = document.querySelector('#cursor-glow');
    const dot = document.querySelector('#cursor-dot');
    const ring = document.querySelector('#cursor-ring');
    const canvas = document.querySelector('#cursor-particles');

    if (!glow || !dot || !ring || !canvas) return;

    const ctx = canvas.getContext('2d');
    let width = window.innerWidth;
    let height = window.innerHeight;

    function resizeCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const mouse = {
      x: -500,
      y: -500,
      targetX: -500,
      targetY: -500,
      lastX: -500,
      lastY: -500,
      speed: 0
    };
    const ringPos = { x: -500, y: -500 };
    const glowPos = { x: -500, y: -500 };
    let hasMoved = false;

    // Modal dialog state check
    function updateModalState() {
      const hasOpenDialog = Array.from(document.querySelectorAll('dialog')).some(function (d) {
        return d.open;
      });
      document.body.classList.toggle('modal-open', hasOpenDialog);
    }

    if (typeof MutationObserver !== 'undefined') {
      const dialogObserver = new MutationObserver(updateModalState);
      document.querySelectorAll('dialog').forEach(function (d) {
        dialogObserver.observe(d, { attributes: true, attributeFilter: ['open'] });
        d.addEventListener('close', updateModalState);
        d.addEventListener('cancel', updateModalState);
      });
    }
    updateModalState();

    // Particle engine (nhẹ nhàng, thanh thoát)
    const particles = [];
    const maxParticles = 60;
    const colors = [
      '#ffd15c', // Vàng Hoàng Kim
      '#ffeaa7', // Vàng ánh kim nhạt
      '#ffffff', // Trắng
      '#c084fc', // Tím nhạt
      '#f59e0b'  // Hổ phách
    ];

    function Particle(x, y, vx, vy, color, size, decay) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.color = color;
      this.size = size;
      this.alpha = 0.75;
      this.decay = decay;
      this.rotation = Math.random() * Math.PI * 2;
      this.vRot = (Math.random() - 0.5) * 0.08;
      this.isStar = Math.random() > 0.4;
    }

    Particle.prototype.update = function () {
      this.x += this.vx;
      this.y += this.vy;
      this.vx *= 0.95;
      this.vy *= 0.95;
      this.vy += 0.02;
      this.alpha -= this.decay;
      this.rotation += this.vRot;
      return this.alpha > 0;
    };

    Particle.prototype.draw = function (context) {
      context.save();
      context.globalAlpha = Math.max(0, this.alpha);
      context.translate(this.x, this.y);
      context.rotate(this.rotation);
      context.fillStyle = this.color;

      if (this.isStar) {
        // Ngôi sao 4 cánh siêu nhỏ gọn ✦
        const r = this.size;
        context.beginPath();
        context.moveTo(0, -r * 1.5);
        context.quadraticCurveTo(0, 0, r * 1.5, 0);
        context.quadraticCurveTo(0, 0, 0, r * 1.5);
        context.quadraticCurveTo(0, 0, -r * 1.5, 0);
        context.quadraticCurveTo(0, 0, 0, -r * 1.5);
        context.closePath();
        context.fill();
      } else {
        context.beginPath();
        context.arc(0, 0, this.size, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    };

    function spawnTrail(x, y, count) {
      const c = count || 1;
      if (particles.length >= maxParticles) return;
      for (let i = 0; i < c; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 0.9 + 0.2;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed - 0.15;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const size = Math.random() * 1.4 + 0.8;
        const decay = Math.random() * 0.024 + 0.018;
        particles.push(new Particle(x, y, vx, vy, color, size, decay));
      }
    }

    function spawnBurst(x, y) {
      const count = 9;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
        const speed = Math.random() * 2.4 + 1.2;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const size = Math.random() * 1.8 + 1.0;
        const decay = Math.random() * 0.026 + 0.02;
        particles.push(new Particle(x, y, vx, vy, color, size, decay));
      }
    }

    window.addEventListener('touchstart', function () {
      document.body.classList.remove('has-custom-cursor');
      glow.classList.remove('active');
      dot.classList.remove('active');
      ring.classList.remove('active');
    }, { passive: true });

    function onPointerMove(e) {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;

      if (!hasMoved) {
        hasMoved = true;
        mouse.x = ringPos.x = glowPos.x = e.clientX;
        mouse.y = ringPos.y = glowPos.y = e.clientY;
      }

      if (!document.body.classList.contains('has-custom-cursor')) {
        document.body.classList.add('has-custom-cursor');
      }

      if (!glow.classList.contains('active')) glow.classList.add('active');
      if (!dot.classList.contains('active')) dot.classList.add('active');
      if (!ring.classList.contains('active')) ring.classList.add('active');

      const dx = e.clientX - mouse.lastX;
      const dy = e.clientY - mouse.lastY;
      mouse.speed = Math.hypot(dx, dy);

      if (mouse.speed > 2.2 && !document.body.classList.contains('modal-open')) {
        const chance = mouse.speed > 14 ? 0.85 : 0.45;
        if (Math.random() < chance) {
          spawnTrail(e.clientX, e.clientY, 1);
        }
      }

      mouse.lastX = e.clientX;
      mouse.lastY = e.clientY;

      // Card & Hero surface subtle tracking
      const card = e.target.closest(
        '.hero, .hero-media, .product-card, .support-card, .bottom-banner, .benefit-item, .order-card, .catalog-controls'
      );
      if (card) {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
        card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
      }
    }

    window.addEventListener('mousemove', onPointerMove, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    window.addEventListener('mousedown', function (e) {
      if (document.body.classList.contains('modal-open')) return;
      ring.classList.add('clicking');
      dot.classList.add('clicking');
      spawnBurst(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', function () {
      ring.classList.remove('clicking');
      dot.classList.remove('clicking');
    });

    // Hover: CHỈ kích hoạt phóng to vòng tròn trên các nút/link tương tác trực tiếp
    // KHÔNG kích hoạt trên thẻ product-card để tránh vòng tròn quá to khi rê chuột xem hàng
    document.addEventListener('mouseover', function (e) {
      const clickable = e.target.closest(
        'button, a, input, select, textarea, [role="button"], .buy-button, .add-button, .favorite-button, .icon-button, .nav-item, .filter, .tab-item, .scroll-top-button'
      );
      if (clickable) {
        ring.classList.add('hover');
        dot.classList.add('hover');
      }
    });

    document.addEventListener('mouseout', function (e) {
      const clickable = e.target.closest(
        'button, a, input, select, textarea, [role="button"], .buy-button, .add-button, .favorite-button, .icon-button, .nav-item, .filter, .tab-item, .scroll-top-button'
      );
      if (clickable) {
        ring.classList.remove('hover');
        dot.classList.remove('hover');
      }
    });

    document.addEventListener('mouseleave', function () {
      glow.classList.remove('active');
      dot.classList.remove('active');
      ring.classList.remove('active');
    });

    document.addEventListener('mouseenter', function () {
      if (hasMoved) {
        glow.classList.add('active');
        dot.classList.add('active');
        ring.classList.add('active');
      }
    });

    function renderLoop() {
      // Easing mượt mà
      mouse.x += (mouse.targetX - mouse.x) * 0.85;
      mouse.y += (mouse.targetY - mouse.y) * 0.85;

      ringPos.x += (mouse.targetX - ringPos.x) * 0.22;
      ringPos.y += (mouse.targetY - ringPos.y) * 0.22;

      glowPos.x += (mouse.targetX - glowPos.x) * 0.16;
      glowPos.y += (mouse.targetY - glowPos.y) * 0.16;

      dot.style.transform = `translate3d(${mouse.x}px, ${mouse.y}px, 0) translate(-50%, -50%)`;
      ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0) translate(-50%, -50%)`;
      glow.style.transform = `translate3d(${glowPos.x}px, ${glowPos.y}px, 0) translate(-50%, -50%)`;

      // Clear Canvas
      ctx.clearRect(0, 0, width, height);

      // 1. Vầng sáng Ambient Spotlight dịu nhẹ, vùng sáng nhỏ gọn (bán kính 110px)
      if (hasMoved && !document.body.classList.contains('modal-open')) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const radGrad = ctx.createRadialGradient(
          glowPos.x, glowPos.y, 0,
          glowPos.x, glowPos.y, 110
        );
        radGrad.addColorStop(0, 'rgba(255, 209, 92, 0.08)');     // Sáng nhẹ vàng hoàng kim, êm dịu không chói
        radGrad.addColorStop(0.45, 'rgba(192, 132, 252, 0.05)'); // Tím nhẹ êm ái
        radGrad.addColorStop(0.8, 'rgba(239, 68, 68, 0.015)');   // Ánh hồng ấm mỏng
        radGrad.addColorStop(1, 'rgba(20, 11, 13, 0)');          // Tan biến tự nhiên
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(glowPos.x, glowPos.y, 110, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 2. Các hạt bụi sao lấp lánh (Sparkling Stardust)
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (p.update()) {
          p.draw(ctx);
        } else {
          particles.splice(i, 1);
        }
      }

      requestAnimationFrame(renderLoop);
    }

    requestAnimationFrame(renderLoop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

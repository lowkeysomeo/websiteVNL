/* Nền WebGL và con trỏ tương tác, dùng chung Three.js với phần hero. */
(function () {
  'use strict';

  const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia && window.matchMedia('(any-hover: hover) and (any-pointer: fine)');

  const CONFIG = {
    bgHex: '#090909',
    primaryHex: 0x999999,     // Đỏ Ruby VietNam Legacy
    secondaryHex: 0xcccccc,   // Tím Discord Nitro
    speed: prefersReduced ? 0.08 : 0.22,
    parallax: prefersReduced ? 0 : (isMobile ? 0.45 : 1.15),
    nodeCount: isMobile ? 50 : 92,
    linkDist: isMobile ? 8.5 : 9.4,
    mouseRepelDist: 10.5,     // Bán kính lực đẩy/xoáy từ trường khi di chuột
    mouseForce: 0.085,        // Độ mạnh lực tương tác chuột
    maxPixelRatio: isMobile ? 1.0 : 1.5
  };

  function createGlowTexture() {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 32;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(210,210,210,0.8)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }

  function initVnl3DBackground() {
    if (!window.THREE) {
      setTimeout(initVnl3DBackground, 100);
      return;
    }
    if (document.getElementById('vnl-bg-3d')) return;

    // 1. CSS giúp nền 3D nằm dưới cùng, giữ nguyên 100% thao tác click của web
    const style = document.createElement('style');
    style.id = 'vnl-bg-3d-styles';
    style.textContent = `
      #vnl-bg-3d {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        z-index: 0;
        pointer-events: none;
        display: block;
      }
      body {
        background-color: var(--background) !important;
      }
      .page-shell {
        position: relative;
        z-index: 1;
        background: transparent !important;
      }
    `;
    document.head.appendChild(style);

    // 2. Tạo Canvas WebGL siêu nhẹ
    const canvas = document.createElement('canvas');
    canvas.id = 'vnl-bg-3d';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);

    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: !isMobile,
      alpha: true,
      stencil: false,
      depth: false,
      powerPreference: 'low-power'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.maxPixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 150);
    camera.position.set(0, 0, 32);

    const glowTex = createGlowTexture();

    // 3. Khởi tạo các nút mạng tinh thể trong không gian 3D
    const nodeCount = CONFIG.nodeCount;
    const nodes = new Array(nodeCount);
    const nodePos = new Float32Array(nodeCount * 3);

    for (let i = 0; i < nodeCount; i++) {
      const x = (Math.random() - 0.5) * 54;
      const y = (Math.random() - 0.5) * 32;
      const z = (Math.random() - 0.5) * 20;
      nodePos[i * 3] = x;
      nodePos[i * 3 + 1] = y;
      nodePos[i * 3 + 2] = z;
      nodes[i] = {
        x: x,
        y: y,
        z: z,
        vx: (Math.random() - 0.5) * 0.04,
        vy: (Math.random() - 0.5) * 0.04,
        vz: (Math.random() - 0.5) * 0.025,
        ox: 0, // Độ lệch do lực đẩy chuột
        oy: 0
      };
    }

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(nodePos, 3));
    const pMat = new THREE.PointsMaterial({
      size: isMobile ? 0.88 : 1.0,
      map: glowTex,
      color: CONFIG.primaryHex,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    scene.add(new THREE.Points(pGeo, pMat));

    // 4. Lưới dây nối giữa các hạt với nhau (Màu Tím Nitro)
    const maxLines = nodeCount * 6;
    const linePositions = new Float32Array(maxLines * 6);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: CONFIG.secondaryHex,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending
    });
    scene.add(new THREE.LineSegments(lineGeo, lineMat));

    // 5. Theo dõi tọa độ chuột chuyển đổi sang không gian 3D thực tế
    let normX = 0, normY = 0;
    let smoothNormX = 0, smoothNormY = 0;
    let mouse3DX = 999, mouse3DY = 999;
    let targetMouse3DX = 999, targetMouse3DY = 999;
    let hasMouseMoved = false;
    let clickPulse = 0;
    let scrollY = 0;
    let isTabVisible = !document.hidden;

    const rayPlaneZ = 2; // Mặt phẳng 3D nơi con trỏ tạo lực đẩy/xoáy với các hạt

    function updatePointer(cx, cy) {
      hasMouseMoved = true;
      normX = (cx / window.innerWidth - 0.5) * 2;
      normY = -(cy / window.innerHeight - 0.5) * 2;

      // Quy đổi tọa độ màn hình sang tọa độ thế giới 3D tại mặt phẳng z = rayPlaneZ
      const fovRad = (camera.fov * Math.PI) / 180;
      const distZ = camera.position.z - rayPlaneZ;
      const halfH = Math.tan(fovRad / 2) * distZ;
      const halfW = halfH * camera.aspect;

      targetMouse3DX = normX * halfW + camera.position.x * 0.85;
      targetMouse3DY = normY * halfH + camera.position.y * 0.85;
    }

    window.addEventListener('pointermove', (e) => {
      updatePointer(e.clientX, e.clientY);
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches.length > 0) {
        updatePointer(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      clickPulse = 1.0;
    }, { passive: true });

    window.addEventListener('scroll', () => {
      scrollY = window.scrollY || 0;
    }, { passive: true });

    document.addEventListener('visibilitychange', () => {
      isTabVisible = !document.hidden;
    });

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
      }, 120);
    }, { passive: true });

    // 7. Vòng lặp 60FPS siêu nhẹ
    const maxDistSq = CONFIG.linkDist * CONFIG.linkDist;
    const pArr = pGeo.attributes.position.array;
    const lArr = lineGeo.attributes.position.array;
    let time = 0;

    function tick() {
      requestAnimationFrame(tick);
      if (!isTabVisible) return;

      time += 0.02;
      smoothNormX += (normX - smoothNormX) * 0.06;
      smoothNormY += (normY - smoothNormY) * 0.06;

      // Nghiêng góc nhìn 3D (Camera Parallax) theo chuột & cuộn trang
      const px = smoothNormX * 4.2 * CONFIG.parallax;
      const py = smoothNormY * 2.6 * CONFIG.parallax - scrollY * 0.005;
      camera.position.x += (px - camera.position.x) * 0.08;
      camera.position.y += (py - camera.position.y) * 0.08;
      camera.lookAt(0, -scrollY * 0.0025, 0);

      // Cập nhật tâm điểm lực đẩy từ trường chuột trong không gian 3D
      if (hasMouseMoved) {
        if (mouse3DX > 500) {
          mouse3DX = targetMouse3DX;
          mouse3DY = targetMouse3DY;
        } else {
          mouse3DX += (targetMouse3DX - mouse3DX) * 0.18;
          mouse3DY += (targetMouse3DY - mouse3DY) * 0.18;
        }
      }

      if (clickPulse > 0.01) {
        clickPulse *= 0.88;
      } else {
        clickPulse = 0;
      }

      const activeRepelRadius = CONFIG.mouseRepelDist + clickPulse * 9.0;
      const repelDistSq = activeRepelRadius * activeRepelRadius;

      let lineIdx = 0;

      for (let i = 0; i < nodeCount; i++) {
        const n = nodes[i];
        n.x += n.vx * CONFIG.speed;
        n.y += n.vy * CONFIG.speed;
        n.z += n.vz * CONFIG.speed;

        if (n.x > 27 || n.x < -27) n.vx = -n.vx;
        if (n.y > 16 || n.y < -16) n.vy = -n.vy;
        if (n.z > 11 || n.z < -11) n.vz = -n.vz;

        // Tương tác lực từ trường (đẩy & xoáy) khi di chuột qua các hạt
        if (hasMouseMoved) {
          const mdx = (n.x + n.ox) - mouse3DX;
          const mdy = (n.y + n.oy) - mouse3DY;
          const mDistSq = mdx * mdx + mdy * mdy;

          // Đẩy & xoáy nhẹ các hạt khi di chuột hoặc click gần đó
          if (mDistSq < repelDistSq && mDistSq > 0.001) {
            const mDist = Math.sqrt(mDistSq);
            const factor = (1 - mDist / activeRepelRadius) * (CONFIG.mouseForce + clickPulse * 0.35);
            // Kết hợp lực đẩy hướng tâm + lực xoáy tiếp tuyến nhẹ
            n.ox += (mdx / mDist) * factor * 2.4 - (mdy / mDist) * factor * 0.65;
            n.oy += (mdy / mDist) * factor * 2.4 + (mdx / mDist) * factor * 0.65;
          }
        }

        // Lực đàn hồi kéo hạt êm ái về quỹ đạo gốc
        n.ox *= 0.91;
        n.oy *= 0.91;

        const curX = n.x + n.ox;
        const curY = n.y + n.oy;
        const curZ = n.z;

        const i3 = i * 3;
        pArr[i3] = curX;
        pArr[i3 + 1] = curY;
        pArr[i3 + 2] = curZ;

        // Nối dây giữa các hạt tinh thể với nhau
        for (let j = i + 1; j < nodeCount; j++) {
          const m = nodes[j];
          const mx = m.x + m.ox;
          const my = m.y + m.oy;
          const dx = curX - mx;
          const dy = curY - my;
          const dz = curZ - m.z;
          const distSq = dx * dx + dy * dy + dz * dz;
          if (distSq < maxDistSq && lineIdx < maxLines) {
            const l6 = lineIdx * 6;
            lArr[l6] = curX;
            lArr[l6 + 1] = curY;
            lArr[l6 + 2] = curZ;
            lArr[l6 + 3] = mx;
            lArr[l6 + 4] = my;
            lArr[l6 + 5] = m.z;
            lineIdx++;
          }
        }
      }

      lineGeo.setDrawRange(0, lineIdx * 2);
      pGeo.attributes.position.needsUpdate = true;
      lineGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    }

    tick();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVnl3DBackground);
  } else {
    initVnl3DBackground();
  }
})();

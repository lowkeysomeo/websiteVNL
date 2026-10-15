/**
 * VietNam Legacy - Ultra-Light 3D WebGL Background & Unified 3D Cursor Engine (bg3d.js)
 * Dung lượng: ~7 KB | Không tải thêm thư viện (dùng chung three.min.js sẵn có của shop)
 * Chế độ: MẠNG TINH THỂ TƯƠNG TÁC CHUỘT (INTERACTIVE NEURAL PLEXUS) | Bảng màu: Đỏ Di Sản (#140b0d)
 *
 * HIỆU ỨNG DI CHUỘT 3D TÍCH HỢP ĐỒNG BỘ:
 * 1. Hạt Tâm Năng Lượng 3D (Cursor Beacon): Lõi năng lượng vàng–đỏ rực rỡ bám chuẩn tọa độ chuột
 * 2. Vòng Hào Quang 3D (Rotating Gold Aura Ring): Xoay liên tục theo nhịp thời gian, phóng to khi hover nút/sản phẩm
 * 3. Tia Liên Kết Từ Trường 3D: Tự động phóng tia sáng từ con trỏ chuột tới các hạt tinh thể xung quanh
 * 4. Lực Đẩy & Xoáy Từ Trường 3D: Lướt chuột tới đâu các hạt dạt ra và xoáy nhẹ tới đó
 * 5. Sóng Xung Kích Khi Click: Nhấp chuột tạo xung năng lượng đẩy bật các hạt tinh thể xung quanh và kích hoạt shockwave ring
 * 6. Nghiêng Góc Nhìn 3D (Camera Parallax) mượt mà theo hướng di chuột & cuộn trang
 * 7. Tự động trả về con trỏ mặc định trên ô nhập liệu (input, textarea), dialog và modal để không gây cản trở
 */
(function () {
  'use strict';

  const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia && window.matchMedia('(any-hover: hover) and (any-pointer: fine)');

  const CONFIG = {
    bgHex: '#140b0d',
    primaryHex: 0xff2d55,     // Đỏ Ruby VietNam Legacy
    secondaryHex: 0xa855f7,   // Tím Discord Nitro
    cursorHex: 0xffb703,      // Vàng Gold cho tia năng lượng chuột & Vòng hào quang
    speed: prefersReduced ? 0.08 : 0.22,
    parallax: prefersReduced ? 0 : (isMobile ? 0.45 : 1.15),
    nodeCount: isMobile ? 50 : 92,
    linkDist: isMobile ? 8.5 : 9.4,
    mouseLinkDist: 13.5,      // Bán kính bắt tia sét từ chuột tới các hạt
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
    grad.addColorStop(0.4, 'rgba(255,180,215,0.8)');
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
        background-color: ${CONFIG.bgHex} !important;
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

    // 3. Khởi tạo các nút mạng tinh thể + 1 hạt tâm năng lượng chuột (nút cuối cùng)
    const nodeCount = CONFIG.nodeCount;
    const totalPoints = nodeCount + 1; // +1 cho hạt năng lượng tại đầu con trỏ chuột
    const nodes = new Array(nodeCount);
    const nodePos = new Float32Array(totalPoints * 3);

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

    // Đặt hạt con trỏ ban đầu ở ngoài màn hình cho tới khi người dùng di chuột
    nodePos[nodeCount * 3] = 999;
    nodePos[nodeCount * 3 + 1] = 999;
    nodePos[nodeCount * 3 + 2] = 0;

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

    // 4. Lưới dây nối giữa các hạt (Màu Tím Nitro)
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

    // 5. Lưới tia năng lượng nối trực tiếp từ Chuột tới các hạt gần chuột (Màu Đỏ/Vàng Sáng)
    const maxMouseLines = 28;
    const mouseLinePositions = new Float32Array(maxMouseLines * 6);
    const mouseLineGeo = new THREE.BufferGeometry();
    mouseLineGeo.setAttribute('position', new THREE.BufferAttribute(mouseLinePositions, 3));
    const mouseLineMat = new THREE.LineBasicMaterial({
      color: CONFIG.primaryHex,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending
    });
    scene.add(new THREE.LineSegments(mouseLineGeo, mouseLineMat));

    // 6. Vòng Hào Quang 3D đi theo con trỏ chuột trong không gian 3D
    const cursorRingGeo = new THREE.RingGeometry(0.32, 0.44, 24);
    const cursorRingMat = new THREE.MeshBasicMaterial({
      color: CONFIG.cursorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending
    });
    const cursorRing = new THREE.Mesh(cursorRingGeo, cursorRingMat);
    cursorRing.position.set(999, 999, 2);
    scene.add(cursorRing);

    // 7. Đồng bộ hệ thống con trỏ chuột 3D: Hạt tâm năng lượng & Vòng hào quang quay
    let dot = document.querySelector('#cursor-dot');
    let ring = document.querySelector('#cursor-ring');
    if (!dot) {
      dot = document.createElement('div');
      dot.className = 'cursor-dot';
      dot.id = 'cursor-dot';
      dot.setAttribute('aria-hidden', 'true');
      document.body.appendChild(dot);
    }
    if (!ring) {
      ring = document.createElement('div');
      ring.className = 'cursor-ring';
      ring.id = 'cursor-ring';
      ring.setAttribute('aria-hidden', 'true');
      document.body.appendChild(ring);
    }

    const interactiveSelector = 'a[href], button, [role="button"], summary, .product-card, label[style*="cursor:pointer"], input[type="button"], input[type="submit"]';
    const nativeControls = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), iframe';
    const surfaceSelector = '.hero, .product-card, .support-card, .bottom-banner, .benefit-item, .order-card, .catalog-controls';

    let clientX = -999, clientY = -999;
    let ringCurX = -999, ringCurY = -999;
    let isCursorVisible = false;
    let activeSurface = null;
    let clickReleaseTimer = null;

    function isBlocked() {
      return !finePointer.matches || document.hidden || document.body.classList.contains('modal-open') || Boolean(document.querySelector('dialog[open]'));
    }

    function clearActiveSurface() {
      if (activeSurface) {
        activeSurface.style.removeProperty('--mouse-x');
        activeSurface.style.removeProperty('--mouse-y');
        activeSurface.classList.remove('cursor-lit');
        activeSurface = null;
      }
    }

    function hideCustomCursor() {
      if (!isCursorVisible) return;
      isCursorVisible = false;
      document.body.classList.remove('has-custom-cursor');
      if (dot) dot.classList.remove('active', 'hover', 'clicking');
      if (ring) ring.classList.remove('active', 'hover', 'clicking');
      clearActiveSurface();
    }

    // 8. Theo dõi tọa độ chuột chuyển đổi sang không gian 3D thực tế
    let normX = 0, normY = 0;
    let smoothNormX = 0, smoothNormY = 0;
    let mouse3DX = 999, mouse3DY = 999;
    let targetMouse3DX = 999, targetMouse3DY = 999;
    let hasMouseMoved = false;
    let clickPulse = 0;
    let scrollY = 0;
    let isTabVisible = !document.hidden;

    const rayPlaneZ = 2; // Mặt phẳng 3D nơi con trỏ tương tác với hạt

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
      // Cập nhật tọa độ 3D
      updatePointer(e.clientX, e.clientY);

      // Kiểm tra con trỏ chuột desktop
      if (e.pointerType !== 'mouse' || isBlocked()) {
        hideCustomCursor();
        return;
      }

      const targetEl = e.target instanceof Element ? e.target : null;
      if (!targetEl || targetEl.closest(nativeControls) || targetEl.closest(':disabled, [aria-disabled="true"]')) {
        hideCustomCursor();
        return;
      }

      clientX = e.clientX;
      clientY = e.clientY;

      if (!isCursorVisible) {
        isCursorVisible = true;
        ringCurX = clientX;
        ringCurY = clientY;
        document.body.classList.add('has-custom-cursor');
        if (dot) dot.classList.add('active');
        if (ring) ring.classList.add('active');
      }

      // Hạt tâm năng lượng bám chuẩn vị trí trỏ chuột tức thì (zero delay)
      if (dot) {
        dot.style.transform = `translate3d(${clientX}px, ${clientY}px, 0) translate(-50%, -50%)`;
      }

      // Nhận diện trạng thái hover trên nút bấm, liên kết, thẻ sản phẩm
      const isHover = Boolean(targetEl.closest(interactiveSelector));
      if (ring) ring.classList.toggle('hover', isHover);
      if (dot) dot.classList.toggle('hover', isHover);

      // Đồng bộ luồng ánh sáng viền hào quang thẻ sản phẩm
      const surface = targetEl.closest(surfaceSelector);
      if (surface !== activeSurface) {
        clearActiveSurface();
        activeSurface = surface;
        if (activeSurface) activeSurface.classList.add('cursor-lit');
      }
      if (activeSurface && activeSurface.isConnected) {
        const rect = activeSurface.getBoundingClientRect();
        activeSurface.style.setProperty('--mouse-x', `${clientX - rect.left}px`);
        activeSurface.style.setProperty('--mouse-y', `${clientY - rect.top}px`);
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches.length > 0) {
        updatePointer(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    // Click chuột tạo sóng xung kích 3D đẩy các hạt bung ra & kích hoạt hiệu ứng shockwave trên vòng hào quang
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      clickPulse = 1.0;
      if (isCursorVisible) {
        clearTimeout(clickReleaseTimer);
        if (ring) ring.classList.add('clicking');
        if (dot) dot.classList.add('clicking');
      }
    }, { passive: true });

    window.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      clearTimeout(clickReleaseTimer);
      clickReleaseTimer = setTimeout(() => {
        if (ring) ring.classList.remove('clicking');
        if (dot) dot.classList.remove('clicking');
      }, 140);
    }, { passive: true });

    window.addEventListener('pointerleave', hideCustomCursor, { passive: true });
    window.addEventListener('pointercancel', hideCustomCursor, { passive: true });
    window.addEventListener('blur', hideCustomCursor);
    window.addEventListener('pagehide', hideCustomCursor);

    window.addEventListener('scroll', () => {
      scrollY = window.scrollY || 0;
      if (isCursorVisible && activeSurface && activeSurface.isConnected) {
        const rect = activeSurface.getBoundingClientRect();
        activeSurface.style.setProperty('--mouse-x', `${clientX - rect.left}px`);
        activeSurface.style.setProperty('--mouse-y', `${clientY - rect.top}px`);
      }
    }, { passive: true });

    document.addEventListener('visibilitychange', () => {
      isTabVisible = !document.hidden;
      if (document.hidden) hideCustomCursor();
    });

    const dialogObserver = new MutationObserver(() => {
      if (isBlocked()) hideCustomCursor();
    });
    dialogObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    document.querySelectorAll('dialog').forEach(d => {
      dialogObserver.observe(d, { attributes: true, attributeFilter: ['open'] });
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

    // 9. Vòng lặp 60FPS siêu nhẹ
    const maxDistSq = CONFIG.linkDist * CONFIG.linkDist;
    const mouseLinkDistSq = CONFIG.mouseLinkDist * CONFIG.mouseLinkDist;
    const pArr = pGeo.attributes.position.array;
    const lArr = lineGeo.attributes.position.array;
    const mArr = mouseLineGeo.attributes.position.array;
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

      // Cập nhật Vòng Hào Quang 3D của con trỏ trên lớp DOM (xoay nhịp nhàng và lướt mượt mà)
      if (isCursorVisible && ring) {
        if (prefersReduced) {
          ringCurX = clientX;
          ringCurY = clientY;
          ring.style.transform = `translate3d(${ringCurX}px, ${ringCurY}px, 0) translate(-50%, -50%)`;
        } else {
          ringCurX += (clientX - ringCurX) * 0.28;
          ringCurY += (clientY - ringCurY) * 0.28;
          const ringRotation = (time * 95) % 360;
          ring.style.transform = `translate3d(${ringCurX}px, ${ringCurY}px, 0) translate(-50%, -50%) rotate(${ringRotation}deg)`;
        }
      }

      // Nội suy mượt vị trí con trỏ trong không gian 3D
      if (hasMouseMoved) {
        if (mouse3DX > 500) {
          mouse3DX = targetMouse3DX;
          mouse3DY = targetMouse3DY;
        } else {
          mouse3DX += (targetMouse3DX - mouse3DX) * 0.18;
          mouse3DY += (targetMouse3DY - mouse3DY) * 0.18;
        }
        const cIdx = nodeCount * 3;
        pArr[cIdx] = mouse3DX;
        pArr[cIdx + 1] = mouse3DY;
        pArr[cIdx + 2] = rayPlaneZ;

        cursorRing.position.set(mouse3DX, mouse3DY, rayPlaneZ);
        cursorRing.rotation.z = time * 1.5;
        const ringScale = 1 + Math.sin(time * 3) * 0.12 + clickPulse * 0.8;
        cursorRing.scale.setScalar(ringScale);
      }

      if (clickPulse > 0.01) {
        clickPulse *= 0.88;
      } else {
        clickPulse = 0;
      }

      const activeRepelRadius = CONFIG.mouseRepelDist + clickPulse * 9.0;
      const repelDistSq = activeRepelRadius * activeRepelRadius;

      let lineIdx = 0;
      let mouseLineIdx = 0;

      for (let i = 0; i < nodeCount; i++) {
        const n = nodes[i];
        n.x += n.vx * CONFIG.speed;
        n.y += n.vy * CONFIG.speed;
        n.z += n.vz * CONFIG.speed;

        if (n.x > 27 || n.x < -27) n.vx = -n.vx;
        if (n.y > 16 || n.y < -16) n.vy = -n.vy;
        if (n.z > 11 || n.z < -11) n.vz = -n.vz;

        // Tương tác lực từ trường & tia nối với con trỏ chuột
        if (hasMouseMoved) {
          const mdx = (n.x + n.ox) - mouse3DX;
          const mdy = (n.y + n.oy) - mouse3DY;
          const mDistSq = mdx * mdx + mdy * mdy;

          // Phóng tia liên kết từ chuột tới các hạt nằm trong vùng cảm ứng
          if (mDistSq < mouseLinkDistSq && mouseLineIdx < maxMouseLines) {
            const ml6 = mouseLineIdx * 6;
            mArr[ml6] = mouse3DX;
            mArr[ml6 + 1] = mouse3DY;
            mArr[ml6 + 2] = rayPlaneZ;
            mArr[ml6 + 3] = n.x + n.ox;
            mArr[ml6 + 4] = n.y + n.oy;
            mArr[ml6 + 5] = n.z;
            mouseLineIdx++;
          }

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
      mouseLineGeo.setDrawRange(0, mouseLineIdx * 2);
      pGeo.attributes.position.needsUpdate = true;
      lineGeo.attributes.position.needsUpdate = true;
      mouseLineGeo.attributes.position.needsUpdate = true;

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

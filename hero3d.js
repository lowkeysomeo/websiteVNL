/* Chữ 3D VietNam Legacy: dựng cảnh, tương tác chuột và điều chỉnh theo màn hình. */

(function () {
  'use strict';

  function initHero3D() {
    const card = document.getElementById('hero-3d-card');
    const canvas = document.getElementById('hero-3d-canvas');

    if (!card || !canvas) return;

    // Check prerequisites
    if (typeof THREE === 'undefined' || !window.VNL_FONT_DATA) {
      console.warn('Three.js or font data not available for 3D Hero.');
      showFallback(card);
      return;
    }

    try {
      startScene(card, canvas);
    } catch (err) {
      console.error('Failed to initialize 3D Hero scene:', err);
      showFallback(card);
    }
  }

  function showFallback(card) {
    if (!card) return;
    card.classList.add('is-fallback');
    const fallbackImg = document.createElement('img');
    fallbackImg.className = 'hero-brand-banner fallback-banner';
    fallbackImg.src = 'assets/vnl-banner.png';
    fallbackImg.alt = 'Banner VietNam Legacy';
    fallbackImg.loading = 'lazy';
    card.innerHTML = '';
    card.appendChild(fallbackImg);
  }

  function createStudioEnvMap() {
    // Generate a high-contrast procedural studio lighting reflection texture
    const w = 512;
    const h = 256;
    const cvs = document.createElement('canvas');
    cvs.width = w;
    cvs.height = h;
    const ctx = cvs.getContext('2d');
    if (!ctx) return null;

    // Background luxury obsidian gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#141414');
    bgGrad.addColorStop(0.5, '#242424');
    bgGrad.addColorStop(1, '#090909');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Warm golden softbox light (top-left)
    const g1 = ctx.createRadialGradient(140, 70, 0, 140, 70, 130);
    g1.addColorStop(0, 'rgba(255, 245, 215, 0.95)');
    g1.addColorStop(0.35, 'rgba(255, 215, 120, 0.7)');
    g1.addColorStop(0.7, 'rgba(220, 140, 50, 0.25)');
    g1.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g1;
    ctx.beginPath();
    ctx.arc(140, 70, 130, 0, Math.PI * 2);
    ctx.fill();

    // Ruby crimson accent softbox (bottom-right)
    const g2 = ctx.createRadialGradient(370, 185, 0, 370, 185, 120);
    g2.addColorStop(0, 'rgba(200, 200, 200, 0.9)');
    g2.addColorStop(0.4, 'rgba(160, 160, 160, 0.6)');
    g2.addColorStop(0.75, 'rgba(90, 90, 90, 0.2)');
    g2.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(370, 185, 120, 0, Math.PI * 2);
    ctx.fill();

    // Overhead high-specular rim highlight strip
    const rimGrad = ctx.createLinearGradient(0, 0, 0, 45);
    rimGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    rimGrad.addColorStop(0.6, 'rgba(255, 220, 170, 0.45)');
    rimGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rimGrad;
    ctx.fillRect(0, 0, w, 45);

    // Subtle golden horizon reflection line
    const horizGrad = ctx.createLinearGradient(0, h * 0.46, 0, h * 0.54);
    horizGrad.addColorStop(0, 'rgba(255, 209, 92, 0)');
    horizGrad.addColorStop(0.5, 'rgba(255, 209, 92, 0.4)');
    horizGrad.addColorStop(1, 'rgba(255, 209, 92, 0)');
    ctx.fillStyle = horizGrad;
    ctx.fillRect(0, h * 0.46, w, h * 0.08);

    const texture = new THREE.CanvasTexture(cvs);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    return texture;
  }

  function createStarShape(outerR, innerR, points) {
    const shape = new THREE.Shape();
    const step = Math.PI / points;
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = i * step - Math.PI / 2;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    return shape;
  }

  function createWordGroup(word, font, textOptions, material, tracking = 3.2) {
    const group = new THREE.Group();
    let currentX = 0;
    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      if (char === ' ') {
        currentX += textOptions.size * 0.5;
        continue;
      }
      const geom = new THREE.TextGeometry(char, textOptions);
      geom.computeBoundingBox();
      geom.computeVertexNormals();
      const w = geom.boundingBox.max.x - geom.boundingBox.min.x;
      const mesh = new THREE.Mesh(geom, material);
      mesh.position.x = currentX - geom.boundingBox.min.x;
      group.add(mesh);
      currentX += w + tracking;
    }
    const totalW = currentX - tracking;
    group.children.forEach(function (m) {
      m.position.x -= totalW / 2;
    });
    return { group: group, width: totalW };
  }

  function startScene(card, canvas) {
    const lightDevice = window.matchMedia('(pointer: coarse)').matches ||
      (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4) ||
      (navigator.deviceMemory > 0 && navigator.deviceMemory <= 4);
    // Giảm số điểm ảnh trên thiết bị yếu, vẫn giữ nguyên bố cục và tương tác.
    // Scene & Camera
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x141414, 0.003);

    const camera = new THREE.PerspectiveCamera(38, 1, 1, 1000);
    camera.position.set(0, 0, 140);

    // Renderer with full transparency for seamless integration
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'default'
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lightDevice ? 1.5 : 2));
    if (renderer.outputEncoding !== undefined) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }
    if (renderer.toneMapping !== undefined) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
    }

    // Procedural Studio Environment Reflection
    const studioEnv = createStudioEnvMap();
    if (studioEnv) {
      scene.environment = studioEnv;
    }

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffeedd, 0.9);
    scene.add(ambientLight);

    const dirKeyLight = new THREE.DirectionalLight(0xfff7e6, 1.5);
    dirKeyLight.position.set(45, 60, 80);
    scene.add(dirKeyLight);

    const dirCrimsonLight = new THREE.DirectionalLight(0xb0b0b0, 1.2);
    dirCrimsonLight.position.set(-50, -35, 50);
    scene.add(dirCrimsonLight);

    const dirRimLight = new THREE.DirectionalLight(0xffd15c, 0.85);
    dirRimLight.position.set(0, 45, -50);
    scene.add(dirRimLight);

    // Interactive cursor point light (makes specular reflections roll across letters)
    const cursorLight = new THREE.PointLight(0xffd15c, 2.6, 300);
    cursorLight.position.set(0, 0, 65);
    scene.add(cursorLight);

    // 3D Sculpture Group
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Font parsing
    const loader = new THREE.FontLoader();
    const font = loader.parse(window.VNL_FONT_DATA);

    // Professional, razor-sharp beveled parameters
    const textConfig = {
      font: font,
      curveSegments: 14,
      bevelEnabled: true,
      bevelThickness: 1.2,
      bevelSize: 0.6,
      bevelOffset: 0,
      bevelSegments: 5
    };

    // Material 1: Royal 24K Gold ("VIETNAM")
    const goldMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xffd15c),
      emissive: new THREE.Color(0x381b03),
      emissiveIntensity: 0.22,
      metalness: 0.88,
      roughness: 0.14,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      reflectivity: 1.0
    });

    // Material 2: Luxury Ruby Crimson ("LEGACY")
    const rubyMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xb0b0b0),
      emissive: new THREE.Color(0x161616),
      emissiveIntensity: 0.26,
      metalness: 0.86,
      roughness: 0.16,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      reflectivity: 1.0
    });

    // Word 1: "VIETNAM" with elegant tracking
    const word1 = createWordGroup(
      'VIETNAM',
      font,
      { ...textConfig, size: 14.5, height: 5.5 },
      goldMaterial,
      3.0
    );
    word1.group.position.set(0, 10.5, 0);
    rootGroup.add(word1.group);

    // Word 2: "LEGACY" with elegant tracking
    const word2 = createWordGroup(
      'LEGACY',
      font,
      { ...textConfig, size: 13.8, height: 5.5 },
      rubyMaterial,
      3.6
    );
    word2.group.position.set(0, -9.5, 0);
    rootGroup.add(word2.group);

    // Geometry 3: Bold Puffy Golden Star emblem (floating at the top)
    const starShape = createStarShape(8.5, 3.6, 5);
    const starGeom = new THREE.ExtrudeGeometry(starShape, {
      depth: 3.2,
      bevelEnabled: true,
      bevelThickness: 1.6,
      bevelSize: 0.9,
      bevelSegments: 5,
      curveSegments: 12
    });
    starGeom.center();
    starGeom.computeVertexNormals();

    const starMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xffea79),
      emissive: new THREE.Color(0x4d2a05),
      emissiveIntensity: 0.35,
      metalness: 0.92,
      roughness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06
    });

    const starMesh = new THREE.Mesh(starGeom, starMaterial);
    starMesh.position.set(0, 28.5, 1.5);
    rootGroup.add(starMesh);

    // Floating Stardust Particles (luxury atmosphere)
    const particleCount = lightDevice ? 24 : 45;
    const particleGeom = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleScales = new Float32Array(particleCount);
    const particleOriginals = [];

    for (let i = 0; i < particleCount; i++) {
      const px = (Math.random() - 0.5) * 170;
      const py = (Math.random() - 0.5) * 110;
      const pz = (Math.random() - 0.5) * 80;
      particlePositions[i * 3] = px;
      particlePositions[i * 3 + 1] = py;
      particlePositions[i * 3 + 2] = pz;
      particleScales[i] = Math.random() * 0.8 + 0.4;
      particleOriginals.push({
        x: px,
        y: py,
        z: pz,
        speed: Math.random() * 0.6 + 0.3,
        phase: Math.random() * Math.PI * 2
      });
    }

    particleGeom.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    // Particle Canvas Texture (sparkling diamond/star)
    const pCvs = document.createElement('canvas');
    pCvs.width = 32;
    pCvs.height = 32;
    const pCtx = pCvs.getContext('2d');
    if (pCtx) {
      const radGrad = pCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
      radGrad.addColorStop(0, 'rgba(255, 235, 170, 1)');
      radGrad.addColorStop(0.35, 'rgba(255, 209, 92, 0.85)');
      radGrad.addColorStop(0.7, 'rgba(160, 160, 160, 0.3)');
      radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      pCtx.fillStyle = radGrad;
      pCtx.fillRect(0, 0, 32, 32);
    }
    const particleTexture = new THREE.CanvasTexture(pCvs);

    const particleMaterial = new THREE.PointsMaterial({
      size: 4.5,
      map: particleTexture,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const particles = new THREE.Points(particleGeom, particleMaterial);
    scene.add(particles);

    // State Variables for Physics & Interaction
    let mouseNormX = 0;
    let mouseNormY = 0;
    let isInteracting = false;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragRotX = 0;
    let dragRotY = 0;
    let targetRotX = 0;
    let targetRotY = 0;
    let currentRotX = 0;
    let currentRotY = 0;
    let currentRotZ = 0;

    // Jelly / Goop squash-and-stretch spring physics
    let scaleX = 1;
    let scaleY = 1;
    let scaleZ = 1;
    let velScaleX = 0;
    let velScaleY = 0;
    let velScaleZ = 0;

    function triggerJellyPulse(strength) {
      const s = strength || 1.0;
      velScaleX = 0.18 * s;
      velScaleY = -0.24 * s;
      velScaleZ = 0.15 * s;
    }

    // Dynamic Sizing & Camera Framing
    function updateDimensions() {
      const rect = card.getBoundingClientRect();
      const width = Math.max(rect.width, 260);
      const height = Math.max(rect.height, 180);

      camera.aspect = width / height;

      // Adjust camera distance so text fits perfectly on all screen sizes (mobile -> 4K)
      const refAspect = 1.55;
      if (camera.aspect < refAspect) {
        // Narrower screens (phones): pull camera back proportionally
        const zoomFactor = refAspect / camera.aspect;
        camera.position.z = 140 * Math.min(zoomFactor, 1.6);
      } else {
        camera.position.z = 140;
      }

      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    }

    // ResizeObserver for zero-lag container responsiveness
    let resizeObserver = null;
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(function () {
        updateDimensions();
      });
      resizeObserver.observe(card);
    } else {
      window.addEventListener('resize', updateDimensions);
    }
    updateDimensions();

    // Interaction Handlers (seamless with custom cursor)
    function handlePointerMove(e) {
      const rect = card.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      if (px >= 0 && px <= rect.width && py >= 0 && py <= rect.height) {
        mouseNormX = (px / rect.width) * 2 - 1;
        mouseNormY = -(py / rect.height * 2 - 1);
        isInteracting = true;
      } else if (!isDragging) {
        // Outside bounds: relax gently
        mouseNormX *= 0.95;
        mouseNormY *= 0.95;
        isInteracting = false;
      }

      if (isDragging) {
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        dragRotY += deltaX * 0.012;
        dragRotX += deltaY * 0.01;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
      }
    }

    function handlePointerDown(e) {
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      triggerJellyPulse(0.6);
    }

    function handlePointerUp() {
      if (isDragging) {
        isDragging = false;
        triggerJellyPulse(0.4);
      }
    }

    card.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointermove', function (e) {
      if (isDragging && !card.contains(e.target)) handlePointerMove(e);
    });
    card.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    // Double tap / click for big bouncy squash-and-stretch
    card.addEventListener('dblclick', function () {
      triggerJellyPulse(1.3);
    });

    // Mobile Device Orientation (Gyroscope holographic parallax)
    if (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission !== 'function') {
      window.addEventListener('deviceorientation', function (e) {
        if (e.gamma !== null && e.beta !== null && !isDragging) {
          const gx = Math.min(Math.max(e.gamma / 35, -1), 1);
          const gy = Math.min(Math.max((e.beta - 40) / 40, -1), 1);
          mouseNormX = mouseNormX * 0.7 + gx * 0.3;
          mouseNormY = mouseNormY * 0.7 - gy * 0.3;
        }
      }, { passive: true });
    }

    // Chỉ dựng hình khi thẻ đang hiện; dừng hẳn RAF khi chuyển tab hoặc cuộn đi.
    const clock = new THREE.Clock();
    let animId = null;
    let inViewport = !window.IntersectionObserver;
    let lastFrame = null;
    let disposed = false;

    function scheduleFrame() {
      if (!disposed && !document.hidden && inViewport && animId === null) {
        animId = requestAnimationFrame(renderFrame);
      }
    }

    function syncAnimation() {
      if (animId !== null) cancelAnimationFrame(animId);
      animId = null;
      lastFrame = null;
      clock.getDelta();
      scheduleFrame();
    }

    document.addEventListener('visibilitychange', syncAnimation);

    const visibilityObserver = window.IntersectionObserver
      ? new IntersectionObserver(entries => {
          inViewport = entries.some(entry => entry.isIntersecting);
          syncAnimation();
        }, { threshold: 0 })
      : null;
    if (visibilityObserver) visibilityObserver.observe(card);

    function renderFrame(time) {
      animId = null;
      if (disposed || document.hidden || !inViewport) return;
      scheduleFrame();
      // Màn hình 120/144 Hz không cần dựng thêm hình cho hiệu ứng trang trí.
      if (lastFrame !== null && time - lastFrame < 1000 / 60 - 0.5) return;
      lastFrame = time;

      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      // Ambient idle floating physics
      const floatY = Math.sin(elapsed * 1.6) * 3.2;
      const floatRotZ = Math.sin(elapsed * 1.1) * 0.035;
      const floatRotY = Math.cos(elapsed * 0.8) * 0.055;

      // Golden Star independent 3D rotation & wobble
      starMesh.rotation.y = elapsed * 0.9;
      starMesh.rotation.z = Math.sin(elapsed * 1.4) * 0.12;

      // Update Cursor Light in 3D
      const lightTargetX = mouseNormX * 60;
      const lightTargetY = mouseNormY * 40;
      cursorLight.position.x += (lightTargetX - cursorLight.position.x) * 0.1;
      cursorLight.position.y += (lightTargetY - cursorLight.position.y) * 0.1;

      // Target orientations
      if (isDragging) {
        targetRotX = dragRotX;
        targetRotY = dragRotY;
      } else {
        // Return drag delta gently to 0
        dragRotX *= 0.94;
        dragRotY *= 0.94;
        targetRotX = -mouseNormY * 0.32 + dragRotX;
        targetRotY = mouseNormX * 0.44 + floatRotY + dragRotY;
      }

      // Smooth inertia interpolation (lerp)
      const lerpSpeed = isDragging ? 0.22 : 0.075;
      currentRotX += (targetRotX - currentRotX) * lerpSpeed;
      currentRotY += (targetRotY - currentRotY) * lerpSpeed;
      currentRotZ += (floatRotZ - currentRotZ) * 0.08;

      rootGroup.rotation.x = currentRotX;
      rootGroup.rotation.y = currentRotY;
      rootGroup.rotation.z = currentRotZ;
      rootGroup.position.y = floatY;

      // Jelly Spring Physics (Womp Goop squash & stretch)
      const stiffness = 0.12;
      const damping = 0.84;

      velScaleX = (velScaleX + (1 - scaleX) * stiffness) * damping;
      velScaleY = (velScaleY + (1 - scaleY) * stiffness) * damping;
      velScaleZ = (velScaleZ + (1 - scaleZ) * stiffness) * damping;

      scaleX += velScaleX;
      scaleY += velScaleY;
      scaleZ += velScaleZ;

      rootGroup.scale.set(scaleX, scaleY, scaleZ);

      // Animate Stardust Particles
      const posAttr = particleGeom.attributes.position;
      const arr = posAttr.array;
      for (let i = 0; i < particleCount; i++) {
        const orig = particleOriginals[i];
        arr[i * 3 + 1] = orig.y + Math.sin(elapsed * orig.speed + orig.phase) * 6;
        arr[i * 3] = orig.x + Math.cos(elapsed * (orig.speed * 0.7) + orig.phase) * 4;
      }
      posAttr.needsUpdate = true;

      // Render Scene
      renderer.render(scene, camera);
    }

    scheduleFrame();

    // Clean up if needed
    window.addEventListener('beforeunload', function () {
      disposed = true;
      if (animId !== null) cancelAnimationFrame(animId);
      if (visibilityObserver) visibilityObserver.disconnect();
      document.removeEventListener('visibilitychange', syncAnimation);

      if (resizeObserver) resizeObserver.disconnect();
    });
  }

  // Self-initialize on DOMContentLoaded or immediate if already ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHero3D);
  } else {
    initHero3D();
  }
})();

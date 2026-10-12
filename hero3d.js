/**
 * VietNam Legacy · 3D Volumetric Typography Engine
 * Inspired by Womp 3D puffy, glossy, metallic typography.
 * Features:
 * - Real-time 3D beveled volumetric letters ("VIETNAM" & "LEGACY")
 * - 3D Golden Star emblem with continuous rotation
 * - Procedural luxury studio reflection environment map
 * - Specular reflection sweep tracking mouse cursor
 * - Interactive 3D tilt, drag-to-rotate, and elastic jelly bounce ("goop" physics)
 * - Drifting ambient 3D stardust / sparkle motes
 * - Fully responsive with dynamic camera framing for mobile, tablet, and desktop
 */

(function () {
  'use strict';

  function initHero3D() {
    const card = document.getElementById('hero-3d-card');
    const canvas = document.getElementById('hero-3d-canvas');
    const hint = document.getElementById('hero-3d-hint');

    if (!card || !canvas) return;

    // Check prerequisites
    if (typeof THREE === 'undefined' || !window.VNL_FONT_DATA) {
      console.warn('Three.js or font data not available for 3D Hero.');
      showFallback(card);
      return;
    }

    try {
      startScene(card, canvas, hint);
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
    bgGrad.addColorStop(0, '#15090b');
    bgGrad.addColorStop(0.5, '#261015');
    bgGrad.addColorStop(1, '#0e0507');
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
    g2.addColorStop(0, 'rgba(255, 110, 130, 0.9)');
    g2.addColorStop(0.4, 'rgba(239, 68, 68, 0.6)');
    g2.addColorStop(0.75, 'rgba(150, 20, 35, 0.2)');
    g2.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(370, 185, 120, 0, Math.PI * 2);
    ctx.fill();

    // Overhead high-specular rim highlight strip
    const rimGrad = ctx.createLinearGradient(0, 0, 0, 45);
    rimGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    rimGrad.addColorStop(0.6, 'rgba(255, 220, 170, 0.4)');
    rimGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rimGrad;
    ctx.fillRect(0, 0, w, 45);

    // Subtle golden horizon reflection line
    const horizGrad = ctx.createLinearGradient(0, h * 0.46, 0, h * 0.54);
    horizGrad.addColorStop(0, 'rgba(255, 209, 92, 0)');
    horizGrad.addColorStop(0.5, 'rgba(255, 209, 92, 0.35)');
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

  function startScene(card, canvas, hint) {
    // Scene & Camera
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x130a0c, 0.0035);

    const camera = new THREE.PerspectiveCamera(40, 1, 1, 1000);
    camera.position.set(0, 0, 135);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if (renderer.outputEncoding !== undefined) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }
    if (renderer.toneMapping !== undefined) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
    }

    // Procedural Studio Environment Reflection
    const studioEnv = createStudioEnvMap();
    if (studioEnv) {
      scene.environment = studioEnv;
    }

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffeedd, 0.85);
    scene.add(ambientLight);

    const dirKeyLight = new THREE.DirectionalLight(0xfff7e6, 1.4);
    dirKeyLight.position.set(45, 60, 80);
    scene.add(dirKeyLight);

    const dirCrimsonLight = new THREE.DirectionalLight(0xff4466, 1.1);
    dirCrimsonLight.position.set(-50, -35, 50);
    scene.add(dirCrimsonLight);

    const dirRimLight = new THREE.DirectionalLight(0xffd15c, 0.75);
    dirRimLight.position.set(0, 45, -50);
    scene.add(dirRimLight);

    // Interactive cursor point light (makes specular reflections roll across letters)
    const cursorLight = new THREE.PointLight(0xffd15c, 2.4, 280);
    cursorLight.position.set(0, 0, 60);
    scene.add(cursorLight);

    // 3D Sculpture Group
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Font parsing
    const loader = new THREE.FontLoader();
    const font = loader.parse(window.VNL_FONT_DATA);

    // Puffy, beveled Womp-style 3D letter parameters
    const textConfig = {
      font: font,
      curveSegments: 14,
      bevelEnabled: true,
      bevelThickness: 3.2,
      bevelSize: 1.8,
      bevelOffset: 0,
      bevelSegments: 7
    };

    // Material 1: Imperial Gold ("VIETNAM")
    const goldMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xffd15c),
      emissive: new THREE.Color(0x2d1704),
      emissiveIntensity: 0.18,
      metalness: 0.88,
      roughness: 0.16,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      reflectivity: 1.0
    });

    // Material 2: Radiant Ruby Crimson ("LEGACY")
    const rubyMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xff5768),
      emissive: new THREE.Color(0x350810),
      emissiveIntensity: 0.22,
      metalness: 0.86,
      roughness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      reflectivity: 1.0
    });

    // Geometry 1: "VIETNAM"
    const geomVietnam = new THREE.TextGeometry('VIETNAM', {
      ...textConfig,
      size: 15.5,
      height: 5.2
    });
    geomVietnam.center();
    geomVietnam.computeVertexNormals();
    const meshVietnam = new THREE.Mesh(geomVietnam, goldMaterial);
    meshVietnam.position.set(0, 10.5, 0);
    rootGroup.add(meshVietnam);

    // Geometry 2: "LEGACY"
    const geomLegacy = new THREE.TextGeometry('LEGACY', {
      ...textConfig,
      size: 14.5,
      height: 5.2
    });
    geomLegacy.center();
    geomLegacy.computeVertexNormals();
    const meshLegacy = new THREE.Mesh(geomLegacy, rubyMaterial);
    meshLegacy.position.set(0, -9.5, 0);
    rootGroup.add(meshLegacy);

    // Geometry 3: Puffy Golden Star emblem (floating at the top)
    const starShape = createStarShape(7.5, 3.2, 5);
    const starGeom = new THREE.ExtrudeGeometry(starShape, {
      depth: 2.8,
      bevelEnabled: true,
      bevelThickness: 2.0,
      bevelSize: 1.3,
      bevelSegments: 5,
      curveSegments: 10
    });
    starGeom.center();
    starGeom.computeVertexNormals();

    const starMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xffe277),
      emissive: new THREE.Color(0x452906),
      emissiveIntensity: 0.35,
      metalness: 0.92,
      roughness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06
    });

    const starMesh = new THREE.Mesh(starGeom, starMaterial);
    starMesh.position.set(0, 27.5, 1.5);
    rootGroup.add(starMesh);

    // Floating Stardust Particles (luxury atmosphere)
    const particleCount = 48;
    const particleGeom = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleScales = new Float32Array(particleCount);
    const particleOriginals = [];

    for (let i = 0; i < particleCount; i++) {
      const px = (Math.random() - 0.5) * 160;
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
      radGrad.addColorStop(0.7, 'rgba(239, 68, 68, 0.3)');
      radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      pCtx.fillStyle = radGrad;
      pCtx.fillRect(0, 0, 32, 32);
    }
    const particleTexture = new THREE.CanvasTexture(pCvs);

    const particleMaterial = new THREE.PointsMaterial({
      size: 4.5,
      map: particleTexture,
      transparent: true,
      opacity: 0.8,
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

    function triggerJellyPulse(strength = 1.0) {
      velScaleX = 0.22 * strength;
      velScaleY = -0.28 * strength;
      velScaleZ = 0.18 * strength;
      if (hint && !hint.classList.contains('hidden')) {
        hint.classList.add('hidden');
      }
    }

    // Dynamic Sizing & Camera Framing
    function updateDimensions() {
      const rect = card.getBoundingClientRect();
      const width = Math.max(rect.width, 260);
      const height = Math.max(rect.height, 180);

      camera.aspect = width / height;

      // Adjust camera distance so text fits perfectly on all screen sizes (mobile -> 4K)
      // Reference aspect ratio is ~1.75 on desktop
      const refAspect = 1.6;
      if (camera.aspect < refAspect) {
        // Narrower screens (phones): pull camera back proportionally
        const zoomFactor = refAspect / camera.aspect;
        camera.position.z = 135 * Math.min(zoomFactor, 1.65);
      } else {
        camera.position.z = 135;
      }

      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    }

    // ResizeObserver for zero-lag container responsiveness
    let resizeObserver = null;
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => updateDimensions());
      resizeObserver.observe(card);
    } else {
      window.addEventListener('resize', updateDimensions);
    }
    updateDimensions();

    // Interaction Handlers
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
      triggerJellyPulse(0.7);
    }

    function handlePointerUp() {
      if (isDragging) {
        isDragging = false;
        triggerJellyPulse(0.5);
      }
    }

    card.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointermove', (e) => {
      if (isDragging) handlePointerMove(e);
    });
    card.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    // Double tap / click for big bouncy squash-and-stretch
    card.addEventListener('dblclick', () => triggerJellyPulse(1.4));

    // Mobile Device Orientation (Gyroscope holographic parallax)
    if (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission !== 'function') {
      window.addEventListener('deviceorientation', (e) => {
        if (e.gamma !== null && e.beta !== null && !isDragging) {
          const gx = Math.min(Math.max(e.gamma / 35, -1), 1);
          const gy = Math.min(Math.max((e.beta - 40) / 40, -1), 1);
          mouseNormX = mouseNormX * 0.7 + gx * 0.3;
          mouseNormY = mouseNormY * 0.7 - gy * 0.3;
        }
      }, { passive: true });
    }

    // Animation Loop
    let clock = new THREE.Clock();
    let animId = null;
    let isVisible = true;

    document.addEventListener('visibilitychange', () => {
      isVisible = !document.hidden;
      if (isVisible) clock.getDelta(); // reset clock delta
    });

    function renderFrame() {
      animId = requestAnimationFrame(renderFrame);
      if (!isVisible) return;

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

    renderFrame();

    // Clean up if needed
    window.addEventListener('beforeunload', () => {
      if (animId) cancelAnimationFrame(animId);
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

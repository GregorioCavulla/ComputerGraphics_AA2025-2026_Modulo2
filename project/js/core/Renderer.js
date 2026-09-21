import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const INTRO_CAMERA = { position: [0, 0.95, 1.85], target: [0, 0.32, 0] };
const BENCHMARK_CAMERA = { position: [0, 42, 82], target: [0, 1, 0] };

export class AppRenderer {
    constructor(container) {
        this.container = container;
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.targetPixelRatio = Math.min(window.devicePixelRatio, 2);
        this.renderer.setPixelRatio(this.targetPixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        // BasicShadowMap, not PCFSoftShadowMap: confirmed by direct A/B test that
        // PCFSoftShadowMap's sampling is broken on this project's target GPU/driver
        // stack (AMD Radeon iGPU via ANGLE/OpenGL ES), producing shadows displaced
        // by tens of units from their casters. BasicShadowMap renders correctly.
        this.renderer.shadowMap.type = THREE.BasicShadowMap;
        this.container.appendChild(this.renderer.domElement);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x071116);
        this.scene.fog = new THREE.FogExp2(0x071116, 0.0085);

        this.camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 650);
        this.camera.position.set(...BENCHMARK_CAMERA.position);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(...BENCHMARK_CAMERA.target);
        this.controls.enableDamping = true;
        this.controls.update();

        this.dynamic = new THREE.Group();
        this.scene.add(this.dynamic);
        this.lastCompileMs = 0;
        this.groundMaterial = null;
        this.environmentTexture = this.createEnvironmentTexture();
        this.activeProfile = null;

        this.createFloor();
        this.createLights();
        this.configureStandardLighting();
        window.addEventListener('resize', () => this.resize());
    }

    createLights() {
        this.ambient = new THREE.AmbientLight(0x6f8fa8, 1.05);
        this.scene.add(this.ambient);
        this.sun = new THREE.DirectionalLight(0xfff1cf, 2.2);
        this.sun.castShadow = true;
        this.sun.shadow.bias = -0.0015;
        this.sun.shadow.normalBias = 0.02;
        this.scene.add(this.sun, this.sun.target);
        // Sun orbit parameters (tuned per profile in configure*()).
        // Formula: sun.position = (sin(t*speed)*radiusX, |cos(t*speed)|*heightRange+heightMin, cos(t*speed)*radiusZ)
        this.sunSpeedFactor = 0.5;
        this.sunRadiusX = 24;
        this.sunRadiusZ = 24;
        this.sunHeightMin = 10;
        this.sunHeightRange = 30;
    }

    createFloor() {
        this.groundMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            map: this.createGridTexture(),
            roughness: 0.97,
            metalness: 0,
        });
        this.ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), this.groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);
    }

    createGridTexture() {
        const cellPx = 128;
        const canvas = document.createElement('canvas');
        canvas.width = cellPx;
        canvas.height = cellPx;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0c1b21';
        ctx.fillRect(0, 0, cellPx, cellPx);
        ctx.strokeStyle = 'rgba(86, 255, 224, 0.65)';
        ctx.lineWidth = 3;
        ctx.strokeRect(1.5, 1.5, cellPx - 3, cellPx - 3);

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        const cellSize = 2;
        const planeSize = 900;
        texture.repeat.set(planeSize / cellSize, planeSize / cellSize);
        texture.anisotropy = 8;
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    }

    configureStandardLighting() {
        if (this.activeProfile === 'standard') return;
        this.activeProfile = 'standard';
        this.setRenderScale(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.shadowMap.enabled = true;
        this.ground.receiveShadow = true;
        this.scene.environment = null;
        this.sun.castShadow = true;
        this.sun.intensity = 2.2;
        this.sun.target.position.set(0, 0, 0);
        this.sun.shadow.mapSize.set(2048, 2048);
        this.sun.shadow.camera.near = 1;
        this.sun.shadow.camera.far = 60;
        this.setShadowFrustum(6);
        this.sunSpeedFactor = 0.5;
        this.sunRadiusX = 24;
        this.sunRadiusZ = 24;
        this.sunHeightMin = 10;
        this.sunHeightRange = 30;
    }

    configureBenchmarkProfile(mode = 'performance') {
        if (mode === 'full') {
            this.configureFullBenchmarkProfile();
        } else {
            this.configureCpuProfile();
        }
    }

    configureCpuProfile() {
        if (this.activeProfile === 'cpu') return;
        this.activeProfile = 'cpu';
        this.setRenderScale(1);
        this.renderer.shadowMap.enabled = false;
        this.ground.receiveShadow = false;
        this.scene.environment = null;
        this.sun.castShadow = false;
        this.sun.intensity = 0.6;
    }

    configureFullBenchmarkProfile() {
        if (this.activeProfile === 'full') return;
        this.activeProfile = 'full';
        this.setRenderScale(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.BasicShadowMap;
        this.ground.receiveShadow = true;
        this.scene.environment = this.environmentTexture;
        this.sun.castShadow = true;
        this.sun.intensity = 3.7;
        this.sun.shadow.mapSize.set(4096, 4096);
        this.sun.shadow.camera.near = 1;
        this.sun.shadow.camera.far = 150;
        this.setShadowFrustum(80);
        this.sun.target.position.set(0, 0, 0);
        // Keep sun nearly at zenith for tall helix formation: radii small,
        // height oscillates 85-100 degrees (vs 10-40 for standard).
        this.sunSpeedFactor = 0.5;
        this.sunRadiusX = 8;
        this.sunRadiusZ = 8;
        this.sunHeightMin = 85;
        this.sunHeightRange = 15;
    }

    configureFinalProfile(full = true) {
        if (!full) {
            this.configureStandardLighting();
            return;
        }
        if (this.activeProfile === 'final-full') return;
        this.activeProfile = 'final-full';
        this.setRenderScale(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.BasicShadowMap;
        this.ground.receiveShadow = true;
        this.scene.environment = this.environmentTexture;
        this.sun.castShadow = true;
        this.sun.intensity = 3.7;
        this.sun.shadow.mapSize.set(4096, 4096);
        this.sun.shadow.camera.near = 1;
        this.sun.shadow.camera.far = 90;
        this.setShadowFrustum(40);
        this.sun.target.position.set(0, 0, 0);
        this.sunSpeedFactor = 0.5;
        this.sunRadiusX = 24;
        this.sunRadiusZ = 24;
        this.sunHeightMin = 10;
        this.sunHeightRange = 30;
    }

    setShadowFrustum(size) {
        const cam = this.sun.shadow.camera;
        cam.left = -size;
        cam.right = size;
        cam.top = size;
        cam.bottom = -size;
        cam.updateProjectionMatrix();
        this.sun.shadow.needsUpdate = true;
    }

    setIntroCamera() {
        this.camera.position.set(...INTRO_CAMERA.position);
        this.controls.target.set(...INTRO_CAMERA.target);
        this.controls.update();
    }

    setBenchmarkCamera() {
        this.camera.position.set(...BENCHMARK_CAMERA.position);
        this.controls.target.set(...BENCHMARK_CAMERA.target);
        this.controls.update();
    }

    updateGpuLight(elapsed) {
        const t = elapsed * this.sunSpeedFactor;
        this.sun.position.set(
            Math.sin(t) * this.sunRadiusX,
            Math.abs(Math.cos(t)) * this.sunHeightRange + this.sunHeightMin,
            Math.cos(t) * this.sunRadiusZ
        );
        this.sun.target.position.set(0, 0, 0);
        this.sun.target.updateMatrixWorld();
        this.sun.shadow.needsUpdate = true;
    }

    updateFog(elapsed, intensity = 1) {
        this.scene.fog.density = 0.0075 + Math.sin(elapsed * 0.22) * 0.0012 + intensity * 0.004;
    }

    clearDynamicContent() {
        while (this.dynamic.children.length) {
            this.dynamic.remove(this.dynamic.children[0]);
        }
    }

    setOrbitEnabled(enabled) {
        this.controls.enabled = enabled;
    }

    compileOnce() {
        const start = performance.now();
        this.renderer.compile(this.scene, this.camera);
        this.lastCompileMs = performance.now() - start;
    }

    update() {
        if (this.controls.enabled) this.controls.update();
    }

    render() {
        // Hard per-frame guarantee, with NO escape hatch of any kind (no flag,
        // no URL param): force BasicShadowMap regardless of what any profile
        // method sets renderer.shadowMap.type to. PCFShadowMap/PCFSoftShadowMap
        // are confirmed broken on this project's target GPU/driver stack (see
        // constructor comment) — this can never be overridden back to them.
        if (this.renderer.shadowMap.type !== THREE.BasicShadowMap) {
            this.renderer.shadowMap.type = THREE.BasicShadowMap;
            this.sun.shadow.map?.dispose();
            this.sun.shadow.map = null;
        }

        // Some GPU/driver stacks (observed: AMD iGPU via ANGLE/OpenGL ES) fail to
        // fully clear the shadow depth render target between frames, so as the
        // sun orbits, past positions leave a permanent smear instead of being
        // overwritten — independent of shadow map filter type. Forcing three.js
        // to allocate a brand-new render target periodically sidesteps a stale
        // buffer that a driver-level clear silently fails to reset.
        this.shadowMapAge = (this.shadowMapAge ?? 0) + 1;
        if (this.shadowMapAge >= 10) {
            this.shadowMapAge = 0;
            this.sun.shadow.map?.dispose();
            this.sun.shadow.map = null;
        }

        this.renderer.render(this.scene, this.camera);
    }

    setRenderScale(pixelRatio) {
        if (this.targetPixelRatio === pixelRatio) return;
        this.targetPixelRatio = pixelRatio;
        this.renderer.setPixelRatio(pixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    createEnvironmentTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const context = canvas.getContext('2d');
        const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#9eefff');
        gradient.addColorStop(0.35, '#18343b');
        gradient.addColorStop(1, '#05090c');
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = 'rgba(255, 240, 106, 0.5)';
        context.fillRect(300, 42, 92, 22);
        context.fillStyle = 'rgba(104, 242, 208, 0.45)';
        context.fillRect(82, 76, 120, 18);
        const texture = new THREE.CanvasTexture(canvas);
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    }

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

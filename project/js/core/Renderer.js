import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class AppRenderer {
    constructor(container) {
        this.container = container;
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.targetPixelRatio = Math.min(window.devicePixelRatio, 2);
        this.renderer.setPixelRatio(this.targetPixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x071116);
        this.scene.fog = new THREE.FogExp2(0x071116, 0.0085);

        this.camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 650);
        this.camera.position.set(0, 42, 82);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(0, 1, 0);
        this.controls.enableDamping = true;
        this.controls.update();

        this.dynamic = new THREE.Group();
        this.scene.add(this.dynamic);
        this.gpuLights = [];
        this.gpuLightingEnabled = false;
        this.lastCompileMs = 0;
        this.baseGroundMaterial = null;
        this.glossyGroundMaterial = null;
        this.environmentTexture = this.createEnvironmentTexture();

        this.createFloor();
        this.configureStandardLighting();
        window.addEventListener('resize', () => this.resize());
    }

    createFloor() {
        this.ground = new THREE.Mesh(
            new THREE.PlaneGeometry(900, 900),
            new THREE.MeshStandardMaterial({ color: 0x0b171d, roughness: 0.95 }),
        );
        this.baseGroundMaterial = this.ground.material;
        this.glossyGroundMaterial = new THREE.MeshStandardMaterial({ color: 0x10262d, roughness: 0.28, metalness: 0.35 });
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);
        this.grid = new THREE.GridHelper(260, 130, 0x56ffe0, 0x17343c);
        this.scene.add(this.grid);
    }

    configureStandardLighting() {
        this.removeGpuLights();
        this.gpuLightingEnabled = false;
        this.setRenderScale(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.shadowMap.enabled = true;
        this.ground.receiveShadow = true;
        this.ground.material = this.baseGroundMaterial;
        this.scene.environment = null;
        if (!this.ambient) {
            this.ambient = new THREE.AmbientLight(0x6f8fa8, 1.05);
            this.scene.add(this.ambient);
        }
        if (!this.sun) {
            this.sun = new THREE.DirectionalLight(0xfff1cf, 2.2);
            this.sun.castShadow = true;
            this.scene.add(this.sun, this.sun.target);
        }
        this.sun.castShadow = true;
        this.sun.position.set(4, 8, 5);
        this.sun.target.position.set(0, 0, 0);
        this.sun.shadow.mapSize.set(1024, 1024);
        this.sun.shadow.camera.left = -80;
        this.sun.shadow.camera.right = 80;
        this.sun.shadow.camera.top = 80;
        this.sun.shadow.camera.bottom = -80;
        this.sun.shadow.camera.near = 1;
        this.sun.shadow.camera.far = 160;
        this.sun.shadow.bias = -0.0015;
        this.sun.shadow.normalBias = 0.02;
        this.sun.shadow.needsUpdate = true;
    }

    configureBenchmarkProfile(mode = 'performance') {
        if (mode === 'full') {
            this.configureFullBenchmarkProfile();
        } else {
            this.configureCpuProfile();
        }
    }

    configureCpuProfile() {
        this.removeGpuLights();
        this.gpuLightingEnabled = false;
        this.setRenderScale(1);
        this.renderer.shadowMap.enabled = false;
        this.ground.receiveShadow = false;
        this.ground.material = this.baseGroundMaterial;
        this.scene.environment = null;
        if (!this.ambient) {
            this.ambient = new THREE.AmbientLight(0x6f8fa8, 1.05);
            this.scene.add(this.ambient);
        }
        if (this.sun) {
            this.sun.castShadow = false;
            this.sun.intensity = 0.6;
        }
    }

    configureFullBenchmarkProfile() {
        this.configureGpuLighting();
        this.setRenderScale(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.ground.receiveShadow = true;
        this.ground.material = this.glossyGroundMaterial;
        this.scene.environment = this.environmentTexture;
        this.sun.intensity = 3.7;
        this.sun.shadow.mapSize.set(4096, 4096);
    }

    configureFinalProfile(full = true) {
        if (full) {
            this.configureFullBenchmarkProfile();
            this.sun.shadow.mapSize.set(2048, 2048);
            for (const light of this.gpuLights) light.shadow.mapSize.set(512, 512);
        } else {
            this.configureStandardLighting();
            this.ground.material = this.baseGroundMaterial;
        }
    }

    configureGpuLighting() {
        if (this.gpuLightingEnabled) return;
        this.configureStandardLighting();
        this.gpuLightingEnabled = true;
        this.setRenderScale(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.ground.receiveShadow = true;
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(4096, 4096);
        this.sun.intensity = 3.4;
        const colors = [0x7dd3ff, 0xff7ac8, 0xffe08a];
        const positions = [[-7, 5, -4], [6, 4, -5], [0, 7, 6]];
        for (let i = 0; i < colors.length; i += 1) {
            const light = new THREE.PointLight(colors[i], 5.5, 22, 1.6);
            light.position.set(...positions[i]);
            light.castShadow = true;
            light.shadow.mapSize.set(1024, 1024);
            this.gpuLights.push(light);
            this.scene.add(light);
        }
    }

    updateGpuLight(elapsed) {
        const radius = 26;
        this.sun.position.set(Math.cos(elapsed * 0.75) * radius, 14, Math.sin(elapsed * 0.75) * radius);
        this.sun.target.position.set(0, 5, 0);
        this.sun.target.updateMatrixWorld();
        this.sun.shadow.needsUpdate = true;
    }

    updateFog(elapsed, intensity = 1) {
        this.scene.fog.density = 0.0075 + Math.sin(elapsed * 0.22) * 0.0012 + intensity * 0.004;
    }

    removeGpuLights() {
        for (const light of this.gpuLights) {
            this.scene.remove(light);
            light.shadow?.map?.dispose();
            light.dispose?.();
        }
        this.gpuLights.length = 0;
        if (this.sun) this.sun.intensity = 2.2;
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
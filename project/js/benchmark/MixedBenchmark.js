import * as THREE from 'three';

const MODEL_KEYS = ['pokeball', 'porygon', 'porygon2', 'porygonz'];

export class MixedBenchmark {
    constructor({ assets, renderer, swarm }) {
        this.assets = assets;
        this.renderer = renderer;
        this.swarm = swarm;
        this.materials = new WeakMap();
    }

    enter(mode, count, options = {}) {
        const visualMode = options.benchmarkMode ?? 'performance';
        this.renderer.configureBenchmarkProfile(visualMode);
        this.renderer.setOrbitEnabled(false);
        this.renderer.camera.position.set(0, 42, 82);
        this.renderer.camera.lookAt(0, 18, 0);
        const templates = MODEL_KEYS.map((key) => ({ key, root: this.assets.getTemplate(key) }));
        const commonOptions = {
            templateKey: `mixed-${mode}-${visualMode}`,
            capacity: options.maxCount,
            materialFactory: visualMode === 'full' ? null : (mesh) => this.createBenchmarkMaterial(mesh.material),
            castShadow: visualMode === 'full',
            receiveShadow: visualMode === 'full',
            radius: 12,
            clearance: 2.25,
            strands: 8,
        };
        if (mode === 'instanced') {
            this.swarm.setMixedInstanced(templates, count, commonOptions);
        } else {
            this.swarm.setMixedNaive(templates, count, commonOptions);
        }
    }

    createBenchmarkMaterial(sourceMaterial) {
        if (this.materials.has(sourceMaterial)) return this.materials.get(sourceMaterial);
        if (Array.isArray(sourceMaterial)) {
            const materials = sourceMaterial.map((material) => this.createBenchmarkMaterial(material));
            this.materials.set(sourceMaterial, materials);
            return materials;
        }
        const material = new THREE.MeshBasicMaterial({
            color: sourceMaterial?.color?.clone?.() ?? new THREE.Color(0xffffff),
            map: sourceMaterial?.map ?? null,
            transparent: sourceMaterial?.transparent ?? false,
            opacity: sourceMaterial?.opacity ?? 1,
        });
        this.materials.set(sourceMaterial, material);
        return material;
    }
}
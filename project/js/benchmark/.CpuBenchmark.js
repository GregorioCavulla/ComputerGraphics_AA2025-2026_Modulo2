import * as THREE from 'three';

export class CpuBenchmark {
    constructor({ assets, renderer, swarm }) {
        this.assets = assets;
        this.renderer = renderer;
        this.swarm = swarm;
        this.cpuMaterials = new WeakMap();
    }

    enter(mode, count, options = {}) {
        this.renderer.configureCpuProfile();
        this.renderer.setOrbitEnabled(false);
        this.renderer.camera.position.set(0, 28, 52);
        this.renderer.camera.lookAt(0, 13, 0);
        const template = this.assets.getTemplate('pokeball');
        if (mode === 'instanced') {
            this.swarm.setInstanced(template, count, { templateKey: 'pokeball-cpu', capacity: options.maxCount, materialFactory: (mesh) => this.createCpuMaterial(mesh.material), castShadow: false, receiveShadow: false, radius: 9, clearance: 1.45, strands: 7 });
        } else {
            this.swarm.setNaive(template, count, { templateKey: 'pokeball-cpu', materialFactory: (mesh) => this.createCpuMaterial(mesh.material), castShadow: false, receiveShadow: false, radius: 9, clearance: 1.45, strands: 7 });
        }
    }

    createCpuMaterial(sourceMaterial) {
        if (this.cpuMaterials.has(sourceMaterial)) return this.cpuMaterials.get(sourceMaterial);
        if (Array.isArray(sourceMaterial)) {
            const materials = sourceMaterial.map((material) => this.createCpuMaterial(material));
            this.cpuMaterials.set(sourceMaterial, materials);
            return materials;
        }
        const material = new THREE.MeshBasicMaterial({
            color: sourceMaterial?.color?.clone?.() ?? new THREE.Color(0xffffff),
            map: sourceMaterial?.map ?? null,
            transparent: sourceMaterial?.transparent ?? false,
            opacity: sourceMaterial?.opacity ?? 1,
        });
        this.cpuMaterials.set(sourceMaterial, material);
        return material;
    }
}
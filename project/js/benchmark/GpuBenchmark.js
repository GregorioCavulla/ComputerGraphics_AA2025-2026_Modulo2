export class GpuBenchmark {
    constructor({ assets, renderer, swarm }) {
        this.assets = assets;
        this.renderer = renderer;
        this.swarm = swarm;
    }

    enter(mode, count, options = {}) {
        this.renderer.configureGpuLighting();
        this.renderer.setOrbitEnabled(false);
        this.renderer.camera.position.set(0, 28, 54);
        this.renderer.camera.lookAt(0, 14, 0);
        const keys = ['porygon', 'porygon2', 'porygonz'];
        if (mode === 'instanced') {
            this.swarm.setInstanced(this.assets.getTemplate('porygonz'), Math.max(1, count), { templateKey: 'porygonz', capacity: options.maxCount, radius: 10, clearance: 2.2, strands: 6 });
            return;
        }
        this.swarm.clear();
        for (let i = 0; i < count; i += 1) {
            const root = this.assets.createModel(keys[i % keys.length]);
            const angle = i * 1.7;
            const radius = 4 + i * 0.55;
            root.position.set(Math.cos(angle) * radius, 0.4 + i * 0.35, Math.sin(angle) * radius);
            root.rotation.y = angle;
            this.swarm.group.add(root);
            this.swarm.entries.push({ root, phase: i * 0.6, index: i });
        }
        this.swarm.mode = 'naive';
        this.swarm.layout = 'helix';
        this.swarm.radius = 10;
        this.swarm.clearance = 2.4;
        this.swarm.strands = 5;
    }

    update(elapsed) {
        this.renderer.updateGpuLight(elapsed);
    }
}
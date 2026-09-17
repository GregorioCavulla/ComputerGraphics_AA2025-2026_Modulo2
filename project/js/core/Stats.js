export class Stats {
    constructor(renderer) {
        this.renderer = renderer;
        this.samples = [];
        this.stepSamples = [];
        this.phase = 'Avvio';
        this.note = '';
        this.count = 0;
        this.assetLoadMs = 0;
        this.shaderCompileMs = 0;
        this.lastFrameTime = null;
        this.currentFps = 0;
        this.score = null;
    }

    sampleFrame(now) {
        if (this.lastFrameTime !== null) {
            const deltaMs = Math.max(now - this.lastFrameTime, 0.001);
            const fps = 1000 / deltaMs;
            this.currentFps = fps;
            this.samples.push(fps);
            this.stepSamples.push({ fps, ms: deltaMs });
            if (this.samples.length > 180) this.samples.shift();
        }
        this.lastFrameTime = now;
    }

    beginStep() {
        this.stepSamples.length = 0;
    }

    finishStep() {
        const count = Math.max(this.stepSamples.length, 1);
        const fps = this.stepSamples.reduce((sum, item) => sum + item.fps, 0) / count;
        const ms = this.stepSamples.reduce((sum, item) => sum + item.ms, 0) / count;
        const sorted = this.stepSamples.map((item) => item.fps).sort((a, b) => a - b);
        const lowIndex = Math.max(0, Math.floor(sorted.length * 0.1) - 1);
        const lowFps = sorted[lowIndex] ?? fps;
        return {
            phase: this.phase,
            count: this.count,
            fps,
            ms,
            lowFps,
            calls: this.renderer.info.render.calls,
            triangles: this.renderer.info.render.triangles,
        };
    }

    setPhase(phase, count = this.count, note = '') {
        this.phase = phase;
        this.count = count;
        this.note = note;
    }

    setAssetLoadTime(ms) {
        this.assetLoadMs = ms;
    }

    setShaderCompileTime(ms) {
        this.shaderCompileMs = ms;
    }

    setScore(score) {
        this.score = score;
    }

    snapshot() {
        return {
            phase: this.phase,
            note: this.note,
            count: this.count,
            fps: this.currentFps,
            calls: this.renderer.info.render.calls,
            triangles: this.renderer.info.render.triangles,
            memory: this.renderer.info.memory,
            assetLoadMs: this.assetLoadMs,
            shaderCompileMs: this.shaderCompileMs,
            score: this.score,
            samples: [...this.samples],
        };
    }
}
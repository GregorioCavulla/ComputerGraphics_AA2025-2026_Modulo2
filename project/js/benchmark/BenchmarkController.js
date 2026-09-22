import { MixedBenchmark } from './MixedBenchmark.js';

import { TARGET_FPS } from './BenchmarkConfig.js';
const WARMUP_MS = 450;
const MEASURE_MS = 900;
const RAMP_MS = 550;
const LOW_FPS_WINDOWS = 1;
const REFINE_ATTEMPTS = 4;

export class BenchmarkController {
    constructor({ renderer, assets, stats, swarm, onComplete }) {
        this.renderer = renderer;
        this.stats = stats;
        this.swarm = swarm;
        this.onComplete = onComplete;
        this.mixed = new MixedBenchmark({ assets, renderer, swarm });
        this.results = [];
        this.running = false;
        this.phaseIndex = 0;
        this.stepIndex = 0;
        this.stage = 'idle';
        this.stageStarted = 0;
        this.lowFpsSteps = 0;
        this.currentCount = 0;
        this.lowerStable = 0;
        this.upperUnstable = null;
        this.refineAttempts = 0;
    }

    start(options = {}) {
        this.options = { benchmarkMode: 'simple', append: false, ...options };
        this.phases = phasesFor(this.options.benchmarkMode);
        if (!this.options.append) this.results.length = 0;
        this.running = true;
        this.phaseIndex = 0;
        this.startPhase(performance.now());
    }

    stop() {
        this.running = false;
        this.stage = 'idle';
    }

    update(now) {
        if (!this.running) return;
        const phase = this.phases[this.phaseIndex];
        const elapsed = now * 0.001;
        if (this.options.benchmarkMode === 'full') this.renderer.updateGpuLight(elapsed);
        this.swarm.update(elapsed);

        const target = this.targetCount;
        const age = now - this.stageStarted;
        if (this.stage === 'ramp') {
            const t = Math.min(age / RAMP_MS, 1);
            const count = Math.max(1, Math.round(this.rampFrom + (target - this.rampFrom) * t));
            if (count !== this.currentCount) this.applyStep(phase, count);
            this.stats.setPhase(phase.label, count);
            if (t >= 1) this.beginWarmup(now);
        } else if (this.stage === 'warmup' && age >= WARMUP_MS) {
            this.stats.beginStep();
            this.stage = 'measure';
            this.stageStarted = now;
            this.stats.setPhase(phase.label, target);
        } else if (this.stage === 'measure' && age >= MEASURE_MS) {
            this.recordStep(now, phase);
        }
    }

    startPhase(now) {
        this.stepIndex = 0;
        this.lowFpsSteps = 0;
        this.lowerStable = 0;
        this.upperUnstable = null;
        this.refineAttempts = 0;
        this.targetCount = this.phases[this.phaseIndex].initial;
        this.beginRamp(now, 1);
    }

    beginRamp(now, fromCount) {
        const phase = this.phases[this.phaseIndex];
        this.stage = 'ramp';
        this.stageStarted = now;
        this.rampFrom = fromCount;
        this.applyStep(phase, fromCount);
    }

    beginWarmup(now) {
        const phase = this.phases[this.phaseIndex];
        const target = this.targetCount;
        this.stage = 'warmup';
        this.stageStarted = now;
        this.applyStep(phase, target);
        this.stats.setPhase(phase.label, target);
    }

    applyStep(phase, count) {
        this.currentCount = count;
        this.mixed.enter(phase.mode, count, { maxCount: phase.max, benchmarkMode: this.options.benchmarkMode });
        this.stats.setPhase(phase.label, count);
    }

    recordStep(now, phase) {
        const result = this.stats.finishStep();
        result.phase = phase.label;
        result.mode = phase.mode;
        result.kind = phase.kind;
        result.benchmarkMode = this.options.benchmarkMode;
        result.stable60 = result.fps >= TARGET_FPS * 0.97 && result.lowFps >= TARGET_FPS * 0.9;
        result.stable = result.stable60;
        this.results.push(result);
        if (result.stable) {
            this.lowerStable = Math.max(this.lowerStable, result.count);
            this.lowFpsSteps = 0;
        } else {
            this.upperUnstable = Math.min(this.upperUnstable ?? result.count, result.count);
            this.lowFpsSteps += 1;
        }
        const nextTarget = this.nextTarget(phase, result);
        if (nextTarget === null) this.nextPhase(now);
        else {
            this.stepIndex += 1;
            this.targetCount = nextTarget;
            this.beginRamp(now, this.currentCount);
        }
    }

    nextTarget(phase, result) {
        if (result.stable && result.count >= phase.max) return null;
        if (this.upperUnstable === null) {
            if (!result.stable && this.lowFpsSteps >= LOW_FPS_WINDOWS) {
                this.upperUnstable = result.count;
            } else if (!result.stable) {
                return result.count;
            } else {
                return Math.min(phase.max, Math.max(result.count + 1, Math.round(result.count * phase.multiplier)));
            }
        }
        if (this.upperUnstable === null) return null;
        this.refineAttempts += 1;
        if (this.refineAttempts > REFINE_ATTEMPTS || this.upperUnstable - this.lowerStable <= Math.max(2, Math.round(this.upperUnstable * 0.04))) {
            return null;
        }
        return Math.max(1, Math.round((this.lowerStable + this.upperUnstable) / 2));
    }

    nextPhase(now) {
        this.swarm.clear();
        this.lowFpsSteps = 0;
        this.phaseIndex += 1;
        this.stepIndex = 0;
        if (this.phaseIndex >= this.phases.length) {
            this.running = false;
            this.stats.setScore({ piles: buildPiles(this.results) });
            this.onComplete(this.results, this.options.benchmarkMode);
            return;
        }
        this.startPhase(now);
    }
}

function phasesFor(benchmarkMode) {
    if (benchmarkMode === 'full') {
        return [
            { label: 'naive full', kind: 'mixed', mode: 'naive', initial: 16, max: 8000, multiplier: 1.8 },
            { label: 'instanced full', kind: 'mixed', mode: 'instanced', initial: 128, max: 36000, multiplier: 2 },
        ];
    }
    return [
        { label: 'naive simple', kind: 'mixed', mode: 'naive', initial: 32, max: 12000, multiplier: 1.9 },
        { label: 'instanced simple', kind: 'mixed', mode: 'instanced', initial: 256, max: 64000, multiplier: 2 },
    ];
}

function buildPiles(results) {
    return ['naive simple', 'instanced simple', 'naive full', 'instanced full']
        .map((label) => ({ label, count: bestStable60ByPhase(results, label).count }));
}

function bestStable60ByPhase(results, phase) {
    return results
        .filter((item) => item.phase === phase && item.stable60)
        .sort((a, b) => b.count - a.count)[0] ?? { count: 0 };
}
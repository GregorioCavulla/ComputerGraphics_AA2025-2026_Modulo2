import { AppRenderer } from './js/core/Renderer.js';
import { AssetLoader } from './js/core/AssetLoader.js';
import { Stats } from './js/core/Stats.js';
import { BenchmarkController } from './js/benchmark/BenchmarkController.js';
import { PorygonSwarm } from './js/swarm/PorygonSwarm.js';
import { StartOverlay } from './js/ui/StartOverlay.js';
import { DataPanel } from './js/ui/DataPanel.js';
import { ResultsPileScene } from './js/scene/ResultsPileScene.js';
import { ShadowDebug } from './js/debug/ShadowDebug.js';
import { PhaseSelector } from './js/debug/PhaseSelector.js';

const app = new AppRenderer(document.body);
const stats = new Stats(app.renderer);
const loader = new AssetLoader();
const overlay = new StartOverlay(document.getElementById('start-overlay'));
const panel = new DataPanel(document.getElementById('data-panel'), stats);
const swarm = new PorygonSwarm(app.scene);
const resultsControls = document.getElementById('results-controls');
const finalModeSelect = resultsControls.querySelector('[data-final-mode]');
const runFullButton = resultsControls.querySelector('[data-run-full]');

const shadowDebug = ShadowDebug.requested() ? new ShadowDebug(app) : null;
let introModel = null;
let resultsPile = null;
let runOptions = { benchmarkMode: 'simple', finalFull: true };
let lastTime = performance.now();

stats.setPhase('Caricamento asset', 0, 'Preparazione modelli GLB');
panel.start();

try {
    const loadStarted = performance.now();
    await loader.loadAll((name, state) => panel.pushStatus(`${name}: ${state}`));
    stats.setAssetLoadTime(performance.now() - loadStarted);

    for (const [key, x] of [['porygon', -4.5], ['porygon2', -1.5], ['porygonz', 1.5], ['pokeball', 4.5]]) {
        app.dynamic.add(loader.createModel(key, { x }));
    }
    app.compileOnce();
    app.clearDynamicContent();

    introModel = loader.createModel('pokeball', { heightScale: 0.62 });
    app.dynamic.add(introModel);
    app.setIntroCamera();
    stats.setShaderCompileTime(app.lastCompileMs);
    stats.setPhase('Pronto', 1, 'Pokeball iniziale');
    overlay.show(() => startBenchmark());
} catch (error) {
    console.error(error);
    overlay.showError('Errore durante il caricamento dei GLB. Controlla console e percorsi asset.');
}

const controller = new BenchmarkController({
    renderer: app,
    assets: loader,
    stats,
    swarm,
    onComplete: showResultsScene,
});

function startBenchmark(options) {
    runOptions = { ...runOptions, ...options, benchmarkMode: 'simple' };
    resultsControls.hidden = true;
    overlay.hide();
    if (introModel) {
        app.dynamic.remove(introModel);
        introModel = null;
    }
    app.setBenchmarkCamera();
    controller.start(runOptions);
}

function startFullBenchmark() {
    runOptions = { ...runOptions, benchmarkMode: 'full', append: true, finalFull: finalModeSelect.value === 'full' };
    resultsControls.hidden = true;
    clearResultsPile();
    stats.setPhase('naive full', 0);
    controller.start(runOptions);
}

function showResultsScene(results, completedMode) {
    swarm.clear();
    clearResultsPile();
    app.setOrbitEnabled(false);
    runOptions.finalFull = finalModeSelect.value === 'full';
    resultsPile = new ResultsPileScene(app, loader, stats.score, runOptions);
    resultsPile.enter();
    stats.setPhase('Results', totalMeasuredInstances(stats.score));
    panel.setResults(results);
    resultsControls.hidden = false;
    runFullButton.hidden = completedMode === 'full';
}

function clearResultsPile() {
    if (!resultsPile) {
        app.clearDynamicContent();
        return;
    }
    resultsPile.dispose();
    resultsPile = null;
    app.clearDynamicContent();
}

function totalMeasuredInstances(score) {
    return score?.piles?.reduce((sum, pile) => sum + pile.count, 0) ?? 0;
}

const FAKE_PILE_COUNTS = { 'naive simple': 8500, 'instanced simple': 64000, 'naive full': 400, 'instanced full': 2000 };

function jumpToStart() {
    controller.stop();
    swarm.clear();
    clearResultsPile();
    if (introModel) {
        app.dynamic.remove(introModel);
        introModel = null;
    }
    resultsControls.hidden = true;
    app.configureStandardLighting();
    introModel = loader.createModel('pokeball', { heightScale: 0.62 });
    app.dynamic.add(introModel);
    app.setIntroCamera();
    stats.setPhase('Pronto', 1, 'Debug: start');
    overlay.show(() => startBenchmark());
}

function jumpToBenchmark(mode) {
    controller.stop();
    clearResultsPile();
    if (introModel) {
        app.dynamic.remove(introModel);
        introModel = null;
    }
    resultsControls.hidden = true;
    overlay.hide();
    app.setBenchmarkCamera();
    controller.start({ benchmarkMode: mode, finalFull: true, append: false });
}

function jumpToPile(mode) {
    controller.stop();
    swarm.clear();
    if (introModel) {
        app.dynamic.remove(introModel);
        introModel = null;
    }
    overlay.hide();
    const labels = mode === 'full'
        ? ['naive simple', 'instanced simple', 'naive full', 'instanced full']
        : ['naive simple', 'instanced simple'];
    const fakeScore = { piles: labels.map((label) => ({ label, count: FAKE_PILE_COUNTS[label] })) };
    stats.setScore(fakeScore);
    finalModeSelect.value = mode;
    showResultsScene(fakeScore, mode);
}

if (PhaseSelector.requested()) {
    new PhaseSelector({
        start: jumpToStart,
        'benchmark-simple': () => jumpToBenchmark('simple'),
        'pile-simple': () => jumpToPile('simple'),
        'benchmark-full': () => jumpToBenchmark('full'),
        'pile-full': () => jumpToPile('full'),
    });
}

runFullButton.addEventListener('click', startFullBenchmark);
finalModeSelect.addEventListener('change', () => {
    if (!resultsPile) return;
    runOptions.finalFull = finalModeSelect.value === 'full';
    resultsPile.setFullMode(runOptions.finalFull);
});

function animate(now) {
    requestAnimationFrame(animate);
    const delta = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    controller.update(now, delta);
    if (resultsPile) resultsPile.update(delta);
    if (introModel) {
        introModel.position.y = 0.2 + Math.sin(now * 0.0016) * 0.1;
        introModel.rotation.y += delta * 0.35;
        app.updateGpuLight(now * 0.001);
    }

    app.updateFog(now * 0.001, Math.min(stats.count / 9000, 1));
    shadowDebug?.update();
    app.update(delta);
    app.render();
    stats.sampleFrame(now);
}

requestAnimationFrame(animate);

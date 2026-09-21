import * as THREE from 'three';

const RESCAN_FRAMES = 30;

export class ShadowDebug {
    static requested() {
        return new URLSearchParams(location.search).has('debug');
    }

    constructor(app) {
        this.app = app;
        this.frame = 0;
        this.tallest = { y: 0, x: 0, z: 0, kind: '-', count: 0 };
        this.box = new THREE.Box3();
        this.dir = new THREE.Vector3();
        this.gpuInfo = readGpuInfo(app.renderer);

        this.helper = new THREE.CameraHelper(app.sun.shadow.camera);
        app.scene.add(this.helper);

        this.predicted = makeRing(0x00ffff);
        this.under = makeRing(0xff00ff);
        app.scene.add(this.predicted, this.under);

        this.hud = document.createElement('div');
        this.hud.style.cssText = 'position:fixed;top:8px;left:8px;z-index:50;color:#0f0;'
            + 'font:12px monospace;background:rgba(0,0,0,.85);padding:8px;white-space:pre;pointer-events:none';
        document.body.appendChild(this.hud);
    }

    update() {
        this.frame += 1;
        const app = this.app;

        if (this.frame % RESCAN_FRAMES === 1) this.rescan();

        const sun = app.sun;
        const horiz = Math.hypot(sun.position.x, sun.position.z);
        const elevation = Math.atan2(sun.position.y, horiz) * 180 / Math.PI;

        this.dir.copy(sun.target.position).sub(sun.position).normalize();
        const h = this.tallest.y;
        const k = this.dir.y !== 0 ? -h / this.dir.y : 0;
        const sx = this.tallest.x + k * this.dir.x;
        const sz = this.tallest.z + k * this.dir.z;
        const offset = Math.hypot(sx - this.tallest.x, sz - this.tallest.z);

        const ringScale = Math.min(3, Math.max(0.15, h * 0.6));
        this.predicted.position.set(sx, 0.06, sz);
        this.predicted.scale.setScalar(ringScale);
        this.under.position.set(this.tallest.x, 0.06, this.tallest.z);
        this.under.scale.setScalar(ringScale);

        const typeNames = { [THREE.BasicShadowMap]: 'Basic', [THREE.PCFShadowMap]: 'PCF', [THREE.PCFSoftShadowMap]: 'PCFSoft', [THREE.VSMShadowMap]: 'VSM' };
        this.hud.textContent = [
            `GPU          ${this.gpuInfo}`,
            `shadowMapType ${typeNames[app.renderer.shadowMap.type] ?? app.renderer.shadowMap.type}  (locked to Basic, no override exists anymore)`,
            `autoUpdate   renderer.shadowMap=${app.renderer.shadowMap.autoUpdate}  sun.shadow=${sun.shadow.autoUpdate}  needsUpdate=${sun.shadow.needsUpdate}`,
            `profile      ${app.activeProfile}`,
            `sun          (${f(sun.position.x)}, ${f(sun.position.y)}, ${f(sun.position.z)})`,
            `target       (${f(sun.target.position.x)}, ${f(sun.target.position.y)}, ${f(sun.target.position.z)})`,
            `elevation    ${f(elevation)}°   horiz radius ${f(horiz)}`,
            `orbit params rX=${app.sunRadiusX} rZ=${app.sunRadiusZ} hMin=${app.sunHeightMin} hRange=${app.sunHeightRange}`,
            `castShadow   sun=${sun.castShadow}  ground=${app.ground.receiveShadow}  map=${app.renderer.shadowMap.enabled}`,
            `shadow bias  bias=${sun.shadow.bias} normalBias=${sun.shadow.normalBias} mapSize=${sun.shadow.mapSize.x}x${sun.shadow.mapSize.y}`,
            `shadow cam   L/R/T/B ${sun.shadow.camera.left}/${sun.shadow.camera.right}/`
                + `${sun.shadow.camera.top}/${sun.shadow.camera.bottom} near=${sun.shadow.camera.near} far=${sun.shadow.camera.far}`,
            `tallest      ${this.tallest.kind} h=${f(h)} at (${f(this.tallest.x)}, ${f(this.tallest.z)})`,
            `casters      ${this.tallest.count}`,
            `PREDICTED    shadow at (${f(sx)}, ${f(sz)})  offset ${f(offset)}u  [cyan ring]`,
            `magenta ring = straight under the model`,
        ].join('\n');
    }

    rescan() {
        let best = -Infinity;
        let count = 0;
        const found = { y: 0, x: 0, z: 0, kind: '-' };
        this.app.scene.updateMatrixWorld(true);
        this.app.scene.traverse((o) => {
            if (!o.isMesh || !o.castShadow) return;
            count += 1;
            this.box.setFromObject(o);
            if (!isFinite(this.box.max.y) || this.box.max.y <= best) return;
            best = this.box.max.y;
            found.y = this.box.max.y;
            found.x = (this.box.min.x + this.box.max.x) / 2;
            found.z = (this.box.min.z + this.box.max.z) / 2;
            found.kind = o.isInstancedMesh ? `InstancedMesh(${o.count})` : 'Mesh';
        });
        if (isFinite(best)) {
            this.tallest = { ...found, count };
        } else {
            this.tallest = { y: 0, x: 0, z: 0, kind: 'none', count };
        }
    }
}

function makeRing(color) {
    const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.2, 1.9, 32),
        new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, depthTest: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 999;
    return ring;
}

function f(value) {
    return Number.isFinite(value) ? value.toFixed(2) : String(value);
}

function readGpuInfo(renderer) {
    try {
        const gl = renderer.getContext();
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        if (!ext) return gl.getParameter(gl.RENDERER) + ' (no debug_renderer_info ext)';
        return gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) + ' / ' + gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
    } catch (err) {
        return 'unavailable: ' + err.message;
    }
}

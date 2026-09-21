import * as THREE from 'three';

const keys = new Set();

export class FreeRoamScene {
    constructor(app, assets) {
        this.app = app;
        this.assets = assets;
        this.yaw = 0;
        this.pitch = -0.12;
        this.speed = 6;
        this.bounds = 44;
        this.minY = 1.1;
        this.onKeyDown = (event) => keys.add(event.code);
        this.onKeyUp = (event) => keys.delete(event.code);
        this.onMouseMove = (event) => this.handleMouse(event);
        this.onCanvasClick = () => this.app.renderer.domElement.requestPointerLock?.();
    }

    enter() {
        const placements = [
            ['porygon', -4.5, 0, 0.95],
            ['porygon2', -1.5, -1.2, 1],
            ['porygonz', 1.7, 0.2, 1.05],
            ['pokeball', 4.5, -0.8, 0.75],
        ];
        for (const [key, x, z, heightScale] of placements) {
            const model = this.assets.createModel(key, { x, z, heightScale });
            this.app.dynamic.add(model);
        }
        this.app.camera.position.set(0, 2.4, 10);
        this.app.camera.rotation.order = 'YXZ';
        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('keyup', this.onKeyUp);
        document.addEventListener('mousemove', this.onMouseMove);
        this.app.renderer.domElement.addEventListener('click', this.onCanvasClick);
    }

    update(delta) {
        const camera = this.app.camera;
        camera.rotation.y = this.yaw;
        camera.rotation.x = this.pitch;
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
        const move = new THREE.Vector3();
        if (keys.has('KeyW')) move.add(forward);
        if (keys.has('KeyS')) move.sub(forward);
        if (keys.has('KeyA')) move.sub(right);
        if (keys.has('KeyD')) move.add(right);
        if (keys.has('Space')) move.y += 1;
        if (keys.has('ShiftLeft') || keys.has('ShiftRight')) move.y -= 1;
        if (move.lengthSq() > 0) {
            move.normalize().multiplyScalar(this.speed * delta);
            camera.position.add(move);
            camera.position.x = clamp(camera.position.x, -this.bounds, this.bounds);
            camera.position.z = clamp(camera.position.z, -this.bounds, this.bounds);
            camera.position.y = Math.max(this.minY, Math.min(camera.position.y, 12));
        }
    }

    handleMouse(event) {
        if (document.pointerLockElement !== this.app.renderer.domElement) return;
        this.yaw -= event.movementX * 0.002;
        this.pitch -= event.movementY * 0.002;
        this.pitch = clamp(this.pitch, -1.25, 1.1);
    }
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
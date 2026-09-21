import * as THREE from 'three';

const MODEL_KEYS = ['pokeball', 'porygon', 'porygon2', 'porygonz'];
const labelScale = new THREE.Vector3(9, 3, 1);
const matrix = new THREE.Matrix4();
const quaternion = new THREE.Quaternion();
const scaleVector = new THREE.Vector3(1, 1, 1);
const yAxis = new THREE.Vector3(0, 1, 0);

export class ResultsPileScene {
    constructor(app, assets, score, options = {}) {
        this.app = app;
        this.assets = assets;
        this.score = score;
        this.options = { finalFull: true, ...options };
        this.group = new THREE.Group();
        this.sets = [];
        this.elapsed = 0;
    }

    enter() {
        this.dispose();
        this.group = new THREE.Group();
        this.sets = [];
        this.app.configureFinalProfile(this.options.finalFull);
        this.app.setOrbitEnabled(true);
        this.app.controls.target.set(0, 4, 0);
        this.app.camera.position.set(0, 38, 72);
        this.app.controls.update();
        this.app.dynamic.add(this.group);

        const piles = (this.score?.piles ?? []).filter((pile) => pile.count > 0);
        const displayScale = Math.max(1, Math.ceil(Math.max(...piles.map((pile) => pile.count), 1) / 80));
        const positions = pileCenters(piles.length);
        piles.forEach((pile, index) => {
            this.createPile({ label: pile.label, realCount: pile.count, visualCount: visualCountFor(pile.count, displayScale), center: positions[index], scale: displayScale });
        });
    }

    update(delta) {
        this.elapsed += delta;
        if (this.options.finalFull) this.app.updateGpuLight(this.elapsed);
    }

    setFullMode(finalFull) {
        this.options.finalFull = finalFull;
        this.enter();
    }

    dispose() {
        if (!this.group.parent && this.group.children.length === 0) return;
        this.group.parent?.remove(this.group);
        this.group.traverse((child) => {
            if (child.isInstancedMesh) {
                child.geometry.dispose();
                disposeMaterial(child.material);
            } else if (child.isSprite) {
                child.material.map?.dispose();
                child.material.dispose();
            }
        });
        this.group.clear();
        this.sets = [];
    }

    createPile({ label, realCount, visualCount, center, scale }) {
        const positions = pilePositions(visualCount, center.x, center.z);
        const localCounts = new Map(MODEL_KEYS.map((key) => [key, 0]));
        const capacities = countVisualModels(visualCount);
        const meshSets = new Map();
        for (const key of MODEL_KEYS) {
            meshSets.set(key, this.createInstancedModelSet(key, capacities.get(key) ?? 1));
        }
        let highest = 0;
        positions.forEach((target, index) => {
            const key = MODEL_KEYS[index % MODEL_KEYS.length];
            const localIndex = localCounts.get(key) ?? 0;
            localCounts.set(key, localIndex + 1);
            quaternion.setFromAxisAngle(yAxis, index * 0.9);
            matrix.compose(target, quaternion, scaleVector);
            for (const mesh of meshSets.get(key)) {
                mesh.setMatrixAt(localIndex, matrix.clone().multiply(mesh.userData.sourceMatrix));
            }
            highest = Math.max(highest, target.y);
        });
        for (const meshes of meshSets.values()) {
            for (const mesh of meshes) mesh.instanceMatrix.needsUpdate = true;
        }
        const sprite = createLabel(`${label}\n${realCount.toLocaleString('it-IT')} modelli reali\nscala visiva 1:${scale}`);
        sprite.position.set(center.x, highest + 5, center.z);
        sprite.scale.copy(labelScale);
        this.group.add(sprite);
    }

    createInstancedModelSet(key, capacity) {
        const template = this.assets.getTemplate(key);
        const meshes = collectMeshes(template).map((source) => {
            const material = Array.isArray(source.material)
                ? source.material.map((item) => item.clone())
                : source.material.clone();
            const mesh = new THREE.InstancedMesh(source.geometry.clone(), material, Math.max(1, capacity));
            mesh.count = capacity;
            mesh.castShadow = this.options.finalFull;
            mesh.receiveShadow = this.options.finalFull;
            mesh.frustumCulled = false;
            mesh.userData.sourceMatrix = source.matrixWorld.clone();
            this.group.add(mesh);
            return mesh;
        });
        this.sets.push(meshes);
        return meshes;
    }
}

function pileCenters(count) {
    if (count <= 2) return [{ x: -13, z: 0 }, { x: 13, z: 0 }];
    return [
        { x: -16, z: -10 },
        { x: 16, z: -10 },
        { x: -16, z: 12 },
        { x: 16, z: 12 },
    ];
}

function visualCountFor(realCount, scale) {
    if (realCount <= 0) return 0;
    return Math.min(84, Math.max(8, Math.ceil(realCount / scale)));
}

function countVisualModels(total) {
    const counts = new Map(MODEL_KEYS.map((key) => [key, 0]));
    for (let i = 0; i < total; i += 1) {
        const key = MODEL_KEYS[i % MODEL_KEYS.length];
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
}

function collectMeshes(root) {
    const meshes = [];
    root.updateMatrixWorld(true);
    root.traverse((child) => {
        if (child.isMesh) meshes.push(child);
    });
    return meshes;
}

function pilePositions(count, centerX, centerZ) {
    const positions = [];
    const spacing = 1.85;
    const layerHeight = 1.05;
    let layer = 0;
    while (positions.length < count) {
        const radiusLimit = Math.max(1, 7 - layer);
        for (let ring = 0; ring <= radiusLimit && positions.length < count; ring += 1) {
            const slots = ring === 0 ? 1 : ring * 8;
            for (let slot = 0; slot < slots && positions.length < count; slot += 1) {
                const angle = (slot / slots) * Math.PI * 2 + layer * 0.31;
                const jitter = ((slot * 17 + layer * 11) % 10) / 10 * 0.18;
                positions.push(new THREE.Vector3(
                    centerX + Math.cos(angle) * ring * spacing + jitter,
                    0.15 + layer * layerHeight,
                    centerZ + Math.sin(angle) * ring * spacing - jitter,
                ));
            }
        }
        layer += 1;
    }
    return positions;
}

function disposeMaterial(material) {
    const list = Array.isArray(material) ? material : [material];
    for (const item of list) item.dispose();
}

function createLabel(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 384;
    const context = canvas.getContext('2d');
    context.fillStyle = 'rgba(3, 12, 16, 0.82)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#68f2d0';
    context.lineWidth = 8;
    context.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const lines = text.split('\n');
    const sizes = [54, 78, 44];
    lines.forEach((line, index) => {
        context.font = `700 ${sizes[index]}px Trebuchet MS, sans-serif`;
        context.fillStyle = index === 1 ? '#fff06a' : '#dcfff6';
        context.fillText(line, canvas.width / 2, 92 + index * 108);
    });
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    return new THREE.Sprite(material);
}
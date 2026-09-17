import * as THREE from 'three';

const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const yAxis = new THREE.Vector3(0, 1, 0);
const scale = new THREE.Vector3(1, 1, 1);
const TWO_PI = Math.PI * 2;

export class PorygonSwarm {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.mode = 'none';
        this.entries = [];
        this.instancedMeshes = [];
        this.sourceMeshes = [];
        this.spacing = 1.8;
        this.templateKey = null;
        this.layout = 'helix';
        this.radius = 6;
        this.verticalStep = 0.1;
        this.strands = 4;
        this.clearance = 1.8;
        this.mixedTemplates = [];
        this.mixedSets = [];
    }

    setMixedNaive(templates, count, options = {}) {
        const nextTemplateKey = options.templateKey ?? 'mixed-naive';
        if (this.mode !== 'mixed-naive' || this.templateKey !== nextTemplateKey) {
            this.clear();
            this.mode = 'mixed-naive';
            this.templateKey = nextTemplateKey;
            this.mixedTemplates = templates;
        }
        this.applyLayoutOptions(options);
        const castShadow = options.castShadow ?? true;
        const receiveShadow = options.receiveShadow ?? true;
        while (this.entries.length > count) {
            const entry = this.entries.pop();
            this.group.remove(entry.root);
        }
        for (let i = this.entries.length; i < count; i += 1) {
            const template = templateForIndex(templates, i, count);
            const item = template.root.clone(true);
            item.traverse((child) => {
                if (child.isMesh) {
                    if (options.materialFactory) child.material = options.materialFactory(child, template.key);
                    child.castShadow = castShadow;
                    child.receiveShadow = receiveShadow;
                    child.frustumCulled = false;
                }
            });
            this.group.add(item);
            this.entries.push({ root: item, phase: i * 0.37, index: i });
        }
        this.updateNaive(0);
    }

    setMixedInstanced(templates, count, options = {}) {
        const nextTemplateKey = options.templateKey ?? 'mixed-instanced';
        const capacity = options.capacity ?? count;
        const mustRebuild = this.mode !== 'mixed-instanced' || this.templateKey !== nextTemplateKey || this.mixedCapacity < capacity;
        this.applyLayoutOptions(options);
        if (mustRebuild) {
            this.clear();
            this.mode = 'mixed-instanced';
            this.templateKey = nextTemplateKey;
            this.mixedCapacity = capacity;
            this.mixedTemplates = templates;
            this.buildMixedInstanced(templates, capacity, options);
        }
        this.entries = Array.from({ length: count }, (_, i) => ({ phase: i * 0.37, index: i }));
        const counts = countByTemplate(templates, count);
        for (const set of this.mixedSets) {
            for (const mesh of set.meshes) mesh.count = counts.get(set.key) ?? 0;
        }
        this.updateMixedInstanced(0);
    }

    setNaive(template, count, options = {}) {
        const nextTemplateKey = options.templateKey ?? template.uuid;
        if (this.mode !== 'naive' || this.templateKey !== nextTemplateKey) {
            this.clear();
            this.mode = 'naive';
            this.templateKey = nextTemplateKey;
        }
        this.mode = 'naive';
        this.applyLayoutOptions(options);
        const castShadow = options.castShadow ?? true;
        const receiveShadow = options.receiveShadow ?? true;
        while (this.entries.length > count) {
            const entry = this.entries.pop();
            this.group.remove(entry.root);
        }
        for (let i = this.entries.length; i < count; i += 1) {
            const item = template.clone(true);
            item.traverse((child) => {
                if (child.isMesh) {
                    if (options.materialFactory) child.material = options.materialFactory(child);
                    else if (options.materialOverride) child.material = options.materialOverride;
                    child.castShadow = castShadow;
                    child.receiveShadow = receiveShadow;
                    child.frustumCulled = false;
                }
            });
            this.group.add(item);
            this.entries.push({ root: item, phase: i * 0.37, index: i });
        }
        this.updateNaive(0);
    }

    setInstanced(template, count, options = {}) {
        const nextTemplateKey = options.templateKey ?? template.uuid;
        const capacity = options.capacity ?? count;
        const mustRebuild = this.mode !== 'instanced' || this.templateKey !== nextTemplateKey || this.instancedMeshes[0]?.userData.capacity < capacity;
        this.applyLayoutOptions(options);
        const castShadow = options.castShadow ?? true;
        const receiveShadow = options.receiveShadow ?? true;
        if (!mustRebuild) {
            for (const mesh of this.instancedMeshes) mesh.count = count;
            this.entries = Array.from({ length: count }, (_, i) => ({ phase: i * 0.37, index: i }));
            this.updateInstanced(0);
            return;
        }
        this.clear();
        this.mode = 'instanced';
        this.templateKey = nextTemplateKey;
        this.spacing = options.spacing ?? 1.8;
        this.sourceMeshes = collectMeshes(template);
        for (const source of this.sourceMeshes) {
            const material = options.materialFactory
                ? options.materialFactory(source)
                : options.materialOverride
                ? options.materialOverride.clone()
                : Array.isArray(source.material)
                ? source.material.map((item) => item.clone())
                : source.material.clone();
            const mesh = new THREE.InstancedMesh(source.geometry.clone(), material, capacity);
            mesh.count = count;
            mesh.castShadow = castShadow;
            mesh.receiveShadow = receiveShadow;
            mesh.frustumCulled = false;
            mesh.userData.sourceMatrix = source.matrixWorld.clone();
            mesh.userData.capacity = capacity;
            this.instancedMeshes.push(mesh);
            this.group.add(mesh);
        }
        this.entries = Array.from({ length: count }, (_, i) => ({ phase: i * 0.37, index: i }));
        this.updateInstanced(0);
    }

    update(elapsed) {
        if (this.mode === 'naive' || this.mode === 'mixed-naive') {
            this.updateNaive(elapsed);
        } else if (this.mode === 'instanced') {
            this.updateInstanced(elapsed);
        } else if (this.mode === 'mixed-instanced') {
            this.updateMixedInstanced(elapsed);
        }
    }

    updateNaive(elapsed) {
        const count = this.entries.length;
        for (const entry of this.entries) {
            const base = this.layout === 'helix'
                ? helixPosition(entry.index, count, elapsed, this)
                : gridPosition(entry.index, count, this.spacing);
            entry.root.position.set(base.x, base.y, base.z);
            entry.root.rotation.y = base.angle;
        }
    }

    updateInstanced(elapsed) {
        const count = this.entries.length;
        for (const mesh of this.instancedMeshes) {
            for (let i = 0; i < count; i += 1) {
                const base = this.layout === 'helix'
                    ? helixPosition(i, count, elapsed, this)
                    : gridPosition(i, count, this.spacing);
                position.set(base.x, base.y, base.z);
                quaternion.setFromAxisAngle(yAxis, base.angle);
                matrix.compose(position, quaternion, scale).multiply(mesh.userData.sourceMatrix);
                mesh.setMatrixAt(i, matrix);
            }
            mesh.instanceMatrix.needsUpdate = true;
        }
    }

    updateMixedInstanced(elapsed) {
        const localIndex = new Map();
        for (let i = 0; i < this.entries.length; i += 1) {
            const template = templateForIndex(this.mixedTemplates, i, this.entries.length);
            const modelIndex = localIndex.get(template.key) ?? 0;
            localIndex.set(template.key, modelIndex + 1);
            const base = helixPosition(i, this.entries.length, elapsed, this);
            position.set(base.x, base.y, base.z);
            quaternion.setFromAxisAngle(yAxis, base.angle);
            for (const set of this.mixedSets) {
                if (set.key !== template.key) continue;
                for (const mesh of set.meshes) {
                    matrix.compose(position, quaternion, scale).multiply(mesh.userData.sourceMatrix);
                    mesh.setMatrixAt(modelIndex, matrix);
                }
            }
        }
        for (const set of this.mixedSets) {
            for (const mesh of set.meshes) mesh.instanceMatrix.needsUpdate = true;
        }
    }

    buildMixedInstanced(templates, capacity, options) {
        const capacityByKey = countByTemplate(templates, capacity);
        const castShadow = options.castShadow ?? true;
        const receiveShadow = options.receiveShadow ?? true;
        for (const template of templates) {
            const meshes = [];
            for (const source of collectMeshes(template.root)) {
                const material = options.materialFactory
                    ? options.materialFactory(source, template.key)
                    : Array.isArray(source.material)
                    ? source.material.map((item) => item.clone())
                    : source.material.clone();
                const mesh = new THREE.InstancedMesh(source.geometry.clone(), material, Math.max(1, capacityByKey.get(template.key) ?? 1));
                mesh.count = 0;
                mesh.castShadow = castShadow;
                mesh.receiveShadow = receiveShadow;
                mesh.frustumCulled = false;
                mesh.userData.sourceMatrix = source.matrixWorld.clone();
                mesh.userData.capacity = capacity;
                meshes.push(mesh);
                this.group.add(mesh);
            }
            this.mixedSets.push({ key: template.key, meshes });
        }
    }

    applyLayoutOptions(options) {
        this.spacing = options.spacing ?? 1.8;
        this.layout = options.layout ?? 'helix';
        this.radius = options.radius ?? 8;
        this.verticalStep = options.verticalStep ?? 0.09;
        this.strands = options.strands ?? 4;
        this.clearance = options.clearance ?? 1.9;
    }

    clear() {
        for (const child of [...this.group.children]) {
            this.group.remove(child);
            if (child.isInstancedMesh) {
                child.geometry.dispose();
                disposeMaterial(child.material);
            }
        }
        this.entries.length = 0;
        this.instancedMeshes.length = 0;
        this.sourceMeshes.length = 0;
        this.mixedSets.length = 0;
        this.mixedTemplates.length = 0;
        this.mixedCapacity = 0;
        this.mode = 'none';
        this.templateKey = null;
    }
}

function templateForIndex(templates, index, total) {
    const activeCount = total < 80 ? 1 : total < 220 ? 2 : total < 520 ? 3 : templates.length;
    return templates[index % activeCount];
}

function countByTemplate(templates, total) {
    const counts = new Map(templates.map((template) => [template.key, 0]));
    for (let i = 0; i < total; i += 1) {
        const template = templateForIndex(templates, i, total);
        counts.set(template.key, (counts.get(template.key) ?? 0) + 1);
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

function placeOnGrid(root, index, total, spacing) {
    const p = gridPosition(index, total, spacing);
    root.position.set(p.x, p.y, p.z);
}

function gridPosition(index, total, spacing) {
    const side = Math.ceil(Math.sqrt(total));
    const row = Math.floor(index / side);
    const col = index % side;
    return {
        x: (col - (side - 1) / 2) * spacing,
        y: 0.05,
        z: (row - (side - 1) / 2) * spacing,
    };
}

function helixPosition(index, total, elapsed, settings) {
    const strand = index % settings.strands;
    const turn = Math.floor(index / settings.strands);
    const layersPerColumn = Math.max(16, Math.ceil(Math.sqrt(total) / settings.strands));
    const layer = turn % layersPerColumn;
    const ring = Math.floor(turn / layersPerColumn);
    const y = 0.45 + layer * settings.clearance + Math.sin(elapsed * 2.2 + index * 0.19) * 0.08;
    const radius = settings.radius + ring * settings.clearance * 1.25;
    const angle = layer * 0.36 + strand * (TWO_PI / settings.strands) + ring * 0.18 + elapsed * 0.82;
    return {
        x: Math.cos(angle) * radius,
        y,
        z: Math.sin(angle) * radius,
        angle: angle + Math.PI * 0.5,
    };
}

function disposeMaterial(material) {
    const list = Array.isArray(material) ? material : [material];
    for (const item of list) item.dispose();
}
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const TARGET_HEIGHT = 1.4;

export const MODEL_SPECS = {
    porygon: { label: 'Porygon', url: 'assets/p1/p1.glb', heightScale: 1 },
    porygon2: { label: 'Porygon2', url: 'assets/p2/p2.glb', heightScale: 1 },
    porygonz: { label: 'Porygon-Z', url: 'assets/pz/pz.glb', heightScale: 1.3 },
    pokeball: { label: 'Pokeball', url: 'assets/pokeball/pokeball.glb', heightScale: 0.4 },
};

export class AssetLoader {
    constructor() {
        this.loader = new GLTFLoader();
        this.cache = new Map();
    }

    async loadAll(onStatus) {
        const entries = Object.entries(MODEL_SPECS);
        await Promise.all(entries.map(([key, spec]) => this.load(key, spec, onStatus)));
    }

    async load(key, spec, onStatus) {
        onStatus?.(spec.label, 'caricamento');
        try {
            const gltf = await this.loader.loadAsync(spec.url);
            const normalized = normalizeModel(gltf.scene, spec.heightScale);
            normalized.name = key;
            this.cache.set(key, { spec, root: normalized });
            onStatus?.(spec.label, 'ok');
        } catch (error) {
            onStatus?.(spec.label, 'errore');
            throw error;
        }
    }

    createModel(key, options = {}) {
        const record = this.cache.get(key);
        if (!record) throw new Error(`Asset non caricato: ${key}`);
        const root = record.root.clone(true);
        root.position.set(options.x ?? 0, options.y ?? 0.05, options.z ?? 0);
        root.scale.multiplyScalar(options.heightScale ?? 1);
        root.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.frustumCulled = false;
            }
        });
        return root;
    }

    getTemplate(key) {
        const record = this.cache.get(key);
        if (!record) throw new Error(`Asset non caricato: ${key}`);
        return record.root;
    }
}

function normalizeModel(source, heightScale) {
    const root = source.clone(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = (TARGET_HEIGHT / Math.max(size.y, 1e-6)) * heightScale;

    const wrapper = new THREE.Group();
    wrapper.add(root);
    wrapper.scale.setScalar(scale);

    const scaledBox = new THREE.Box3().setFromObject(wrapper);
    const center = new THREE.Vector3();
    scaledBox.getCenter(center);
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= scaledBox.min.y;

    wrapper.position.y = 0.05;
    wrapper.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    return wrapper;
}
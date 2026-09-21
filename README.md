# Porygon-Z Benchmark — Computer Graphics (Modulo 2)

Benchmark grafico interattivo realizzato in **Three.js r160** (moduli ES6 nativi) per il corso di Computer Graphics (A.A. 2025/2026). 

Il progetto analizza in tempo reale le prestazioni del rendering standard a scene graph (**naive**) a confronto con il GPU Instancing tramite **`THREE.InstancedMesh`**, determinando in modo adattivo il carico massimo di modelli sostenibili a 60 FPS.

### 🔗 Live Demo
Il progetto è accessibile direttamente online via GitHub Pages:  
👉 **[https://gregoriocavulla.github.io/ComputerGraphics_AA2025-2026_Modulo2/](https://gregoriocavulla.github.io/ComputerGraphics_AA2025-2026_Modulo2/)**

---

![Screenshot del Benchmark](project/assets/screenshot.png)

---

### Caratteristiche Principali

* **Asset Ottimizzati:** pipeline in Blender con unificazione mesh, rimozione armature e atlas texture singolo per la famiglia Porygon e la Pokéball.
* **Ricerca Adattiva del Limite:** rilevazione del limite a 60 FPS tramite ricerca binaria automatica.
* **Profili Grafici:** modalità *Simple* (luci flat, no ombre) e modalità *Full* (materiali PBR, ombre dinamiche, riflessi e luce orbitante).
* **Pile di Risultati 3D:** visualizzazione finale a colonne dei modelli massimi registrati.
* **Zero Build Step:** funzionamento statico nativo senza bundler o installazioni.

---

### Struttura della Repository

* `index.html` — Landing page con selezione rapida tra progetto e documentazione.
* `project/` — Benchmark 3D e visualizzatore interattivo.
* `doc/` — Documentazione tecnica approfondita sulla pipeline e sull'architettura.
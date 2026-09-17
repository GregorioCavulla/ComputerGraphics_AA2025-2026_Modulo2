Contesto:
Stai lavorando nel repository di un corso di Fondamenti di Computer Graphics,
nella cartella Modulo2/Progetto_V3. Esiste già una demo funzionante
(project/index.html + project/main.js) che carica 4 modelli GLB
(Porygon, Porygon2, Porygon-Z, Pokeball) usando Three.js r160 locale
(project/lib/, con GLTFLoader, BufferGeometryUtils, OrbitControls già
disponibili). Gli asset .glb sono in project/assets/{p1,p2,pz,pokeball}/
e sono già normalizzati/verificati. Non serve ricaricare o riconvertire
gli asset.

Obiettivo:
Trasformare questa demo in un vero benchmark grafico interattivo a tema
Pokemon/Porygon-Z, con misurazioni reali, organizzato in moduli JS puliti.
Il progetto finale deve essere pubblicabile su GitHub Pages (nessuna
dipendenza da backend/build step obbligatori).

## 1. Pulizia struttura cartelle (primo step, prima di scrivere logica)

- Prima di rinominare qualunque file immagine (es. Atlas_00001.png dentro
  le cartelle asset), verifica se è referenziato come URI esterno dal
  relativo file .glb (leggendo il chunk JSON del glTF binario). Se sì,
  NON rinominarlo. Se non è referenziato (è materiale grezzo Blender/
  Sketchfab non più usato a runtime), rinominalo con prefisso punto.
- Rinomina con prefisso "." (nascondendoli, senza cancellarli) tutti i
  file/cartelle non necessari all'esecuzione runtime del progetto:
  cartelle "source/" dentro ogni asset, file .zip, file .blend/.blend1,
  cartelle di download originali (es. porygon/, porygon2/, porygon-z/,
  pokeball/ dentro le rispettive cartelle asset), eventuale credits se
  vuoi spostarlo (ma valuta di tenerlo visibile per via delle licenze
  CC-BY, oppure spostalo in doc/).
- Non rinominare né toccare i file .glb effettivamente usati da main.js,
  né i moduli in project/lib/.
- Riorganizza project/main.js in moduli ES6 separati, es.:
  project/js/core/Renderer.js       (setup renderer/scene/camera/luci)
  project/js/core/AssetLoader.js    (caricamento e cache dei GLB)
  project/js/core/Stats.js          (raccolta metriche: fps, draw call,
                                      triangoli, memoria se disponibile)
  project/js/benchmark/CpuBenchmark.js
  project/js/benchmark/GpuBenchmark.js
  project/js/benchmark/BenchmarkController.js (macchina a stati che
                                      orchestra le fasi del benchmark)
  project/js/swarm/PorygonSwarm.js  (istanziazione/pooling delle copie
                                      dei modelli, naive e instanced)
  project/js/ui/StartOverlay.js     (overlay iniziale con Pokeball)
  project/js/ui/DataPanel.js        (pannello dati/grafici, disaccoppiato
                                      dal loop di rendering principale)
  project/main.js                   (entry point, importa e collega i
                                      moduli sopra)
- Ogni modulo deve avere una responsabilità unica e chiara (niente
  monolite in main.js). Aggiungi un breve commento solo dove il codice
  da solo non spiega il "perché" di una scelta, non il "cosa fa".
- Tutti i percorsi (asset, moduli, import map) devono essere relativi
  alla cartella del progetto (niente percorsi assoluti tipo "/project/...")
  così il sito funziona sia in locale sia pubblicato su GitHub Pages,
  indipendentemente dal sotto-percorso con cui viene servito il repo.

## 2. Schermata iniziale (overlay Pokeball)

- All'avvio, la scena mostra la Pokeball da sola al centro dello schermo
  (stessa scena 3D, non una pagina HTML separata), con un overlay HTML
  ben curato sovrapposto (pointer-events mirati solo all'area cliccabile
  o a un bottone esplicito sopra la Pokeball).
- Il click sulla Pokeball (o su un bottone overlay associato) avvia la
  sequenza di benchmark: prima la fase CPU-bound, poi automaticamente
  la fase GPU-bound.
- La Pokeball è anche l'oggetto usato per il test CPU-bound (scelta
  confermata): nella fase CPU-bound viene ripetuta in molte copie in
  modalità naive (una Mesh reale per copia), proprio perché è già
  l'oggetto mostrato nella schermata iniziale, per continuità visiva
  tra overlay e primo test.
- Dopo l'avvio, l'overlay iniziale scompare o si trasforma nel pannello
  dati (vedi punto 4).

## 3. Logica di benchmark

- Test CPU-bound e GPU-bound separati concettualmente, non nella stessa
  scena.
- CPU-bound: molte copie della Pokeball, rendering naive.
- GPU-bound: pochi oggetti Porygon completi ma pesanti (shadow map alta
  risoluzione, più luci, materiali PBR pieni). NUOVA COMPLICAZIONE
  richiesta: durante il test GPU-bound la DirectionalLight ruota
  continuamente attorno al centro della scena, così le ombre ruotano
  attorno ai modelli. Questo introduce un costo aggiuntivo reale, perché
  la shadow map va ricalcolata ogni frame con una luce in movimento
  (niente cache statica della shadow map). Va misurato come parte del
  costo GPU-bound, non disattivabile durante quella fase.
- Incremento progressivo con checkpoint (1/20/60/200...) e crescita
  continua tra un checkpoint e l'altro.
- Soglia di stop FPS prudente (15-20 FPS sostenuti, non un singolo frame),
  più tetto massimo di sicurezza. Non fermarsi esattamente a 5 FPS.
- Warm-up scartato + finestra di misura per ogni step.
- Tempo di caricamento asset/compilazione shader misurato separatamente,
  fuori dal loop FPS.
- Metriche per step: FPS medi, ms/frame, draw call, triangoli, conteggio
  copie.
- Confronto naive vs InstancedMesh dove possibile (un InstancedMesh per
  materiale se il modello ne ha più di uno).
- Animazione: solo bob sinusoidale verticale leggero, niente movimento di
  parti separate.

## 4. Due finestre/pannelli separati

- Finestra principale: canvas WebGL a schermo intero dove avviene il
  render effettivo dello sciame durante i test.
- Pannello dati/grafici: overlay HTML separato (no canvas 3D condiviso)
  che mostra in tempo reale FPS, draw call, triangoli, fase corrente
  (CPU/GPU), numero di copie attuale, e un grafico semplice
  dell'andamento nel tempo (es. sparkline su <canvas> 2D leggero o SVG,
  NON un altro canvas WebGL pesante).
- Il pannello dati deve aggiornarsi a bassa frequenza (es. ogni 250-500ms,
  non ogni frame) proprio per non influire sulle prestazioni del test
  che sta misurando: separare il refresh rate della UI dal refresh rate
  del rendering 3D.
- Evita di ricalcolare o riallocare oggetti nel pannello dati dentro il
  loop di rendering principale: aggiorna un buffer/stato leggero nel loop,
  e lascia che sia il pannello (con il proprio timer separato) a leggerlo
  e disegnarlo.

## 5. Vincoli tecnici da rispettare

- Nessuna dipendenza CDN: tutto servito localmente da project/lib/ e
  project/assets/, compatibile con GitHub Pages e apertura tramite
  server statico locale (python3 -m http.server).
- Deve funzionare come pagina statica pubblicabile su GitHub Pages: solo
  HTML/CSS/JS e asset serviti da file, nessun requisito di server-side,
  nessun path assoluto legato alla macchina locale, import map e link
  relativi verificati anche da una sotto-cartella (dato che GitHub Pages
  può servire il progetto da un sotto-percorso del dominio, es.
  username.github.io/repo/...).
- Mantieni Three.js r160 (stessa revisione già presente nel repo).
- Gestisci gli errori di caricamento asset in modo visibile (già presente
  un pattern base nella demo attuale, da riusare/estendere).
- Zero memory leak: quando uno step di benchmark rimuove copie dalla
  scena (naive) o azzera un InstancedMesh, disponi geometrie/materiali
  non più referenziati con .dispose() dove necessario.
- Il codice deve restare leggibile e commentabile in sede di esame
  (Fondamenti di Computer Graphics): preferisci chiarezza a
  micro-ottimizzazioni oscure.

## 6. Cosa NON fare

- Non introdurre framework aggiuntivi (React, Vue, bundler tipo Vite):
  resta su ES6 modules nativi serviti staticamente, coerente col resto
  del repository e compatibile con GitHub Pages senza build step.
- Non animare braccia/testa/coda dei modelli in questa fase.
- Non fermare il benchmark esattamente a 5 FPS senza margine di sicurezza.
- Non mescolare test CPU-bound e GPU-bound nella stessa scena/fase.
- Non far dipendere il refresh del pannello dati dal framerate del
  rendering principale.

## 7. Scena finale esplorabile (NUOVA, dopo il benchmark)

- A benchmark completato (CPU-bound + GPU-bound), transizione a una scena
  "mista" con tutti i modelli (Porygon, Porygon2, Porygon-Z, Pokeball)
  disposti nello spazio, esplorabile liberamente in prima persona.
- Controlli camera:
  - W/A/S/D: movimento orizzontale (avanti/indietro/strafe laterale)
    relativo all'orientamento della camera.
  - Shift: scendere.
  - Spazio: salire.
- Limiti di movimento: la camera non deve mai scendere sotto il livello
  del pavimento (clamp sulla Y minima), ed eventualmente restare entro i
  limiti orizzontali della griglia/scena per non uscire nel vuoto.
- Riusare la stessa scena 3D (renderer, luci, pavimento, griglia) già
  costruita per il benchmark invece di crearne una nuova da zero, per
  continuità visiva e per non duplicare setup.
- Questa scena è puramente esplorativa/dimostrativa: non deve eseguire
  altre misurazioni di benchmark, ma può comunque mostrare le statistiche
  correnti (FPS/draw call) nel pannello dati già esistente, in modalità
  "osservazione libera" invece che "test in corso".
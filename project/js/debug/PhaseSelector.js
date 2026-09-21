const PHASES = [
    ['start', 'Start'],
    ['benchmark-simple', 'Benchmark simple'],
    ['pile-simple', 'Pile simple'],
    ['benchmark-full', 'Benchmark full'],
    ['pile-full', 'Pile full'],
];

export class PhaseSelector {
    static requested() {
        return new URLSearchParams(location.search).has('debug');
    }

    constructor(actions) {
        this.actions = actions;

        const panel = document.createElement('div');
        panel.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:50;'
            + 'display:flex;gap:4px;background:rgba(0,0,0,.85);padding:6px;pointer-events:auto;'
            + 'border:1px solid #267a70;font:11px monospace';

        for (const [key, label] of PHASES) {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.style.cssText = 'font:11px monospace;padding:5px 9px;cursor:pointer;'
                + 'background:#0d1d23;color:#dcfff6;border:1px solid #267a70;white-space:nowrap';
            btn.addEventListener('mouseenter', () => { btn.style.background = '#173139'; });
            btn.addEventListener('mouseleave', () => { btn.style.background = '#0d1d23'; });
            btn.addEventListener('click', () => this.actions[key]?.());
            panel.appendChild(btn);
        }

        document.body.appendChild(panel);
    }
}

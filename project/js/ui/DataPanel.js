export class DataPanel {
    constructor(root, stats) {
        this.root = root;
        this.stats = stats;
        this.fields = {
            phase: root.querySelector('[data-field="phase"]'),
            fps: root.querySelector('[data-field="fps"]'),
            ms: root.querySelector('[data-field="ms"]'),
            calls: root.querySelector('[data-field="calls"]'),
            triangles: root.querySelector('[data-field="triangles"]'),
            count: root.querySelector('[data-field="count"]'),
        };
        this.canvas = root.querySelector('canvas');
        this.context = this.canvas.getContext('2d');
    }

    start() {
        window.setInterval(() => this.refresh(), 300);
        this.refresh();
    }

    pushStatus(text) {
    }

    setResults(results) {
    }

    refresh() {
        const data = this.stats.snapshot();
        this.fields.phase.textContent = data.phase;
        this.fields.fps.textContent = data.fps.toFixed(1);
        this.fields.ms.textContent = data.fps > 0 ? (1000 / data.fps).toFixed(1) : '0.0';
        this.fields.calls.textContent = data.calls.toString();
        this.fields.triangles.textContent = compact(data.triangles);
        this.fields.count.textContent = data.count.toString();
        drawSparkline(this.context, this.canvas, data.samples);
    }
}

function drawSparkline(context, canvas, samples) {
    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#06151a';
    context.fillRect(0, 0, width, height);
    context.strokeStyle = '#193f48';
    context.beginPath();
    context.moveTo(0, height * 0.7);
    context.lineTo(width, height * 0.7);
    context.stroke();
    if (samples.length < 2) return;
    context.strokeStyle = '#65f2d1';
    context.lineWidth = 2;
    context.beginPath();
    samples.forEach((fps, index) => {
        const x = (index / (samples.length - 1)) * width;
        const y = height - Math.min(fps, 90) / 90 * height;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
    });
    context.stroke();
}

function compact(value) {
    if (value > 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value > 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toString();
}
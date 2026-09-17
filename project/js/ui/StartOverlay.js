export class StartOverlay {
    constructor(root) {
        this.root = root;
        this.button = root.querySelector('[data-start]');
        this.message = root.querySelector('[data-message]');
    }

    show(onStart) {
        this.root.hidden = false;
        this.button.disabled = false;
        this.button.addEventListener('click', () => onStart(this.options()), { once: true });
    }

    options() {
        return {
            benchmarkMode: 'simple',
            finalFull: true,
        };
    }

    hide() {
        this.root.hidden = true;
    }

    showError(message) {
        this.root.hidden = false;
        this.button.disabled = true;
        this.message.textContent = message;
    }
}
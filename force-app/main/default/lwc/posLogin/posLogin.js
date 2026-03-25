import { LightningElement, track } from 'lwc';

export default class PosLogin extends LightningElement {
    @track restaurantCode = 'TCH001';
    @track pin = '';

    handleCodeChange(event) {
        this.restaurantCode = event.target.value.toUpperCase();
    }

    handlePinChange(event) {
        const raw = event.target.value || '';
        this.pin = raw.replace(/\D/g, '').slice(0, 6);
    }

    handleSubmit() {
        if (!this.restaurantCode || !this.pin) return;
        this.dispatchEvent(new CustomEvent('login', {
            detail: {
                restaurantCode: this.restaurantCode,
                pin: this.pin
            }
        }));
    }

    handleKeyUp(event) {
        if (event.key === 'Enter') {
            this.handleSubmit();
        }
    }
}

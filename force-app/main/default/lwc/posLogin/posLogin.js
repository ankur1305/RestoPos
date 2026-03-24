import { LightningElement, track } from 'lwc';

export default class PosLogin extends LightningElement {
    @track restaurantCode = 'TCH001';
    @track pin = '1234';

    handleCodeChange(event) {
        this.restaurantCode = event.target.value.toUpperCase();
    }

    handlePinChange(event) {
        this.pin = event.target.value;
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

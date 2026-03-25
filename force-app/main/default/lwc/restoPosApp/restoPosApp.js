import { LightningElement, track } from 'lwc';
import getRestaurantByCode from '@salesforce/apex/RestoPosController.getRestaurantByCode';
import verifyPin from '@salesforce/apex/RestoPosController.verifyPin';
import verifyManagerPin from '@salesforce/apex/RestoPosController.verifyManagerPin';

export default class RestoPosApp extends LightningElement {
    @track currentView = 'login';
    @track restaurant;
    @track selectedTableId;
    @track selectedOrderId;
    @track receiptId;
    @track error;
    @track showManagerPinModal = false;
    @track managerPin = '';
    @track managerPinError = '';
    isLoading = false;
    shouldFocusManagerPin = false;

    get isLoginView() { return this.currentView === 'login'; }
    get isTableView() { return this.currentView === 'tables'; }
    get isOrderView() { return this.currentView === 'order'; }
    get isReceiptView() { return this.currentView === 'receipt'; }
    get isManagerView() { return this.currentView === 'manager'; }

    get restaurantName() {
        return this.restaurant ? this.restaurant.Name : 'RestoPos';
    }

    get restaurantLogoUrl() {
        return this.restaurant ? this.restaurant.Logo_URL__c : '';
    }

    connectedCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('rc');
        if (code) {
            this.loadRestaurant(code);
        }
    }

    async loadRestaurant(code) {
        try {
            this.isLoading = true;
            this.restaurant = await getRestaurantByCode({ code });
            this.error = null;
        } catch (err) {
            this.error = err.body?.message || 'Failed to load restaurant';
        } finally {
            this.isLoading = false;
        }
    }

    handleLogin(event) {
        const { restaurantCode, pin } = event.detail;
        this.handleLoginAsync(restaurantCode, pin);
    }

    async handleLoginAsync(restaurantCode, pin) {
        try {
            this.isLoading = true;
            this.error = null;
            if (!/^\d{6}$/.test(String(pin || ''))) {
                this.error = 'Staff PIN must be exactly 6 digits.';
                return;
            }
            if (!this.restaurant) {
                await this.loadRestaurant(restaurantCode);
            }
            if (!this.restaurant) return;
            const valid = await verifyPin({
                restaurantId: this.restaurant.Id,
                pin: pin
            });
            if (valid) {
                this.currentView = 'tables';
            } else {
                this.error = 'Invalid PIN. Please try again.';
            }
        } catch (err) {
            this.error = err.body?.message || 'Login failed';
        } finally {
            this.isLoading = false;
        }
    }

    handleTableSelect(event) {
        this.selectedTableId = event.detail.tableId;
        this.selectedOrderId = event.detail.orderId;
        this.currentView = 'order';
    }

    handleBackToTables() {
        this.selectedTableId = null;
        this.selectedOrderId = null;
        this.currentView = 'tables';
    }

    handleViewReceipt(event) {
        this.receiptId = event.detail.receiptId;
        this.currentView = 'receipt';
    }

    handleNavigation(event) {
        this.currentView = event.detail.view;
    }

    handleRequestManagerPin() {
        this.managerPin = '';
        this.managerPinError = '';
        this.showManagerPinModal = true;
        this.shouldFocusManagerPin = true;
    }

    handleManagerPinInput(event) {
        const raw = event.target.value || '';
        this.managerPin = raw.replace(/\D/g, '').slice(0, 6);
        this.managerPinError = '';
    }

    async submitManagerPin() {
        if (!this.restaurant?.Id) {
            this.managerPinError = 'Restaurant context missing.';
            return;
        }
        if (!this.managerPin) {
            this.managerPinError = 'Manager PIN is required.';
            return;
        }
        if (!/^\d{6}$/.test(String(this.managerPin || ''))) {
            this.managerPinError = 'Manager PIN must be exactly 6 digits.';
            return;
        }
        try {
            this.isLoading = true;
            const valid = await verifyManagerPin({
                restaurantId: this.restaurant.Id,
                managerPin: this.managerPin
            });
            if (!valid) {
                this.managerPinError = 'Invalid Manager PIN.';
                return;
            }
            this.showManagerPinModal = false;
            this.managerPin = '';
            this.managerPinError = '';
            this.currentView = 'manager';
        } catch (err) {
            this.managerPinError = err?.body?.message || 'Manager PIN verification failed.';
        } finally {
            this.isLoading = false;
        }
    }

    closeManagerPinModal() {
        this.showManagerPinModal = false;
        this.managerPin = '';
        this.managerPinError = '';
        this.shouldFocusManagerPin = false;
    }

    handleManagerPinKeyup(event) {
        if (event.key === 'Enter') {
            this.submitManagerPin();
        } else if (event.key === 'Escape') {
            this.closeManagerPinModal();
        }
    }

    handleDismissError() {
        this.error = null;
    }

    stopPropagation(event) {
        event.stopPropagation();
    }

    renderedCallback() {
        if (!this.showManagerPinModal || !this.shouldFocusManagerPin) {
            return;
        }
        const managerPinInput = this.template.querySelector('lightning-input');
        if (managerPinInput && typeof managerPinInput.focus === 'function') {
            managerPinInput.focus();
            this.shouldFocusManagerPin = false;
        }
    }
}

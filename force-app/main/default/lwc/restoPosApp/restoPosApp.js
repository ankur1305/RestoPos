import { LightningElement, track } from 'lwc';
import getRestaurantByCode from '@salesforce/apex/RestoPosController.getRestaurantByCode';
import verifyPin from '@salesforce/apex/RestoPosController.verifyPin';

export default class RestoPosApp extends LightningElement {
    @track currentView = 'login';
    @track restaurant;
    @track selectedTableId;
    @track selectedOrderId;
    @track receiptId;
    @track error;
    isLoading = false;

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

    handleDismissError() {
        this.error = null;
    }
}

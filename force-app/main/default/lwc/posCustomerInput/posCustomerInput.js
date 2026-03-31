import { LightningElement, api, track } from 'lwc';
import searchByPhone from '@salesforce/apex/CustomerController.searchByPhone';
import createCustomer from '@salesforce/apex/CustomerController.createCustomer';
import { normalizeIndianPhone, notify, extractErrorMessage } from 'c/posUtils';

export default class PosCustomerInput extends LightningElement {
    @api restaurantId;

    @track phone = '';
    @track customerName = '';
    @track customer = null;
    @track showNewForm = true;
    @track isSearching = false;
    @track searched = false;

    _searchTimeout;

    disconnectedCallback() {
        if (this._searchTimeout) {
            clearTimeout(this._searchTimeout);
        }
    }

    handlePhoneChange(event) {
        this.phone = normalizeIndianPhone(event.target.value);
        this.customer = null;
        this.showNewForm = false;
        this.searched = false;
        this.customerName = '';

        if (this._searchTimeout) {
            clearTimeout(this._searchTimeout);
        }

        if (this.phone.length === 10) {
            this._searchTimeout = setTimeout(() => {
                this.doSearch();
            }, 400);
        } else {
            this.emitCustomerState(null);
            this.showNewForm = true;
        }
    }

    async doSearch() {
        if (this.phone.length !== 10) {
            return;
        }
        try {
            this.isSearching = true;
            const result = await searchByPhone({
                restaurantId: this.restaurantId,
                phone: this.phone
            });
            this.searched = true;
            if (result) {
                this.customer = result;
                this.customerName = result.Name;
                this.emitCustomerState(result.Id);
            } else {
                this.customer = null;
                this.showNewForm = true;
                this.emitCustomerState(null);
            }
        } catch (err) {
            notify(this, 'Error', extractErrorMessage(err, 'Customer search failed.'), 'error');
        } finally {
            this.isSearching = false;
        }
    }

    handleNameChange(event) {
        this.customerName = event.target.value;
        this.emitCustomerState(this.customer?.Id || null);
    }

    async handleCreateCustomer() {
        if (!this.customerName || !String(this.customerName).trim()) return;
        if (this.phone.length !== 10) return;
        try {
            this.isSearching = true;
            this.customer = await createCustomer({
                restaurantId: this.restaurantId,
                name: this.customerName,
                phone: this.phone
            });
            this.showNewForm = false;
            this.emitCustomerState(this.customer.Id);
        } catch (err) {
            notify(this, 'Error', extractErrorMessage(err, 'Failed to create customer.'), 'error');
        } finally {
            this.isSearching = false;
        }
    }

    emitCustomerState(customerId) {
        const activePhone = this.customer?.Phone__c || this.phone;
        const phoneValid = normalizeIndianPhone(activePhone).length === 10;
        const activeName = this.customer?.Name || this.customerName;
        const nameProvided = String(activeName || '').trim().length > 0;
        this.dispatchEvent(new CustomEvent('customerchange', {
            detail: {
                customerId,
                nameProvided,
                phoneValid
            },
            bubbles: true,
            composed: true
        }));
    }

    get hasCustomer() {
        return this.customer != null;
    }

    get visitInfo() {
        if (!this.customer) return '';
        const count = this.customer.Visit_Count__c || 0;
        return count === 0 ? 'First visit' : count + ' previous visit' + (count > 1 ? 's' : '');
    }

    get isCreateDisabled() {
        return !(String(this.customerName || '').trim().length > 0 && this.phone.length === 10);
    }
}

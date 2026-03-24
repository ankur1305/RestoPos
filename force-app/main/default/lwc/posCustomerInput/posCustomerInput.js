import { LightningElement, api, track } from 'lwc';
import searchByPhone from '@salesforce/apex/CustomerController.searchByPhone';
import createCustomer from '@salesforce/apex/CustomerController.createCustomer';
import { normalizeIndianPhone } from 'c/posUtils';

export default class PosCustomerInput extends LightningElement {
    @api restaurantId;

    @track phone = '';
    @track customerName = '';
    @track customer = null;
    @track showNewForm = false;
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
            this.fireCustomerChange(null);
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
                this.fireCustomerChange(result.Id);
            } else {
                this.customer = null;
                this.showNewForm = true;
            }
        } catch (err) {
            console.error('Customer search error:', err);
        } finally {
            this.isSearching = false;
        }
    }

    handleNameChange(event) {
        this.customerName = event.target.value;
    }

    async handleCreateCustomer() {
        if (!this.customerName || this.phone.length !== 10) return;
        try {
            this.isSearching = true;
            this.customer = await createCustomer({
                restaurantId: this.restaurantId,
                name: this.customerName,
                phone: this.phone
            });
            this.showNewForm = false;
            this.fireCustomerChange(this.customer.Id);
        } catch (err) {
            console.error('Create customer error:', err);
        } finally {
            this.isSearching = false;
        }
    }

    fireCustomerChange(customerId) {
        this.dispatchEvent(new CustomEvent('customerchange', {
            detail: { customerId },
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
        return !this.customerName || this.phone.length !== 10;
    }
}

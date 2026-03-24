import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import createOrder from '@salesforce/apex/OrderController.createOrder';
import getOrder from '@salesforce/apex/OrderController.getOrder';
import addOrderItem from '@salesforce/apex/OrderController.addOrderItem';
import removeOrderItem from '@salesforce/apex/OrderController.removeOrderItem';
import updateOrderItemQuantity from '@salesforce/apex/OrderController.updateOrderItemQuantity';
import closeOrder from '@salesforce/apex/OrderController.closeOrder';
import getOrderCartSnapshot from '@salesforce/apex/OrderController.getOrderCartSnapshot';
import updateOrderStatus from '@salesforce/apex/OrderController.updateOrderStatus';
import linkCustomerToOrder from '@salesforce/apex/OrderController.linkCustomerToOrder';
import { normalizeIndianPhone } from 'c/posUtils';

export default class PosOrderScreen extends LightningElement {
    @api restaurantId;
    @api tableId;
    @api taxRate;
    @api currencyCode;
    @track order;
    @track orderItems = [];
    @track showCancelConfirm = false;
    @track mobileTab = 'menu';
    @track inlineToastMessage = '';
    @track inlineToastType = 'add';
    isLoading = false;

    _toastTimerId;

    _orderId;
    @api
    get orderId() { return this._orderId; }
    set orderId(value) {
        this._orderId = value;
        if (value) {
            this.loadOrder(value);
        }
    }

    connectedCallback() {
        this._keyHandler = (e) => {
            if (e.key === 'Escape' && this.showCancelConfirm) {
                this.handleCloseCancelConfirm();
            }
        };
        window.addEventListener('keydown', this._keyHandler);

        if (this._orderId) {
            this.loadOrder(this._orderId);
        } else {
            this.createNewOrder();
        }
    }

    disconnectedCallback() {
        if (this._toastTimerId) {
            clearTimeout(this._toastTimerId);
        }
        if (this._keyHandler) {
            window.removeEventListener('keydown', this._keyHandler);
        }
    }

    showInlineToast(message, type) {
        if (this._toastTimerId) {
            clearTimeout(this._toastTimerId);
        }
        this.inlineToastMessage = '';
        this.inlineToastType = type || 'add';
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            this.inlineToastMessage = message;
            // eslint-disable-next-line @lwc/lwc/no-async-operation
            this._toastTimerId = setTimeout(() => {
                this.inlineToastMessage = '';
            }, 2200);
        }, 10);
    }

    get inlineToastClass() {
        return 'inline-toast' + (this.inlineToastType === 'remove' ? ' inline-toast-remove' : '');
    }

    async createNewOrder() {
        try {
            this.isLoading = true;
            this.order = await createOrder({
                restaurantId: this.restaurantId,
                tableId: this.tableId,
                customerId: null
            });
            this._orderId = this.order.Id;
            this.orderItems = [];
        } catch (err) {
            console.error('Create order error:', err);
        } finally {
            this.isLoading = false;
        }
    }

    async handleCustomerChange(event) {
        const customerId = event.detail.customerId;
        if (this._orderId && customerId) {
            try {
                await linkCustomerToOrder({
                    orderId: this._orderId,
                    customerId: customerId
                });
                await this.loadOrder(this._orderId);
            } catch (err) {
                console.error('Link customer error:', err);
            }
        }
    }

    async loadOrder(orderId) {
        try {
            this.isLoading = true;
            this.order = await getOrder({ orderId });
            this.orderItems = this.order.Order_Items__r || [];
        } catch (err) {
            console.error('Load order error:', err);
        } finally {
            this.isLoading = false;
        }
    }

    applyCartSnapshot(snap) {
        if (!snap || !this.order) {
            return;
        }
        this.orderItems = snap.lineItems || [];
        this.order = {
            ...this.order,
            Subtotal__c: snap.subtotal,
            Tax_Amount__c: snap.taxAmount,
            Discount_Amount__c: snap.discountAmount,
            Discount_Percent__c: snap.discountPercent,
            Total_Amount__c: snap.totalAmount,
            Item_Count__c: snap.itemCount
        };
    }

    async refreshCartOnly() {
        const snap = await getOrderCartSnapshot({ orderId: this._orderId });
        this.applyCartSnapshot(snap);
    }

    async handleAddItem(event) {
        const { menuItemId, quantity, notes } = event.detail;
        try {
            await addOrderItem({
                orderId: this._orderId,
                menuItemId,
                quantity: quantity || 1,
                notes: notes || ''
            });
            await this.refreshCartOnly();
            this.showInlineToast('Item added to cart', 'add');
        } catch (err) {
            console.error('Add item error:', err);
        }
    }

    async handleRemoveItem(event) {
        try {
            await removeOrderItem({ orderItemId: event.detail.itemId });
            await this.refreshCartOnly();
            this.showInlineToast('Item removed', 'remove');
        } catch (err) {
            console.error('Remove item error:', err);
        }
    }

    async handleUpdateQuantity(event) {
        try {
            await updateOrderItemQuantity({
                orderItemId: event.detail.itemId,
                quantity: event.detail.quantity
            });
            await this.refreshCartOnly();
        } catch (err) {
            console.error('Update quantity error:', err);
        }
    }

    async handleGenerateBill() {
        if (!this.hasCustomer) {
            this.showToast('Customer required', 'Link a customer with a 10-digit phone before generating the bill.', 'error');
            return;
        }
        if (!this.hasValidCustomerPhone) {
            this.showToast('Phone required', 'Customer must have a valid 10-digit mobile number.', 'error');
            return;
        }
        try {
            this.isLoading = true;
            const receipt = await closeOrder({ orderId: this._orderId });
            this.dispatchEvent(new CustomEvent('viewreceipt', {
                detail: { receiptId: receipt.Id }
            }));
        } catch (err) {
            console.error('Generate bill error:', err);
            this.showToast('Error', err?.body?.message || 'Failed to generate bill.', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    handleShowCancelConfirm() {
        this.showCancelConfirm = true;
    }

    handleCloseCancelConfirm() {
        this.showCancelConfirm = false;
    }

    stopPropagation(event) {
        event.stopPropagation();
    }

    async handleCancelOrder() {
        try {
            this.isLoading = true;
            await updateOrderStatus({ orderId: this._orderId, status: 'Cancelled' });
            this.dispatchEvent(new CustomEvent('backtotables'));
        } catch (err) {
            console.error('Cancel order error:', err);
        } finally {
            this.isLoading = false;
            this.showCancelConfirm = false;
        }
    }

    handleBack() {
        this.dispatchEvent(new CustomEvent('backtotables'));
    }

    handleMobileTabMenu() {
        this.mobileTab = 'menu';
    }

    handleMobileTabCart() {
        this.mobileTab = 'cart';
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }


    get orderTotal() { return this.order?.Total_Amount__c || 0; }
    get orderSubtotal() { return this.order?.Subtotal__c || 0; }
    get taxAmount() { return this.order?.Tax_Amount__c || 0; }
    get discountAmount() { return this.order?.Discount_Amount__c || 0; }
    get discountPercent() { return this.order?.Discount_Percent__c || 0; }
    get hasDiscount() { return this.discountAmount > 0; }
    get hasItems() { return this.orderItems && this.orderItems.length > 0; }
    get noItems() { return !this.hasItems; }
    get tableName() { return this.order?.Table__r?.Name || ''; }
    get orderName() { return this.order?.Name || 'New Order'; }
    get customerName() { return this.order?.Customer__r?.Name || ''; }
    get hasCustomer() { return !!this.order?.Customer__c; }
    get hasValidCustomerPhone() {
        return normalizeIndianPhone(this.order?.Customer__r?.Phone__c).length === 10;
    }
    get customerPhoneDisplay() {
        const p = normalizeIndianPhone(this.order?.Customer__r?.Phone__c);
        return p.length === 10 ? p : '';
    }
    get canGenerateBill() {
        return this.hasItems && this.hasCustomer && this.hasValidCustomerPhone;
    }
    get generateBillDisabled() {
        return !this.canGenerateBill;
    }
    get itemCount() { return this.orderItems ? this.orderItems.length : 0; }
    get cartTabLabel() { return 'Cart (' + this.itemCount + ')'; }
    get isMenuTab() { return this.mobileTab === 'menu'; }
    get isCartTab() { return this.mobileTab === 'cart'; }
    get menuTabClass() { return 'mobile-tab' + (this.isMenuTab ? ' active' : ''); }
    get cartTabClass() { return 'mobile-tab' + (this.isCartTab ? ' active' : ''); }

    get layoutClass() {
        return 'order-layout mobile-show-' + this.mobileTab;
    }

    get formattedSubtotal() { return '₹' + this.orderSubtotal; }
    get formattedTax() { return '₹' + this.taxAmount; }
    get cgstAmount() { return this.taxAmount / 2; }
    get sgstAmount() { return this.taxAmount / 2; }
    get formattedCgst() { return '₹' + this.cgstAmount.toFixed(2); }
    get formattedSgst() { return '₹' + this.sgstAmount.toFixed(2); }
    get halfTaxRate() {
        const rate = Number(this.taxRate || 0) / 2;
        return Number.isInteger(rate) ? String(rate) : rate.toFixed(2);
    }
    get formattedDiscount() { return '-₹' + this.discountAmount; }
    get formattedTotal() { return '₹' + this.orderTotal; }

}

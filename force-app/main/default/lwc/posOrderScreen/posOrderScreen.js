import { LightningElement, api, track } from 'lwc';
import createOrder from '@salesforce/apex/OrderController.createOrder';
import getOrder from '@salesforce/apex/OrderController.getOrder';
import addOrderItem from '@salesforce/apex/OrderController.addOrderItem';
import removeOrderItem from '@salesforce/apex/OrderController.removeOrderItem';
import updateOrderItemQuantity from '@salesforce/apex/OrderController.updateOrderItemQuantity';
import closeOrder from '@salesforce/apex/OrderController.closeOrder';
import getOrderCartSnapshot from '@salesforce/apex/OrderController.getOrderCartSnapshot';
import updateOrderStatus from '@salesforce/apex/OrderController.updateOrderStatus';
import linkCustomerToOrder from '@salesforce/apex/OrderController.linkCustomerToOrder';
import unlinkCustomerFromOrder from '@salesforce/apex/OrderController.unlinkCustomerFromOrder';
import updateOrderNotes from '@salesforce/apex/OrderController.updateOrderNotes';
import { normalizeIndianPhone, notify, extractErrorMessage, createFocusTrap } from 'c/posUtils';

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
    @track showCustomerModal = false;
    @track skipCustomer = false;
    @track orderNotes = '';
    isLoading = false;

    _toastTimerId;
    _notesSaveTimerId;
    shouldFocusCancelPrimary = false;

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
        if (this._notesSaveTimerId) {
            clearTimeout(this._notesSaveTimerId);
        }
        if (this._keyHandler) {
            window.removeEventListener('keydown', this._keyHandler);
        }
        this._detachFocusTrap();
    }

    _attachFocusTrap() {
        if (this._focusTrapHandler) return;
        this._focusTrapHandler = createFocusTrap(() => this.template.querySelector('.modal-card'));
        window.addEventListener('keydown', this._focusTrapHandler);
    }

    _detachFocusTrap() {
        if (this._focusTrapHandler) {
            window.removeEventListener('keydown', this._focusTrapHandler);
            this._focusTrapHandler = null;
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

    dismissInlineToast() {
        if (this._toastTimerId) {
            clearTimeout(this._toastTimerId);
            this._toastTimerId = null;
        }
        this.inlineToastMessage = '';
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
            this.showToast('Error', extractErrorMessage(err, 'Failed to create order.'), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async handleCustomerChange(event) {
        const customerId = event.detail?.customerId || null;
        if (this._orderId && customerId) {
            try {
                await linkCustomerToOrder({
                    orderId: this._orderId,
                    customerId: customerId
                });
                await this.loadOrder(this._orderId);
                this.showCustomerModal = false;
            } catch (err) {
                this.showToast('Error', extractErrorMessage(err, 'Failed to link customer.'), 'error');
            }
        }
    }

    handleSkipCustomerChange(event) {
        this.skipCustomer = !!event.target.checked;
    }

    async handleRemoveCustomer() {
        if (!this._orderId) return;
        try {
            await unlinkCustomerFromOrder({ orderId: this._orderId });
            await this.loadOrder(this._orderId);
        } catch (err) {
            this.showToast('Error', extractErrorMessage(err, 'Failed to unlink customer.'), 'error');
        }
    }

    handleNotesChange(event) {
        this.orderNotes = event.target.value;
        if (this._notesSaveTimerId) {
            clearTimeout(this._notesSaveTimerId);
        }
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this._notesSaveTimerId = setTimeout(() => {
            this.saveOrderNotes();
        }, 800);
    }

    async saveOrderNotes() {
        if (!this._orderId) return;
        try {
            await updateOrderNotes({ orderId: this._orderId, notes: this.orderNotes });
        } catch (err) {
            this.showToast('Error', extractErrorMessage(err, 'Failed to save notes.'), 'error');
        }
    }

    openCustomerModal() {
        this.showCustomerModal = true;
        this._attachFocusTrap();
    }

    closeCustomerModal() {
        this.showCustomerModal = false;
        this._detachFocusTrap();
    }

    async loadOrder(orderId) {
        try {
            this.isLoading = true;
            this.order = await getOrder({ orderId });
            this.orderItems = this.order.Order_Items__r || [];
            this.orderNotes = this.order.Notes__c || '';
        } catch (err) {
            this.showToast('Error', extractErrorMessage(err, 'Failed to load order.'), 'error');
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
            this.showToast('Error', extractErrorMessage(err, 'Unable to add item.'), 'error');
            await this.refreshMenuBrowser();
        }
    }

    async handleRemoveItem(event) {
        try {
            await removeOrderItem({ orderItemId: event.detail.itemId });
            await this.refreshCartOnly();
            this.showInlineToast('Item removed', 'remove');
        } catch (err) {
            this.showToast('Error', extractErrorMessage(err, 'Failed to remove item.'), 'error');
        }
    }

    async refreshMenuBrowser() {
        const menuBrowser = this.template.querySelector('c-pos-menu-browser');
        if (menuBrowser && typeof menuBrowser.refreshMenu === 'function') {
            await menuBrowser.refreshMenu();
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
            this.showToast('Error', extractErrorMessage(err, 'Failed to update quantity.'), 'error');
        }
    }

    async handleAdjustItemQty(event) {
        const menuItemId = event.detail?.menuItemId;
        const delta = Number(event.detail?.delta || 0);
        if (!menuItemId || delta === 0) {
            return;
        }
        const line = (this.orderItems || []).find((item) => item.Menu_Item__c === menuItemId);
        if (delta < 0) {
            if (!line) {
                return;
            }
            const newQty = Number(line.Quantity__c || 0) - 1;
            if (newQty <= 0) {
                await this.handleRemoveItem({ detail: { itemId: line.Id } });
            } else {
                await this.handleUpdateQuantity({ detail: { itemId: line.Id, quantity: newQty } });
            }
            return;
        }
        await this.handleAddItem({ detail: { menuItemId, quantity: 1, notes: '' } });
    }

    async handleGenerateBill() {
        if (!this.canGenerateBill) {
            this.showToast('Customer details incomplete', this.generateBillBlockReason, 'error');
            return;
        }
        try {
            this.isLoading = true;
            const receipt = await closeOrder({ orderId: this._orderId });
            this.dispatchEvent(new CustomEvent('viewreceipt', {
                detail: { receiptId: receipt.Id }
            }));
        } catch (err) {
            this.showToast('Error', extractErrorMessage(err, 'Failed to generate bill.'), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    handleShowCancelConfirm() {
        this.showCancelConfirm = true;
        this.shouldFocusCancelPrimary = true;
        this._attachFocusTrap();
    }

    handleCloseCancelConfirm() {
        this.showCancelConfirm = false;
        this.shouldFocusCancelPrimary = false;
        this._detachFocusTrap();
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
            this.showToast('Error', extractErrorMessage(err, 'Failed to cancel order.'), 'error');
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
        notify(this, title, message, variant);
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
    get customerCriteriaSatisfied() {
        return this.hasCustomer || this.skipCustomer;
    }
    get canGenerateBill() {
        return this.hasItems && this.customerCriteriaSatisfied;
    }
    get generateBillDisabled() {
        return !this.canGenerateBill;
    }
    get generateBillBlockReason() {
        if (!this.hasItems) {
            return 'Add at least one item before generating the bill.';
        }
        if (!this.hasCustomer && !this.skipCustomer) {
            return 'Add customer details or check Skip to generate the bill.';
        }
        return '';
    }

    get showGenerateBillHint() {
        return this.generateBillDisabled;
    }
    get itemCount() { return this.orderItems ? this.orderItems.length : 0; }
    get cartItemQuantities() {
        const quantities = {};
        (this.orderItems || []).forEach((item) => {
            const key = item.Menu_Item__c;
            if (!key) {
                return;
            }
            quantities[key] = Number(item.Quantity__c || 0);
        });
        return quantities;
    }
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

    renderedCallback() {
        if (!this.showCancelConfirm || !this.shouldFocusCancelPrimary) {
            return;
        }
        const confirmBtn = this.template.querySelector('.cancel-confirm-primary');
        if (confirmBtn && typeof confirmBtn.focus === 'function') {
            confirmBtn.focus();
            this.shouldFocusCancelPrimary = false;
        }
    }

}

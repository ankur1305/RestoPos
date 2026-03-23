import { LightningElement, api, track } from 'lwc';
import createOrder from '@salesforce/apex/OrderController.createOrder';
import getOrder from '@salesforce/apex/OrderController.getOrder';
import addOrderItem from '@salesforce/apex/OrderController.addOrderItem';
import removeOrderItem from '@salesforce/apex/OrderController.removeOrderItem';
import updateOrderItemQuantity from '@salesforce/apex/OrderController.updateOrderItemQuantity';
import closeOrder from '@salesforce/apex/OrderController.closeOrder';
import updateOrderStatus from '@salesforce/apex/OrderController.updateOrderStatus';

export default class PosOrderScreen extends LightningElement {
    @api restaurantId;
    @api tableId;
    @api taxRate;
    @api currencyCode;
    @track order;
    @track orderItems = [];
    @track showCancelConfirm = false;
    isLoading = false;

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
        if (this._orderId) {
            this.loadOrder(this._orderId);
        } else {
            this.createNewOrder();
        }
    }

    async createNewOrder() {
        try {
            this.isLoading = true;
            this.order = await createOrder({
                restaurantId: this.restaurantId,
                tableId: this.tableId
            });
            this._orderId = this.order.Id;
            this.orderItems = [];
        } catch (err) {
            console.error('Create order error:', err);
        } finally {
            this.isLoading = false;
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

    async handleAddItem(event) {
        const { menuItemId, quantity, notes } = event.detail;
        try {
            await addOrderItem({
                orderId: this._orderId,
                menuItemId,
                quantity: quantity || 1,
                notes: notes || ''
            });
            await this.loadOrder(this._orderId);
        } catch (err) {
            console.error('Add item error:', err);
        }
    }

    async handleRemoveItem(event) {
        try {
            await removeOrderItem({ orderItemId: event.detail.itemId });
            await this.loadOrder(this._orderId);
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
            await this.loadOrder(this._orderId);
        } catch (err) {
            console.error('Update quantity error:', err);
        }
    }

    async handleGenerateBill() {
        try {
            this.isLoading = true;
            const receipt = await closeOrder({ orderId: this._orderId });
            this.dispatchEvent(new CustomEvent('viewreceipt', {
                detail: { receiptId: receipt.Id }
            }));
        } catch (err) {
            console.error('Generate bill error:', err);
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

    get formattedSubtotal() { return '₹' + this.orderSubtotal; }
    get formattedTax() { return '₹' + this.taxAmount; }
    get formattedDiscount() { return '-₹' + this.discountAmount; }
    get formattedTotal() { return '₹' + this.orderTotal; }
}

import { LightningElement, api, track } from 'lwc';
import getReceiptData from '@salesforce/apex/ReceiptController.getReceiptData';

export default class PosReceipt extends LightningElement {
    @api receiptId;
    @track receipt;
    @track items = [];
    isLoading = true;

    connectedCallback() {
        this.loadReceipt();
    }

    async loadReceipt() {
        try {
            const result = await getReceiptData({ receiptId: this.receiptId });
            this.receipt = result.receipt;
            this.items = result.items;
        } catch (err) {
            console.error('Receipt load error:', err);
        } finally {
            this.isLoading = false;
        }
    }

    handlePrint() {
        const receiptEl = this.template.querySelector('.receipt-paper');
        if (!receiptEl) return;
        const printWindow = window.open('', '_blank', 'width=350,height=600');
        printWindow.document.write(
            '<html><head><title>Receipt</title>' +
            '<style>' +
            'body{font-family:"Courier New",monospace;max-width:280px;margin:0 auto;padding:10px;font-size:12px;color:#000}' +
            '.center{text-align:center}' +
            '.line{border-top:1px dashed #000;margin:8px 0}' +
            '.row{display:flex;justify-content:space-between;margin:2px 0}' +
            '.bold{font-weight:bold}' +
            'h2,h3{margin:4px 0}' +
            'p{margin:2px 0}' +
            '.items-table{width:100%}' +
            '.items-table td{padding:1px 0}' +
            '.items-table .right{text-align:right}' +
            '@media print{body{margin:0}}' +
            '</style></head><body>' +
            receiptEl.innerHTML +
            '</body></html>'
        );
        printWindow.document.close();
        setTimeout(function() { printWindow.print(); }, 250);
    }

    handleBack() {
        this.dispatchEvent(new CustomEvent('backtotables'));
    }

    get restaurantName() { return this.receipt?.Restaurant__r?.Name || ''; }
    get restaurantAddress() { return this.receipt?.Restaurant__r?.Address__c || ''; }
    get restaurantPhone() { return this.receipt?.Restaurant__r?.Phone__c || ''; }
    get receiptNumber() { return this.receipt?.Receipt_Number__c || ''; }
    get orderNumber() { return this.receipt?.POS_Order__r?.Name || ''; }
    get tableName() { return this.receipt?.POS_Order__r?.Table__r?.Name || ''; }
    get customerName() { return this.receipt?.POS_Order__r?.Customer__r?.Name || ''; }
    get customerPhone() { return this.receipt?.POS_Order__r?.Customer__r?.Phone__c || ''; }
    get hasCustomer() { return !!this.customerName; }
    get formattedSubtotal() { return '₹' + (this.receipt?.Subtotal__c || 0); }
    get formattedTax() { return '₹' + (this.receipt?.Tax_Amount__c || 0); }
    get formattedDiscount() { return '-₹' + (this.receipt?.Discount_Amount__c || 0); }
    get formattedTotal() { return '₹' + (this.receipt?.Total_Amount__c || 0); }
    get hasDiscount() { return (this.receipt?.Discount_Amount__c || 0) > 0; }

    get formattedDate() {
        if (!this.receipt?.Generated_DateTime__c) return '';
        return new Date(this.receipt.Generated_DateTime__c).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        });
    }

    get formattedItems() {
        return (this.items || []).map(item => ({
            ...item,
            formattedLineTotal: '₹' + (item.Line_Total__c || 0)
        }));
    }
}

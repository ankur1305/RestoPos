import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getReceiptData from '@salesforce/apex/ReceiptController.getReceiptData';
import getReceiptPdfBase64 from '@salesforce/apex/ReceiptController.getReceiptPdfBase64';

export default class PosReceipt extends LightningElement {
    _receiptId;
    @track receipt;
    @track items = [];
    isLoading = true;
    downloadFormatInProgress = null;

    @api
    get receiptId() {
        return this._receiptId;
    }
    set receiptId(value) {
        this._receiptId = value;
        if (value) {
            this.loadReceipt();
        }
    }

    async loadReceipt() {
        this.isLoading = true;
        try {
            const result = await getReceiptData({ receiptId: this.receiptId });
            if (result) {
                this.receipt = result.receipt;
                this.items = result.items || [];
            }
        } catch (err) {
            console.error('Receipt load error:', err);
            this.showToast('Error', 'Failed to load receipt data.', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    handleDownloadReceipt() {
        this.startReceiptDownload('a4');
    }

    handleDownloadThermalReceipt() {
        this.startReceiptDownload('thermal');
    }

    /**
     * Open a blank tab on click (user gesture), then fill it with the PDF blob so Lightning does not block the download.
     */
    startReceiptDownload(format) {
        if (!this.receiptId) {
            this.showToast('Error', 'Receipt is not loaded yet.', 'error');
            return;
        }
        const popup = window.open('', '_blank');
        if (!popup || popup.closed) {
            this.showToast('Error', 'Allow pop-ups to open the receipt PDF.', 'error');
            return;
        }

        this.downloadFormatInProgress = format;
        getReceiptPdfBase64({ receiptId: this.receiptId, format })
            .then((base64) => {
                const blob = this.base64ToPdfBlob(base64);
                const url = URL.createObjectURL(blob);
                popup.location.href = url;
                popup.focus();
                window.setTimeout(() => URL.revokeObjectURL(url), 60000);
            })
            .catch((error) => {
                try {
                    popup.close();
                } catch (ignore) {
                    /* ignore */
                }
                console.error('Receipt download error:', error);
                this.showToast('Error', this.getDownloadErrorMessage(error), 'error');
            })
            .finally(() => {
                window.setTimeout(() => {
                    this.downloadFormatInProgress = null;
                }, 250);
            });
    }

    base64ToPdfBlob(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return new Blob([bytes], { type: 'application/pdf' });
    }

    getDownloadErrorMessage(error) {
        const raw = error?.body?.message;
        if (Array.isArray(raw)) {
            return raw.join(' ');
        }
        if (typeof raw === 'string') {
            return raw;
        }
        return error?.message || 'Could not generate the receipt PDF.';
    }

    handleBack() {
        this.dispatchEvent(new CustomEvent('backtotables'));
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant
            })
        );
    }

    get restaurantName() {
        return this.receipt?.Restaurant__r?.Name || '';
    }
    get restaurantAddress() {
        return this.receipt?.Restaurant__r?.Address__c || '';
    }
    get restaurantPhone() {
        return this.receipt?.Restaurant__r?.Phone__c || '';
    }
    get receiptNumber() {
        return this.receipt?.Receipt_Number__c || '';
    }
    get orderNumber() {
        return this.receipt?.POS_Order__r?.Name || '';
    }
    get tableName() {
        return this.receipt?.POS_Order__r?.Table__r?.Name || '';
    }
    get customerName() {
        return this.receipt?.POS_Order__r?.Customer__r?.Name || '';
    }
    get customerPhone() {
        return this.receipt?.POS_Order__r?.Customer__r?.Phone__c || '';
    }
    get hasCustomer() {
        return !!this.customerName;
    }
    get formattedSubtotal() {
        return '₹' + (this.receipt?.Subtotal__c || 0);
    }
    get formattedTax() {
        return '₹' + (this.receipt?.Tax_Amount__c || 0);
    }
    get formattedDiscount() {
        return '-₹' + (this.receipt?.Discount_Amount__c || 0);
    }
    get formattedTotal() {
        return '₹' + (this.receipt?.Total_Amount__c || 0);
    }
    get hasDiscount() {
        return (this.receipt?.Discount_Amount__c || 0) > 0;
    }

    get isDownloadingAny() {
        return !!this.downloadFormatInProgress;
    }

    get isDownloadingA4() {
        return this.downloadFormatInProgress === 'a4';
    }

    get isDownloadingThermal() {
        return this.downloadFormatInProgress === 'thermal';
    }

    get formattedDate() {
        if (!this.receipt?.Generated_DateTime__c) return '';
        return new Date(this.receipt.Generated_DateTime__c).toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }

    get formattedItems() {
        return (this.items || []).map((item) => ({
            ...item,
            formattedLineTotal: '₹' + (item.Line_Total__c || 0)
        }));
    }
}

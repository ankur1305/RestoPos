import { LightningElement, api } from 'lwc';

export default class PosOrderItem extends LightningElement {
    @api item;
    @api currencyCode;

    get formattedPrice() {
        return '₹' + (this.item.Line_Total__c || 0);
    }

    get unitPrice() {
        return '₹' + (this.item.Unit_Price__c || 0);
    }

    handleIncrement() {
        this.dispatchEvent(new CustomEvent('updatequantity', {
            detail: {
                itemId: this.item.Id,
                quantity: (this.item.Quantity__c || 1) + 1
            },
            bubbles: true,
            composed: true
        }));
    }

    handleDecrement() {
        const newQty = (this.item.Quantity__c || 1) - 1;
        if (newQty <= 0) {
            this.handleRemove();
        } else {
            this.dispatchEvent(new CustomEvent('updatequantity', {
                detail: {
                    itemId: this.item.Id,
                    quantity: newQty
                },
                bubbles: true,
                composed: true
            }));
        }
    }

    handleRemove() {
        this.dispatchEvent(new CustomEvent('removeitem', {
            detail: { itemId: this.item.Id },
            bubbles: true,
            composed: true
        }));
    }
}

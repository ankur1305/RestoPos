public without sharing class ReceiptPdfController {
    public Receipt__c receipt { get; private set; }
    public List<LineRow> lines { get; private set; }
    public String orderName { get; private set; }
    public String tableName { get; private set; }
    public String restaurantName { get; private set; }
    public String restaurantAddress { get; private set; }
    public String restaurantPhone { get; private set; }
    public ReceiptPdfController() {
        lines = new List<LineRow>();
        orderName = '';
        tableName = '';
        restaurantName = '';
        restaurantAddress = '';
        restaurantPhone = '';
        Id rid;
        try {
            String idParam = ApexPages.currentPage().getParameters().get('id');
            if (String.isBlank(idParam)) {
                return;
            }
            rid = (Id) idParam;
        } catch (Exception e) {
            return;
        }
        load(rid);
    }

    private void load(Id receiptId) {
        List<Receipt__c> recs = [
            SELECT Id, Receipt_Number__c, Generated_DateTime__c,
                   Subtotal__c, Tax_Amount__c, Discount_Amount__c, Total_Amount__c,
                   POS_Order__c, POS_Order__r.Name,
                   POS_Order__r.Table__r.Name,
                   POS_Order__r.Customer__r.Name,
                   POS_Order__r.Customer__r.Phone__c,
                   Restaurant__r.Name, Restaurant__r.Address__c, Restaurant__r.Phone__c
            FROM Receipt__c
            WHERE Id = :receiptId
            LIMIT 1
        ];
        if (recs.isEmpty()) {
            receipt = null;
            return;
        }
        receipt = recs[0];
        orderName = receipt.POS_Order__r != null ? receipt.POS_Order__r.Name : '';
        if (receipt.POS_Order__r != null && receipt.POS_Order__r.Table__r != null) {
            tableName = receipt.POS_Order__r.Table__r.Name;
        } else {
            tableName = '';
        }
        restaurantName = '';
        restaurantAddress = '';
        restaurantPhone = '';
        if (receipt.Restaurant__r != null) {
            restaurantName = receipt.Restaurant__r.Name;
            restaurantAddress = receipt.Restaurant__r.Address__c;
            restaurantPhone = receipt.Restaurant__r.Phone__c;
        }
        List<Order_Item__c> items = [
            SELECT Item_Name__c, Quantity__c, Line_Total__c
            FROM Order_Item__c
            WHERE POS_Order__c = :receipt.POS_Order__c
              AND Status__c != 'Cancelled'
            ORDER BY CreatedDate ASC
        ];
        for (Order_Item__c oi : items) {
            Decimal lt = oi.Line_Total__c == null ? 0 : oi.Line_Total__c;
            lines.add(
                new LineRow(
                    oi.Item_Name__c,
                    oi.Quantity__c == null ? 0 : oi.Quantity__c,
                    fmt(lt)
                )
            );
        }
    }

    public Boolean getHasReceipt() {
        return receipt != null;
    }

    public Boolean getHasCustomer() {
        return receipt != null
            && receipt.POS_Order__r != null
            && receipt.POS_Order__r.Customer__r != null
            && !String.isBlank(receipt.POS_Order__r.Customer__r.Name);
    }

    public Boolean getHasDiscount() {
        return receipt != null
            && receipt.Discount_Amount__c != null
            && receipt.Discount_Amount__c > 0;
    }

    public Boolean getHasRestaurantPhone() {
        return !String.isBlank(restaurantPhone);
    }

    public String getFormattedDate() {
        if (receipt == null || receipt.Generated_DateTime__c == null) {
            return '';
        }
        return receipt.Generated_DateTime__c.format('dd MMM yyyy, hh:mm a');
    }

    public String getFmtSubtotal() {
        return fmt(receipt == null ? null : receipt.Subtotal__c);
    }

    public String getFmtTax() {
        return fmt(receipt == null ? null : receipt.Tax_Amount__c);
    }

    public String getFmtCgst() {
        Decimal tax = receipt == null || receipt.Tax_Amount__c == null ? 0 : receipt.Tax_Amount__c;
        return fmt(tax / 2);
    }

    public String getFmtSgst() {
        Decimal tax = receipt == null || receipt.Tax_Amount__c == null ? 0 : receipt.Tax_Amount__c;
        return fmt(tax / 2);
    }

    public String getFmtDiscount() {
        if (receipt == null || receipt.Discount_Amount__c == null) {
            return '₹0.00';
        }
        return '-' + fmt(receipt.Discount_Amount__c);
    }

    public String getFmtTotal() {
        return fmt(receipt == null ? null : receipt.Total_Amount__c);
    }

    private static String fmt(Decimal d) {
        if (d == null) {
            return '₹0.00';
        }
        return '₹' + d.setScale(2).format();
    }

    public class LineRow {
        public String itemName { get; set; }
        public Decimal quantity { get; set; }
        public String amount { get; set; }

        public LineRow(String itemName, Decimal quantity, String amount) {
            this.itemName = itemName;
            this.quantity = quantity;
            this.amount = amount;
        }
    }
}

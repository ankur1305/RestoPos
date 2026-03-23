public without sharing class ReceiptController {

    @AuraEnabled
    public static Receipt__c generateReceipt(String orderId) {
        POS_Order__c ord = [
            SELECT Id, Name, Subtotal__c, Tax_Amount__c,
                   Discount_Amount__c, Total_Amount__c,
                   Restaurant__c
            FROM POS_Order__c
            WHERE Id = :orderId
        ];

        Receipt__c receipt = new Receipt__c(
            POS_Order__c = orderId,
            Restaurant__c = ord.Restaurant__c,
            Receipt_Number__c = 'R-' + String.valueOf(Datetime.now().getTime()),
            Generated_DateTime__c = Datetime.now(),
            Subtotal__c = ord.Subtotal__c,
            Tax_Amount__c = ord.Tax_Amount__c,
            Discount_Amount__c = ord.Discount_Amount__c,
            Total_Amount__c = ord.Total_Amount__c
        );
        insert receipt;

        return [
            SELECT Id, Name, Receipt_Number__c, Generated_DateTime__c,
                   Subtotal__c, Tax_Amount__c, Discount_Amount__c,
                   Total_Amount__c,
                   POS_Order__r.Name, POS_Order__r.Table__r.Name,
                   POS_Order__r.Order_DateTime__c,
                   POS_Order__r.Customer_Name__c,
                   Restaurant__r.Name, Restaurant__r.Address__c,
                   Restaurant__r.Phone__c, Restaurant__r.Logo_URL__c
            FROM Receipt__c
            WHERE Id = :receipt.Id
        ];
    }

    @AuraEnabled
    public static Map<String, Object> getReceiptData(String receiptId) {
        Receipt__c receipt = [
            SELECT Id, Name, Receipt_Number__c, Generated_DateTime__c,
                   Subtotal__c, Tax_Amount__c, Discount_Amount__c,
                   Total_Amount__c,
                   POS_Order__c, POS_Order__r.Name,
                   POS_Order__r.Table__r.Name,
                   POS_Order__r.Order_DateTime__c,
                   POS_Order__r.Customer__r.Name,
                   POS_Order__r.Customer__r.Phone__c,
                   Restaurant__r.Name, Restaurant__r.Address__c,
                   Restaurant__r.Phone__c, Restaurant__r.Logo_URL__c,
                   Restaurant__r.Tax_Rate__c
            FROM Receipt__c
            WHERE Id = :receiptId
        ];

        List<Order_Item__c> items = [
            SELECT Item_Name__c, Quantity__c, Unit_Price__c, Line_Total__c
            FROM Order_Item__c
            WHERE POS_Order__c = :receipt.POS_Order__c
              AND Status__c != 'Cancelled'
            ORDER BY CreatedDate ASC
        ];

        Map<String, Object> result = new Map<String, Object>();
        result.put('receipt', receipt);
        result.put('items', items);
        return result;
    }
}

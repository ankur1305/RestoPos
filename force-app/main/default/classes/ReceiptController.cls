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

        if (!Test.isRunningTest()) {
            System.enqueueJob(new WhatsAppReceiptQueueable(receipt.Id));
        }

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

    /**
     * Renders the requested receipt page as PDF and returns base64 for LWC download.
     */
    @AuraEnabled
    public static String getReceiptPdfBase64(String receiptId, String format) {
        if (String.isBlank(receiptId)) {
            throw new AuraHandledException('Receipt id is required.');
        }
        Id rid;
        try {
            rid = (Id) receiptId;
        } catch (Exception e) {
            throw new AuraHandledException('Invalid receipt id.');
        }
        List<Receipt__c> exists = [SELECT Id FROM Receipt__c WHERE Id = :rid LIMIT 1];
        if (exists.isEmpty()) {
            throw new AuraHandledException('Receipt was not found.');
        }

        Blob pdfBlob = getReceiptPdfBlob(rid, format);

        if (!Test.isRunningTest() && (pdfBlob == null || pdfBlob.size() < 100)) {
            throw new AuraHandledException('Could not generate the receipt PDF.');
        }

        return EncodingUtil.base64Encode(pdfBlob);
    }

    /**
     * Shared PDF blob for download (LWC) and WhatsApp (Queueable).
     */
    public static Blob getReceiptPdfBlob(Id receiptId) {
        return getReceiptPdfBlob(receiptId, 'a4');
    }

    public static Blob getReceiptPdfBlob(Id receiptId, String format) {
        Boolean isThermal = 'thermal'.equalsIgnoreCase(format);
        // HTML Visualforce only — getContentAsPDF() must not target pages with renderAs="pdf".
        PageReference pdfPage = isThermal ? Page.ReceiptThermalPdf : Page.ReceiptPdf;
        pdfPage.getParameters().put('id', String.valueOf(receiptId));
        if (isThermal) {
            pdfPage.getParameters().put('format', 'thermal');
        }
        if (Test.isRunningTest()) {
            return Blob.valueOf('%PDF-1.4');
        }
        return pdfPage.getContentAsPDF();
    }
}

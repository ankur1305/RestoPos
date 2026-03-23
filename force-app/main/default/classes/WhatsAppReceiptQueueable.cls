/**
 * Sends receipt PDF via Meta WhatsApp when order has opt-in and customer has a valid 10-digit phone.
 * Success/failure is stored on Receipt__c.WhatsApp_Last_Status__c when possible (helps guest Experience sites where debug logs are unavailable).
 */
public without sharing class WhatsAppReceiptQueueable implements Queueable, Database.AllowsCallouts {
    private Id receiptId;

    public WhatsAppReceiptQueueable(Id receiptId) {
        this.receiptId = receiptId;
    }

    public void execute(QueueableContext context) {
        if (receiptId == null) {
            return;
        }

        List<Receipt__c> receipts = [
            SELECT
                Id,
                Receipt_Number__c,
                Restaurant__r.Name,
                POS_Order__r.WhatsApp_Receipt_Opt_In__c,
                POS_Order__r.Customer__c,
                POS_Order__r.Customer__r.Phone__c
            FROM Receipt__c
            WHERE Id = :receiptId
            LIMIT 1
        ];
        if (receipts.isEmpty()) {
            return;
        }
        Receipt__c rec = receipts[0];

        if (rec.POS_Order__r == null || rec.POS_Order__r.WhatsApp_Receipt_Opt_In__c != true) {
            return;
        }
        if (rec.POS_Order__r.Customer__c == null) {
            return;
        }
        String phone = rec.POS_Order__r.Customer__r != null ? rec.POS_Order__r.Customer__r.Phone__c : null;
        if (!MetaWhatsAppService.isTenDigitPhone(phone)) {
            return;
        }

        try {
            Blob pdf = ReceiptController.getReceiptPdfBlob(rec.Id);
            String fileName =
                'Receipt-' +
                (String.isNotBlank(rec.Receipt_Number__c)
                    ? rec.Receipt_Number__c.replaceAll('[^a-zA-Z0-9\\-_]', '_')
                    : String.valueOf(rec.Id).substring(0, 8)) +
                '.pdf';
            String restaurantName = rec.Restaurant__r != null ? rec.Restaurant__r.Name : '';
            MetaWhatsAppService.sendReceiptPdf(phone, pdf, restaurantName, fileName);
            persistWhatsAppStatus(
                rec.Id,
                'WhatsApp sent ' + Datetime.now().formatGmt('yyyy-MM-dd HH:mm') + ' UTC'
            );
        } catch (Exception e) {
            System.debug(
                LoggingLevel.WARN,
                'WhatsApp receipt skipped/failed for ' + receiptId + ': ' + e.getMessage()
            );
            persistWhatsAppStatus(rec.Id, 'Failed: ' + e.getMessage());
        }
    }

    private static void persistWhatsAppStatus(Id receiptId, String message) {
        if (receiptId == null || String.isBlank(message)) {
            return;
        }
        String msg = message.length() > 1000 ? message.substring(0, 1000) : message;
        try {
            update new Receipt__c(Id = receiptId, WhatsApp_Last_Status__c = msg);
        } catch (Exception ignore) {
            System.debug(
                LoggingLevel.WARN,
                'Could not persist WhatsApp_Last_Status__c: ' + ignore.getMessage()
            );
        }
    }
}

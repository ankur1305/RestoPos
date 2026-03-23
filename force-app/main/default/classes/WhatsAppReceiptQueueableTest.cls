@IsTest
private class WhatsAppReceiptQueueableTest {

    @TestSetup
    static void setup() {
        Restaurant__c r = RestoPosTestFactory.createRestaurant();
        RestoPosTestFactory.createTables(r.Id, 2);
        Menu_Category__c cat = RestoPosTestFactory.createCategory(r.Id, 'Main');
        RestoPosTestFactory.createMenuItem(r.Id, cat.Id, 'Dish', 100);
    }

    @IsTest
    static void queueableRunsWithoutErrorWhenWhatsAppInactive() {
        Restaurant__c r = [SELECT Id FROM Restaurant__c LIMIT 1];
        Restaurant_Table__c t = [SELECT Id FROM Restaurant_Table__c LIMIT 1];
        Menu_Item__c mi = [SELECT Id FROM Menu_Item__c LIMIT 1];

        POS_Order__c ord = OrderController.createOrder(r.Id, t.Id, null);
        OrderController.addOrderItem(ord.Id, mi.Id, 1, '');
        Customer__c cust = new Customer__c(
            Name = 'Walk In',
            Phone__c = '9876543210',
            Restaurant__c = r.Id,
            Visit_Count__c = 0
        );
        insert cust;
        OrderController.linkCustomerToOrder(ord.Id, cust.Id);
        OrderController.updateOrderWhatsAppOptIn(ord.Id, true);

        Receipt__c receipt = ReceiptController.generateReceipt(ord.Id);

        Test.startTest();
        System.enqueueJob(new WhatsAppReceiptQueueable(receipt.Id));
        Test.stopTest();

        Receipt__c after = [
            SELECT WhatsApp_Last_Status__c
            FROM Receipt__c
            WHERE Id = :receipt.Id
        ];
        System.assert(
            String.isNotBlank(after.WhatsApp_Last_Status__c),
            'WhatsApp_Last_Status__c should be set after queueable runs'
        );
    }
}

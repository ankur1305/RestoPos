@IsTest
private class ReceiptControllerTest {

    @TestSetup
    static void setup() {
        Restaurant__c r = RestoPosTestFactory.createRestaurant();
        RestoPosTestFactory.createTables(r.Id, 2);
        Menu_Category__c cat = RestoPosTestFactory.createCategory(r.Id, 'Main');
        RestoPosTestFactory.createMenuItem(r.Id, cat.Id, 'Test Dish', 150);
    }

    @IsTest
    static void testGenerateReceipt() {
        Restaurant__c r = [SELECT Id FROM Restaurant__c LIMIT 1];
        Restaurant_Table__c t = [SELECT Id FROM Restaurant_Table__c LIMIT 1];
        Menu_Item__c mi = [SELECT Id FROM Menu_Item__c LIMIT 1];

        POS_Order__c ord = OrderController.createOrder(r.Id, t.Id, null);
        OrderController.addOrderItem(ord.Id, mi.Id, 2, '');

        Test.startTest();
        Receipt__c receipt = ReceiptController.generateReceipt(ord.Id);
        Test.stopTest();

        System.assertNotEquals(null, receipt.Id);
        System.assertNotEquals(null, receipt.Receipt_Number__c);
        System.assertEquals(300, receipt.Subtotal__c);
    }

    @IsTest
    static void testGetReceiptData() {
        Restaurant__c r = [SELECT Id FROM Restaurant__c LIMIT 1];
        Restaurant_Table__c t = [SELECT Id FROM Restaurant_Table__c LIMIT 1];
        Menu_Item__c mi = [SELECT Id FROM Menu_Item__c LIMIT 1];

        POS_Order__c ord = OrderController.createOrder(r.Id, t.Id, null);
        OrderController.addOrderItem(ord.Id, mi.Id, 1, '');
        Receipt__c receipt = ReceiptController.generateReceipt(ord.Id);

        Test.startTest();
        Map<String, Object> data = ReceiptController.getReceiptData(receipt.Id);
        Test.stopTest();

        System.assertNotEquals(null, data.get('receipt'));
        List<Order_Item__c> items = (List<Order_Item__c>)data.get('items');
        System.assertEquals(1, items.size());
    }
}

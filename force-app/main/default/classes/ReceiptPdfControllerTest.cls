@IsTest
private class ReceiptPdfControllerTest {

    @TestSetup
    static void setup() {
        Restaurant__c r = RestoPosTestFactory.createRestaurant();
        RestoPosTestFactory.createTables(r.Id, 2);
        Menu_Category__c cat = RestoPosTestFactory.createCategory(r.Id, 'Main');
        RestoPosTestFactory.createMenuItem(r.Id, cat.Id, 'Test Dish', 150);
    }

    @IsTest
    static void controllerLoadsReceiptForPdfPage() {
        Restaurant__c r = [SELECT Id FROM Restaurant__c LIMIT 1];
        Restaurant_Table__c t = [SELECT Id FROM Restaurant_Table__c LIMIT 1];
        Menu_Item__c mi = [SELECT Id FROM Menu_Item__c LIMIT 1];

        POS_Order__c ord = OrderController.createOrder(r.Id, t.Id, null);
        OrderController.addOrderItem(ord.Id, mi.Id, 2, '');
        Receipt__c receipt = ReceiptController.generateReceipt(ord.Id);

        PageReference pr = Page.ReceiptPdf;
        pr.getParameters().put('id', receipt.Id);
        Test.setCurrentPage(pr);

        ReceiptPdfController ctrl = new ReceiptPdfController();

        System.assertEquals(true, ctrl.getHasReceipt());
        System.assertEquals(1, ctrl.lines.size());
        System.assertNotEquals(null, ctrl.getFormattedDate());
        System.assertNotEquals(null, ctrl.getFmtSubtotal());
        System.assertNotEquals(null, ctrl.getFmtTax());
        System.assertNotEquals(null, ctrl.getFmtDiscount());
        System.assertNotEquals(null, ctrl.getFmtTotal());
        System.assertEquals(false, ctrl.getHasCustomer());
        System.assertEquals(false, ctrl.getHasDiscount());
        System.assertNotEquals(null, ctrl.getHasRestaurantPhone());

        receipt.Discount_Amount__c = 10;
        update receipt;
        Test.setCurrentPage(pr);
        ctrl = new ReceiptPdfController();
        System.assertEquals(true, ctrl.getHasDiscount());
    }

    @IsTest
    static void controllerHandlesMissingId() {
        PageReference pr = Page.ReceiptPdf;
        Test.setCurrentPage(pr);

        ReceiptPdfController ctrl = new ReceiptPdfController();

        System.assertEquals(false, ctrl.getHasReceipt());
    }

    @IsTest
    static void controllerHandlesInvalidIdParameter() {
        PageReference pr = Page.ReceiptPdf;
        pr.getParameters().put('id', 'x');
        Test.setCurrentPage(pr);

        ReceiptPdfController ctrl = new ReceiptPdfController();

        System.assertEquals(false, ctrl.getHasReceipt());
    }
}

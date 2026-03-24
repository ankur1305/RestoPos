@IsTest
private class ManagerReportControllerTest {
    @TestSetup
    static void setupData() {
        Restaurant__c restaurant = RestoPosTestFactory.createRestaurant();
        Restaurant_Table__c tableRec = RestoPosTestFactory.createTables(restaurant.Id, 1)[0];
        Menu_Category__c cat = RestoPosTestFactory.createCategory(restaurant.Id, 'Main');
        Menu_Item__c item = RestoPosTestFactory.createMenuItem(restaurant.Id, cat.Id, 'Test Curry', 100);

        POS_Order__c orderRec = OrderController.createOrder(restaurant.Id, tableRec.Id, null);
        OrderController.addOrderItem(orderRec.Id, item.Id, 2, null);
        update new POS_Order__c(
            Id = orderRec.Id,
            Status__c = 'Closed',
            Order_DateTime__c = Datetime.now(),
            Discount_Amount__c = 10
        );
    }

    @IsTest
    static void testGetManagerReport() {
        Restaurant__c restaurant = [SELECT Id FROM Restaurant__c LIMIT 1];
        Test.startTest();
        ManagerReportController.ReportPayload reportData = ManagerReportController.getManagerReport(
            restaurant.Id,
            Date.today().addDays(-1),
            Date.today().addDays(1),
            'custom',
            null,
            null,
            false
        );
        Test.stopTest();

        System.assert(reportData.summary.orderCount >= 1);
        System.assertNotEquals(null, reportData.summary.revenue);
        System.assert(reportData.topItems.size() >= 1);
        System.assertNotEquals(null, reportData.categoryMix);
        System.assertNotEquals(null, reportData.paymentMix);
    }
}

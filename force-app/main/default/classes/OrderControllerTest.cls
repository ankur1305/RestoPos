@IsTest
private class OrderControllerTest {

    @TestSetup
    static void setup() {
        Restaurant__c r = RestoPosTestFactory.createRestaurant();
        List<Restaurant_Table__c> tables = RestoPosTestFactory.createTables(r.Id, 5);
        for (Restaurant_Table__c t : tables) {
            t.Status__c = 'Occupied';
        }
        update tables;
        Menu_Category__c cat = RestoPosTestFactory.createCategory(r.Id, 'Main');
        RestoPosTestFactory.createMenuItem(r.Id, cat.Id, 'Test Item', 100);
        RestoPosTestFactory.createMenuItem(r.Id, cat.Id, 'Another Item', 200);
    }

    @IsTest
    static void testCreateOrder() {
        Restaurant__c r = [SELECT Id FROM Restaurant__c LIMIT 1];
        Restaurant_Table__c t = [SELECT Id FROM Restaurant_Table__c LIMIT 1];

        Test.startTest();
        POS_Order__c ord = OrderController.createOrder(r.Id, t.Id);
        Test.stopTest();

        System.assertNotEquals(null, ord.Id);
        System.assertEquals('New', ord.Status__c);

        Restaurant_Table__c updatedTable = [SELECT Status__c, Current_Order__c FROM Restaurant_Table__c WHERE Id = :t.Id];
        System.assertEquals(ord.Id, updatedTable.Current_Order__c);
    }

    @IsTest
    static void testAddAndRemoveOrderItem() {
        Restaurant__c r = [SELECT Id FROM Restaurant__c LIMIT 1];
        Restaurant_Table__c t = [SELECT Id FROM Restaurant_Table__c LIMIT 1];
        Menu_Item__c mi = [SELECT Id FROM Menu_Item__c WHERE Name = 'Test Item' LIMIT 1];

        POS_Order__c ord = OrderController.createOrder(r.Id, t.Id);

        Test.startTest();
        Order_Item__c item = OrderController.addOrderItem(ord.Id, mi.Id, 2, 'Extra spicy');
        Test.stopTest();

        System.assertNotEquals(null, item.Id);
        System.assertEquals(2, item.Quantity__c);
        System.assertEquals('Test Item', item.Item_Name__c);

        POS_Order__c refreshed = OrderController.getOrder(ord.Id);
        System.assertEquals(200, refreshed.Subtotal__c);

        OrderController.updateOrderItemQuantity(item.Id, 3);
        refreshed = OrderController.getOrder(ord.Id);
        System.assertEquals(300, refreshed.Subtotal__c);

        OrderController.removeOrderItem(item.Id);
        refreshed = OrderController.getOrder(ord.Id);
        System.assertEquals(0, refreshed.Subtotal__c);
    }

    @IsTest
    static void testDuplicateItemIncrementsQuantity() {
        Restaurant__c r = [SELECT Id FROM Restaurant__c LIMIT 1];
        Restaurant_Table__c t = [SELECT Id FROM Restaurant_Table__c LIMIT 1];
        Menu_Item__c mi = [SELECT Id FROM Menu_Item__c WHERE Name = 'Test Item' LIMIT 1];

        POS_Order__c ord = OrderController.createOrder(r.Id, t.Id);

        Test.startTest();
        Order_Item__c first = OrderController.addOrderItem(ord.Id, mi.Id, 1, '');
        Order_Item__c second = OrderController.addOrderItem(ord.Id, mi.Id, 2, '');
        Test.stopTest();

        System.assertEquals(first.Id, second.Id, 'Should return same order item');
        System.assertEquals(3, second.Quantity__c, 'Quantity should be 1+2=3');

        List<Order_Item__c> allItems = [SELECT Id FROM Order_Item__c WHERE POS_Order__c = :ord.Id AND Status__c != 'Cancelled'];
        System.assertEquals(1, allItems.size(), 'Should be only 1 line item, not 2');
    }

    @IsTest
    static void testGetActiveOrders() {
        Restaurant__c r = [SELECT Id FROM Restaurant__c LIMIT 1];
        Restaurant_Table__c t = [SELECT Id FROM Restaurant_Table__c LIMIT 1];

        OrderController.createOrder(r.Id, t.Id);

        Test.startTest();
        List<POS_Order__c> orders = OrderController.getActiveOrders(r.Id);
        Test.stopTest();

        System.assertEquals(1, orders.size());
    }

    @IsTest
    static void testApplyDiscount() {
        Restaurant__c r = [SELECT Id FROM Restaurant__c LIMIT 1];
        Restaurant_Table__c t = [SELECT Id FROM Restaurant_Table__c LIMIT 1];
        Menu_Item__c mi = [SELECT Id FROM Menu_Item__c WHERE Name = 'Test Item' LIMIT 1];

        POS_Order__c ord = OrderController.createOrder(r.Id, t.Id);
        OrderController.addOrderItem(ord.Id, mi.Id, 2, '');

        Test.startTest();
        POS_Order__c result = OrderController.applyDiscount(ord.Id, 10);
        Test.stopTest();

        System.assertEquals(10, result.Discount_Percent__c);
        System.assert(result.Discount_Amount__c > 0);
    }

    @IsTest
    static void testCloseOrder() {
        Restaurant__c r = [SELECT Id FROM Restaurant__c LIMIT 1];
        Restaurant_Table__c t = [SELECT Id FROM Restaurant_Table__c LIMIT 1];
        Menu_Item__c mi = [SELECT Id FROM Menu_Item__c LIMIT 1];

        POS_Order__c ord = OrderController.createOrder(r.Id, t.Id);
        OrderController.addOrderItem(ord.Id, mi.Id, 1, '');

        Test.startTest();
        Receipt__c receipt = OrderController.closeOrder(ord.Id);
        Test.stopTest();

        System.assertNotEquals(null, receipt.Id);
        System.assertNotEquals(null, receipt.Receipt_Number__c);

        POS_Order__c closedOrder = [SELECT Status__c FROM POS_Order__c WHERE Id = :ord.Id];
        System.assertEquals('Served', closedOrder.Status__c);

        Restaurant_Table__c updatedTable = [SELECT Status__c FROM Restaurant_Table__c WHERE Id = :t.Id];
        System.assertEquals('Available', updatedTable.Status__c);
    }

    @IsTest
    static void testUpdateOrderStatus() {
        Restaurant__c r = [SELECT Id FROM Restaurant__c LIMIT 1];
        Restaurant_Table__c t = [SELECT Id FROM Restaurant_Table__c LIMIT 1];

        POS_Order__c ord = OrderController.createOrder(r.Id, t.Id);

        Test.startTest();
        POS_Order__c result = OrderController.updateOrderStatus(ord.Id, 'In Progress');
        System.assertEquals('In Progress', result.Status__c);

        result = OrderController.updateOrderStatus(ord.Id, 'Cancelled');
        System.assertEquals('Cancelled', result.Status__c);
        Test.stopTest();
    }
}

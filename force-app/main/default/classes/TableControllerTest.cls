@IsTest
private class TableControllerTest {

    @TestSetup
    static void setup() {
        Restaurant__c r = RestoPosTestFactory.createRestaurant();
        RestoPosTestFactory.createTables(r.Id, 3);
    }

    @IsTest
    static void testGetTables() {
        Restaurant__c r = [SELECT Id FROM Restaurant__c LIMIT 1];
        Test.startTest();
        List<Restaurant_Table__c> tables = TableController.getTables(r.Id);
        Test.stopTest();
        System.assertEquals(3, tables.size());
    }

    @IsTest
    static void testOccupyTable() {
        Restaurant_Table__c t = [SELECT Id FROM Restaurant_Table__c LIMIT 1];
        Test.startTest();
        Restaurant_Table__c updated = TableController.occupyTable(t.Id);
        Test.stopTest();
        System.assertEquals('Occupied', updated.Status__c);
    }

    @IsTest
    static void testUpdateTableStatus() {
        Restaurant_Table__c t = [SELECT Id FROM Restaurant_Table__c LIMIT 1];
        Test.startTest();
        Restaurant_Table__c updated = TableController.updateTableStatus(t.Id, 'Reserved');
        Test.stopTest();
        System.assertEquals('Reserved', updated.Status__c);
    }

    @IsTest
    static void testFreeTableWithNoOrder() {
        Restaurant_Table__c t = [SELECT Id FROM Restaurant_Table__c LIMIT 1];
        TableController.occupyTable(t.Id);

        Test.startTest();
        Restaurant_Table__c updated = TableController.updateTableStatus(t.Id, 'Available');
        Test.stopTest();
        System.assertEquals('Available', updated.Status__c);
    }

    @IsTest
    static void testCannotFreeTableWithActiveOrder() {
        Restaurant__c r = [SELECT Id FROM Restaurant__c LIMIT 1];
        Restaurant_Table__c t = [SELECT Id FROM Restaurant_Table__c LIMIT 1];
        TableController.occupyTable(t.Id);
        OrderController.createOrder(r.Id, t.Id, null);

        Test.startTest();
        try {
            TableController.updateTableStatus(t.Id, 'Available');
            System.assert(false, 'Should have thrown exception');
        } catch (AuraHandledException e) {
            System.assertNotEquals(null, e, 'Expected error when freeing table with active order');
        }
        Test.stopTest();
    }

    @IsTest
    static void testUpsertAndTransferOrder() {
        Restaurant__c r = [SELECT Id FROM Restaurant__c LIMIT 1];
        List<Restaurant_Table__c> tables = [SELECT Id FROM Restaurant_Table__c ORDER BY CreatedDate ASC LIMIT 2];
        POS_Order__c ord = OrderController.createOrder(r.Id, tables[0].Id, null);

        Test.startTest();
        Restaurant_Table__c saved = TableController.upsertTable(r.Id, null, 'Patio-1', 6, 20, 'Available');
        TableController.transferCurrentOrder(tables[0].Id, tables[1].Id);
        Test.stopTest();

        System.assertNotEquals(null, saved.Id);
        POS_Order__c movedOrder = [SELECT Table__c FROM POS_Order__c WHERE Id = :ord.Id];
        System.assertEquals(tables[1].Id, movedOrder.Table__c);
    }
}

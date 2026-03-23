@IsTest
private class MenuControllerTest {

    @TestSetup
    static void setup() {
        Restaurant__c r = RestoPosTestFactory.createRestaurant();
        Menu_Category__c cat = RestoPosTestFactory.createCategory(r.Id, 'Starters');
        RestoPosTestFactory.createMenuItem(r.Id, cat.Id, 'Paneer Tikka', 250);
        RestoPosTestFactory.createMenuItem(r.Id, cat.Id, 'Chicken 65', 280);
    }

    @IsTest
    static void testGetMenuCategories() {
        Restaurant__c r = [SELECT Id FROM Restaurant__c LIMIT 1];
        Test.startTest();
        List<Menu_Category__c> cats = MenuController.getMenuCategories(r.Id);
        Test.stopTest();
        System.assertEquals(1, cats.size());
        System.assertEquals('Starters', cats[0].Name);
    }

    @IsTest
    static void testGetMenuItems() {
        Restaurant__c r = [SELECT Id FROM Restaurant__c LIMIT 1];
        Menu_Category__c cat = [SELECT Id FROM Menu_Category__c LIMIT 1];
        Test.startTest();
        List<Menu_Item__c> items = MenuController.getMenuItems(r.Id, cat.Id);
        Test.stopTest();
        System.assertEquals(2, items.size());
    }

    @IsTest
    static void testGetMenuItemsAllCategories() {
        Restaurant__c r = [SELECT Id FROM Restaurant__c LIMIT 1];
        Test.startTest();
        List<Menu_Item__c> items = MenuController.getMenuItems(r.Id, null);
        Test.stopTest();
        System.assertEquals(2, items.size());
    }

    @IsTest
    static void testSearchMenuItems() {
        Restaurant__c r = [SELECT Id FROM Restaurant__c LIMIT 1];
        Test.startTest();
        List<Menu_Item__c> items = MenuController.searchMenuItems(r.Id, 'Paneer');
        Test.stopTest();
        System.assertEquals(1, items.size());
        System.assertEquals('Paneer Tikka', items[0].Name);
    }
}

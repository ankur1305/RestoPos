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

    @IsTest
    static void testManagerMenuMethods() {
        Restaurant__c r = [SELECT Id FROM Restaurant__c LIMIT 1];
        Menu_Category__c cat = [SELECT Id FROM Menu_Category__c LIMIT 1];
        Menu_Item__c item = [SELECT Id FROM Menu_Item__c LIMIT 1];

        Test.startTest();
        MenuController.ManagerMenuData data = MenuController.getManagerMenuData(r.Id);
        Menu_Category__c newCat = MenuController.upsertMenuCategory(r.Id, null, 'Dessert', 2, 'utility:food_and_drink', true);
        Menu_Item__c savedItem = MenuController.upsertMenuItem(
            r.Id,
            item.Id,
            'Paneer Tikka Updated',
            cat.Id,
            300,
            'Updated',
            false,
            true,
            2,
            null
        );
        Integer updated = MenuController.bulkUpdateAvailability(r.Id, new List<String>{ item.Id }, true);
        Integer categoryUpdated = MenuController.setCategoryAvailability(r.Id, cat.Id, false);
        Test.stopTest();

        System.assert(data.categories.size() > 0);
        System.assertNotEquals(null, newCat.Id);
        System.assertEquals('Paneer Tikka Updated', savedItem.Name);
        System.assertEquals(1, updated);
        System.assert(categoryUpdated > 0);
    }
}

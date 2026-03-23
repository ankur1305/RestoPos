@IsTest
private class RestoPosControllerTest {

    @TestSetup
    static void setup() {
        RestoPosTestFactory.createRestaurant();
    }

    @IsTest
    static void testGetRestaurantByCode() {
        Test.startTest();
        Restaurant__c r = RestoPosController.getRestaurantByCode('TEST01');
        Test.stopTest();
        System.assertNotEquals(null, r, 'Restaurant should be found');
        System.assertEquals('Test Restaurant', r.Name);
    }

    @IsTest
    static void testGetRestaurantByCodeNotFound() {
        Test.startTest();
        try {
            RestoPosController.getRestaurantByCode('INVALID');
            System.assert(false, 'Should have thrown exception');
        } catch (AuraHandledException e) {
            System.assertNotEquals(null, e, 'Expected AuraHandledException');
        }
        Test.stopTest();
    }

    @IsTest
    static void testVerifyPin() {
        Restaurant__c r = [SELECT Id FROM Restaurant__c LIMIT 1];
        Test.startTest();
        Boolean valid = RestoPosController.verifyPin(r.Id, '1234');
        Boolean invalid = RestoPosController.verifyPin(r.Id, '0000');
        Test.stopTest();
        System.assertEquals(true, valid);
        System.assertEquals(false, invalid);
    }
}

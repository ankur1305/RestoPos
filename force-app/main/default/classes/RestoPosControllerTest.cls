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
        Boolean valid = RestoPosController.verifyPin(r.Id, '123456');
        Boolean invalid = RestoPosController.verifyPin(r.Id, '000000');
        Test.stopTest();
        System.assertEquals(true, valid);
        System.assertEquals(false, invalid);
    }

    @IsTest
    static void testVerifyManagerPin() {
        Restaurant__c r = [SELECT Id FROM Restaurant__c LIMIT 1];
        Test.startTest();
        Boolean valid = RestoPosController.verifyManagerPin(r.Id, '999999');
        Boolean invalid = RestoPosController.verifyManagerPin(r.Id, '123456');
        Test.stopTest();
        System.assertEquals(true, valid);
        System.assertEquals(false, invalid);
    }

    @IsTest
    static void testVerifyPinRejectsNonSixDigits() {
        Restaurant__c r = [SELECT Id FROM Restaurant__c LIMIT 1];
        try {
            RestoPosController.verifyPin(r.Id, '1234');
            System.assert(false, 'Expected six-digit validation error');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('exactly 6 digits'));
        }
    }
}

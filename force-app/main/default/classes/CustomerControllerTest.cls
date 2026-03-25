@IsTest
private class CustomerControllerTest {

    @TestSetup
    static void setup() {
        RestoPosTestFactory.createRestaurant();
    }

    @IsTest
    static void testSearchByPhoneReturnsMatchingCustomer() {
        Restaurant__c restaurant = [SELECT Id FROM Restaurant__c LIMIT 1];
        Customer__c customer = RestoPosTestFactory.createCustomer(
            restaurant.Id,
            'Searchable Customer',
            '9876501111',
            'search@example.com'
        );

        Test.startTest();
        Customer__c result = CustomerController.searchByPhone(restaurant.Id, '9876501111');
        Test.stopTest();

        System.assertEquals(customer.Id, result.Id);
        System.assertEquals('search@example.com', result.Email__c);
    }

    @IsTest
    static void testCreateCustomerStoresOptionalEmail() {
        Restaurant__c restaurant = [SELECT Id FROM Restaurant__c LIMIT 1];

        Test.startTest();
        Customer__c customer = CustomerController.createCustomer(
            restaurant.Id,
            'Created Customer',
            '9876502222'
        );
        Test.stopTest();

        System.assertNotEquals(null, customer.Id);
        System.assertEquals(null, customer.Email__c);
    }

    @IsTest
    static void testCreateCustomerAllowsBlankPhone() {
        Restaurant__c restaurant = [SELECT Id FROM Restaurant__c LIMIT 1];

        Test.startTest();
        Customer__c customer = CustomerController.createCustomer(
            restaurant.Id,
            'Walk In Customer',
            null
        );
        Test.stopTest();

        Customer__c inserted = [SELECT Id, Phone__c FROM Customer__c WHERE Id = :customer.Id];
        System.assertEquals(null, inserted.Phone__c);
    }
}

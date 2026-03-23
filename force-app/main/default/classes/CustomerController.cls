public without sharing class CustomerController {

    @AuraEnabled
    public static Customer__c searchByPhone(String restaurantId, String phone) {
        if (String.isBlank(phone) || phone.length() < 4) {
            return null;
        }
        List<Customer__c> customers = [
            SELECT Id, Name, Phone__c, Email__c, Visit_Count__c, Last_Visit__c, Notes__c
            FROM Customer__c
            WHERE Restaurant__c = :restaurantId AND Phone__c = :phone
            LIMIT 1
        ];
        return customers.isEmpty() ? null : customers[0];
    }

    @AuraEnabled
    public static Customer__c createCustomer(String restaurantId, String name, String phone) {
        Customer__c cust = new Customer__c(
            Name = name,
            Phone__c = phone,
            Restaurant__c = restaurantId,
            Visit_Count__c = 0
        );
        insert cust;
        return cust;
    }
}

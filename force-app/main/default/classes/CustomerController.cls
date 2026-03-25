public without sharing class CustomerController {

    private static Boolean isTenDigitPhone(String phone) {
        return String.isNotBlank(phone)
            && phone.length() == 10
            && Pattern.matches('^[0-9]{10}$', phone);
    }

    @AuraEnabled
    public static Customer__c searchByPhone(String restaurantId, String phone) {
        if (String.isBlank(restaurantId) || !isTenDigitPhone(phone)) {
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
        if (String.isBlank(name)) {
            throw new AuraHandledException('Customer name is required.');
        }
        String normalizedPhone = String.isBlank(phone) ? null : phone.trim();
        if (String.isNotBlank(normalizedPhone) && !isTenDigitPhone(normalizedPhone)) {
            throw new AuraHandledException('Phone must be exactly 10 digits.');
        }
        Customer__c cust = new Customer__c(
            Name = name,
            Phone__c = normalizedPhone,
            Restaurant__c = restaurantId,
            Visit_Count__c = 0
        );
        insert cust;
        return cust;
    }
}

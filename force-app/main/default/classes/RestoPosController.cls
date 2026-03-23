public without sharing class RestoPosController {

    @AuraEnabled(cacheable=true)
    public static Restaurant__c getRestaurantByCode(String code) {
        List<Restaurant__c> restaurants = [
            SELECT Id, Name, Code__c, Address__c, Phone__c,
                   Tax_Rate__c, Currency_Code__c, Is_Active__c, Logo_URL__c
            FROM Restaurant__c
            WHERE Code__c = :code AND Is_Active__c = true
            LIMIT 1
        ];
        if (restaurants.isEmpty()) {
            throw new AuraHandledException('Restaurant not found or inactive.');
        }
        return restaurants[0];
    }

    @AuraEnabled
    public static Boolean verifyPin(String restaurantId, String pin) {
        List<Restaurant__c> restaurants = [
            SELECT PIN__c FROM Restaurant__c
            WHERE Id = :restaurantId
            LIMIT 1
        ];
        if (restaurants.isEmpty()) {
            throw new AuraHandledException('Restaurant not found.');
        }
        return restaurants[0].PIN__c == pin;
    }
}

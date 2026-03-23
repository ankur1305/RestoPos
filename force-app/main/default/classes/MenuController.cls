public without sharing class MenuController {

    @AuraEnabled(cacheable=true)
    public static List<Menu_Category__c> getMenuCategories(String restaurantId) {
        return [
            SELECT Id, Name, Sort_Order__c, Icon__c
            FROM Menu_Category__c
            WHERE Restaurant__c = :restaurantId
              AND Is_Active__c = true
            ORDER BY Sort_Order__c ASC
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<Menu_Item__c> getMenuItems(String restaurantId, String categoryId) {
        String query = 'SELECT Id, Name, Price__c, Description__c, Is_Available__c, '
                     + 'Is_Vegetarian__c, Image_URL__c, Sort_Order__c, Menu_Category__c '
                     + 'FROM Menu_Item__c '
                     + 'WHERE Restaurant__c = :restaurantId AND Is_Available__c = true ';
        if (String.isNotBlank(categoryId)) {
            query += 'AND Menu_Category__c = :categoryId ';
        }
        query += 'ORDER BY Sort_Order__c ASC';
        return Database.query(query);
    }

    @AuraEnabled(cacheable=true)
    public static List<Menu_Item__c> searchMenuItems(String restaurantId, String searchTerm) {
        String searchKey = '%' + String.escapeSingleQuotes(searchTerm) + '%';
        return [
            SELECT Id, Name, Price__c, Description__c, Is_Available__c,
                   Is_Vegetarian__c, Menu_Category__c, Menu_Category__r.Name
            FROM Menu_Item__c
            WHERE Restaurant__c = :restaurantId
              AND Is_Available__c = true
              AND Name LIKE :searchKey
            ORDER BY Name ASC
            LIMIT 20
        ];
    }
}

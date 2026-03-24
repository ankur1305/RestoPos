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
                     + 'WHERE Restaurant__c = :restaurantId ';
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
              AND Name LIKE :searchKey
            ORDER BY Name ASC
            LIMIT 20
        ];
    }

    @AuraEnabled
    public static ManagerMenuData getManagerMenuData(String restaurantId) {
        ensureReadable(Menu_Category__c.SObjectType.getDescribe(), 'Menu categories');
        ensureReadable(Menu_Item__c.SObjectType.getDescribe(), 'Menu items');
        ManagerMenuData data = new ManagerMenuData();
        data.categories = [
            SELECT Id, Name, Sort_Order__c, Icon__c, Is_Active__c
            FROM Menu_Category__c
            WHERE Restaurant__c = :restaurantId
            ORDER BY Sort_Order__c ASC, Name ASC
        ];
        data.items = [
            SELECT Id, Name, Price__c, Description__c, Is_Available__c,
                   Is_Vegetarian__c, Image_URL__c, Sort_Order__c, Menu_Category__c
            FROM Menu_Item__c
            WHERE Restaurant__c = :restaurantId
            ORDER BY Sort_Order__c ASC, Name ASC
        ];
        return data;
    }

    @AuraEnabled
    public static Menu_Category__c upsertMenuCategory(
        String restaurantId,
        String categoryId,
        String name,
        Integer sortOrder,
        String icon,
        Boolean isActive
    ) {
        ensureCreateOrUpdate(categoryId, Menu_Category__c.SObjectType.getDescribe(), 'menu category');
        Menu_Category__c recordToSave;
        if (String.isBlank(categoryId)) {
            recordToSave = new Menu_Category__c(Restaurant__c = restaurantId);
        } else {
            recordToSave = [SELECT Id, Restaurant__c FROM Menu_Category__c WHERE Id = :categoryId LIMIT 1];
            if (recordToSave.Restaurant__c != restaurantId) {
                throw new AuraHandledException('Invalid category for this restaurant.');
            }
        }
        recordToSave.Name = name;
        recordToSave.Sort_Order__c = sortOrder;
        recordToSave.Icon__c = icon;
        recordToSave.Is_Active__c = (isActive == null ? true : isActive);
        upsert recordToSave;
        return recordToSave;
    }

    @AuraEnabled
    public static Menu_Item__c upsertMenuItem(
        String restaurantId,
        String itemId,
        String name,
        String categoryId,
        Decimal price,
        String description,
        Boolean isAvailable,
        Boolean isVegetarian,
        Integer sortOrder,
        String imageUrl
    ) {
        ensureCreateOrUpdate(itemId, Menu_Item__c.SObjectType.getDescribe(), 'menu item');
        Menu_Item__c recordToSave;
        if (String.isBlank(itemId)) {
            recordToSave = new Menu_Item__c(Restaurant__c = restaurantId);
        } else {
            recordToSave = [SELECT Id, Restaurant__c FROM Menu_Item__c WHERE Id = :itemId LIMIT 1];
            if (recordToSave.Restaurant__c != restaurantId) {
                throw new AuraHandledException('Invalid menu item for this restaurant.');
            }
        }
        recordToSave.Name = name;
        recordToSave.Menu_Category__c = categoryId;
        recordToSave.Price__c = price;
        recordToSave.Description__c = description;
        recordToSave.Is_Available__c = (isAvailable == null ? true : isAvailable);
        recordToSave.Is_Vegetarian__c = (isVegetarian == null ? false : isVegetarian);
        recordToSave.Sort_Order__c = sortOrder;
        recordToSave.Image_URL__c = imageUrl;
        upsert recordToSave;
        return recordToSave;
    }

    @AuraEnabled
    public static void deleteMenuItem(String menuItemId) {
        if (!Menu_Item__c.SObjectType.getDescribe().isDeletable()) {
            throw new AuraHandledException('No delete permission for menu items.');
        }
        delete [SELECT Id FROM Menu_Item__c WHERE Id = :menuItemId LIMIT 1];
    }

    @AuraEnabled
    public static void deleteMenuCategory(String restaurantId, String categoryId) {
        if (!Menu_Category__c.SObjectType.getDescribe().isDeletable()) {
            throw new AuraHandledException('No delete permission for menu categories.');
        }
        Menu_Category__c category = [
            SELECT Id, Restaurant__c
            FROM Menu_Category__c
            WHERE Id = :categoryId
            LIMIT 1
        ];
        if (category.Restaurant__c != restaurantId) {
            throw new AuraHandledException('Invalid category for this restaurant.');
        }

        Integer linkedItems = [
            SELECT COUNT()
            FROM Menu_Item__c
            WHERE Restaurant__c = :restaurantId
              AND Menu_Category__c = :categoryId
        ];
        if (linkedItems > 0) {
            throw new AuraHandledException('Cannot delete category with existing menu items. Move or delete items first.');
        }

        delete category;
    }

    @AuraEnabled
    public static Integer bulkUpdateAvailability(String restaurantId, List<String> itemIds, Boolean isAvailable) {
        ensureUpdatable(Menu_Item__c.SObjectType.getDescribe(), 'Menu items');
        List<Menu_Item__c> rows;
        if (itemIds == null || itemIds.isEmpty()) {
            rows = [SELECT Id FROM Menu_Item__c WHERE Restaurant__c = :restaurantId];
        } else {
            rows = [SELECT Id FROM Menu_Item__c WHERE Restaurant__c = :restaurantId AND Id IN :itemIds];
        }
        for (Menu_Item__c row : rows) {
            row.Is_Available__c = isAvailable;
        }
        if (!rows.isEmpty()) {
            update rows;
        }
        return rows.size();
    }

    @AuraEnabled
    public static Integer setCategoryAvailability(String restaurantId, String categoryId, Boolean isAvailable) {
        ensureUpdatable(Menu_Item__c.SObjectType.getDescribe(), 'Menu items');
        List<Menu_Item__c> rows = [
            SELECT Id
            FROM Menu_Item__c
            WHERE Restaurant__c = :restaurantId
              AND Menu_Category__c = :categoryId
        ];
        for (Menu_Item__c row : rows) {
            row.Is_Available__c = isAvailable;
        }
        if (!rows.isEmpty()) {
            update rows;
        }
        return rows.size();
    }

    public class ManagerMenuData {
        @AuraEnabled public List<Menu_Category__c> categories;
        @AuraEnabled public List<Menu_Item__c> items;
    }

    private static void ensureReadable(Schema.DescribeSObjectResult describeResult, String label) {
        if (!describeResult.isAccessible()) {
            throw new AuraHandledException(label + ' are not readable for this user.');
        }
    }

    private static void ensureUpdatable(Schema.DescribeSObjectResult describeResult, String label) {
        if (!describeResult.isUpdateable()) {
            throw new AuraHandledException(label + ' are not updateable for this user.');
        }
    }

    private static void ensureCreateOrUpdate(String idValue, Schema.DescribeSObjectResult describeResult, String label) {
        if (String.isBlank(idValue)) {
            if (!describeResult.isCreateable()) {
                throw new AuraHandledException('No create permission for ' + label + '.');
            }
        } else if (!describeResult.isUpdateable()) {
            throw new AuraHandledException('No update permission for ' + label + '.');
        }
    }
}

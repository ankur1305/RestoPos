public without sharing class TableController {

    @AuraEnabled
    public static List<Restaurant_Table__c> getTables(String restaurantId) {
        return [
            SELECT Id, Name, Capacity__c, Status__c, Sort_Order__c,
                   Current_Order__c, Current_Order__r.Name,
                   Current_Order__r.Total_Amount__c,
                   Current_Order__r.Status__c,
                   Current_Order__r.Item_Count__c
            FROM Restaurant_Table__c
            WHERE Restaurant__c = :restaurantId
            ORDER BY Sort_Order__c ASC
        ];
    }

    @AuraEnabled
    public static Restaurant_Table__c updateTableStatus(String tableId, String status) {
        Restaurant_Table__c tbl = [
            SELECT Id, Status__c, Current_Order__c, Current_Order__r.Status__c
            FROM Restaurant_Table__c
            WHERE Id = :tableId
            LIMIT 1
        ];

        if (hasActiveOrder(tbl.Current_Order__c, tbl.Current_Order__r != null ? tbl.Current_Order__r.Status__c : null)
            && status != 'Occupied') {
            throw new AuraHandledException('Cannot update this table — it has an active order. Complete, serve, or cancel the order first.');
        }

        tbl.Status__c = status;
        if (status == 'Available') {
            tbl.Current_Order__c = null;
        }
        update tbl;
        return tbl;
    }

    @AuraEnabled
    public static Restaurant_Table__c occupyTable(String tableId) {
        Restaurant_Table__c tbl = new Restaurant_Table__c(
            Id = tableId,
            Status__c = 'Occupied'
        );
        update tbl;
        return tbl;
    }

    @AuraEnabled
    public static List<Restaurant_Table__c> getManagerTables(String restaurantId) {
        ensureReadable(Restaurant_Table__c.SObjectType.getDescribe(), 'Restaurant tables');
        return getTables(restaurantId);
    }

    @AuraEnabled
    public static Restaurant_Table__c upsertTable(
        String restaurantId,
        String tableId,
        String name,
        Integer capacity,
        Integer sortOrder,
        String status
    ) {
        ensureCreateOrUpdate(tableId, Restaurant_Table__c.SObjectType.getDescribe(), 'table');
        Restaurant_Table__c recordToSave;
        if (String.isBlank(tableId)) {
            recordToSave = new Restaurant_Table__c();
            recordToSave.Restaurant__c = restaurantId;
        } else {
            recordToSave = [
                SELECT Id, Restaurant__c, Current_Order__c, Current_Order__r.Status__c
                FROM Restaurant_Table__c
                WHERE Id = :tableId
                LIMIT 1
            ];
            if (recordToSave.Restaurant__c != restaurantId) {
                throw new AuraHandledException('Invalid table for this restaurant.');
            }
            if (hasActiveOrder(
                recordToSave.Current_Order__c,
                recordToSave.Current_Order__r != null ? recordToSave.Current_Order__r.Status__c : null
            )) {
                throw new AuraHandledException('Cannot update this table — it has an active order. Complete, serve, or cancel the order first.');
            }
        }
        recordToSave.Name = name;
        recordToSave.Capacity__c = capacity;
        recordToSave.Sort_Order__c = sortOrder;
        recordToSave.Status__c = String.isBlank(status) ? 'Available' : status;
        upsert recordToSave;
        return recordToSave;
    }

    @AuraEnabled
    public static void transferCurrentOrder(String sourceTableId, String targetTableId) {
        ensureUpdatable(Restaurant_Table__c.SObjectType.getDescribe(), 'Restaurant tables');
        ensureUpdatable(POS_Order__c.SObjectType.getDescribe(), 'Orders');
        Restaurant_Table__c sourceTable = [
            SELECT Id, Current_Order__c, Restaurant__c
            FROM Restaurant_Table__c
            WHERE Id = :sourceTableId
            LIMIT 1
        ];
        Restaurant_Table__c targetTable = [
            SELECT Id, Current_Order__c, Restaurant__c
            FROM Restaurant_Table__c
            WHERE Id = :targetTableId
            LIMIT 1
        ];
        if (sourceTable.Restaurant__c != targetTable.Restaurant__c) {
            throw new AuraHandledException('Tables must belong to same restaurant.');
        }
        if (sourceTable.Current_Order__c == null) {
            throw new AuraHandledException('Source table has no active order.');
        }
        if (targetTable.Current_Order__c != null) {
            throw new AuraHandledException('Target table already has an order.');
        }

        update new POS_Order__c(Id = sourceTable.Current_Order__c, Table__c = targetTable.Id);
        update new List<Restaurant_Table__c>{
            new Restaurant_Table__c(Id = sourceTable.Id, Current_Order__c = null, Status__c = 'Available'),
            new Restaurant_Table__c(Id = targetTable.Id, Current_Order__c = sourceTable.Current_Order__c, Status__c = 'Occupied')
        };
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

    private static Boolean hasActiveOrder(Id orderId, String orderStatus) {
        if (orderId == null) {
            return false;
        }
        String normalizedStatus = String.isBlank(orderStatus) ? '' : orderStatus.trim();
        return normalizedStatus != 'Closed'
            && normalizedStatus != 'Cancelled'
            && normalizedStatus != 'Served';
    }
}

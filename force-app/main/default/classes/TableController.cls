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

        if (status == 'Available' && tbl.Current_Order__c != null) {
            String orderStatus = tbl.Current_Order__r.Status__c;
            if (orderStatus != null
                && orderStatus != 'Closed'
                && orderStatus != 'Cancelled'
                && orderStatus != 'Served') {
                throw new AuraHandledException('Cannot free this table — it has an active order. Complete or cancel the order first.');
            }
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
}

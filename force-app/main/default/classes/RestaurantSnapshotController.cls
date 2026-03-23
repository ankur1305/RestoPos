public without sharing class RestaurantSnapshotController {

    @AuraEnabled
    public static Map<String, Object> getSnapshot(String restaurantId) {
        Map<String, Object> snapshot = new Map<String, Object>();

        // Table stats
        List<Restaurant_Table__c> tables = [
            SELECT Status__c FROM Restaurant_Table__c WHERE Restaurant__c = :restaurantId
        ];
        Integer totalTables = tables.size();
        Integer available = 0, occupied = 0, reserved = 0;
        for (Restaurant_Table__c t : tables) {
            if (t.Status__c == 'Available') available++;
            else if (t.Status__c == 'Occupied') occupied++;
            else if (t.Status__c == 'Reserved') reserved++;
        }
        snapshot.put('totalTables', totalTables);
        snapshot.put('availableTables', available);
        snapshot.put('occupiedTables', occupied);
        snapshot.put('reservedTables', reserved);

        // Menu stats
        Integer totalCategories = [SELECT COUNT() FROM Menu_Category__c WHERE Restaurant__c = :restaurantId AND Is_Active__c = true];
        Integer totalMenuItems = [SELECT COUNT() FROM Menu_Item__c WHERE Restaurant__c = :restaurantId AND Is_Available__c = true];
        snapshot.put('totalCategories', totalCategories);
        snapshot.put('totalMenuItems', totalMenuItems);

        // Active orders
        List<POS_Order__c> activeOrders = [
            SELECT Id, Total_Amount__c FROM POS_Order__c
            WHERE Restaurant__c = :restaurantId
              AND Status__c NOT IN ('Closed', 'Cancelled', 'Served')
        ];
        snapshot.put('activeOrders', activeOrders.size());

        Decimal activeTotal = 0;
        for (POS_Order__c o : activeOrders) {
            activeTotal += (o.Total_Amount__c != null ? o.Total_Amount__c : 0);
        }
        snapshot.put('activeOrdersTotal', activeTotal);

        // Today's stats
        Date today = Date.today();
        List<AggregateResult> todayAgg = [
            SELECT COUNT(Id) orderCount, SUM(Total_Amount__c) revenue
            FROM POS_Order__c
            WHERE Restaurant__c = :restaurantId
              AND Status__c IN ('Served', 'Closed')
              AND DAY_ONLY(Order_DateTime__c) = :today
        ];
        if (!todayAgg.isEmpty()) {
            snapshot.put('todayOrders', todayAgg[0].get('orderCount'));
            Decimal rev = (Decimal)todayAgg[0].get('revenue');
            snapshot.put('todayRevenue', rev != null ? rev : 0);
        } else {
            snapshot.put('todayOrders', 0);
            snapshot.put('todayRevenue', 0);
        }

        // Total lifetime orders
        Integer totalOrders = [SELECT COUNT() FROM POS_Order__c WHERE Restaurant__c = :restaurantId AND Status__c IN ('Served', 'Closed')];
        snapshot.put('totalOrders', totalOrders);

        return snapshot;
    }
}

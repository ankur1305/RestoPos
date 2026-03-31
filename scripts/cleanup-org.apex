// Org Cleanup: keep only The Curry House (TCH001) with its 5 most recent orders.
// Run via:  sf apex run --file scripts/cleanup-org.apex

String KEEP_CODE = 'TCH001';
Integer ORDERS_TO_KEEP = 5;

// 1. Find the keeper restaurant
List<Restaurant__c> keepers = [SELECT Id, Name, Code__c FROM Restaurant__c WHERE Code__c = :KEEP_CODE LIMIT 1];
if (keepers.isEmpty()) {
    System.debug(LoggingLevel.ERROR, '!! Restaurant with Code__c = ' + KEEP_CODE + ' not found. Aborting.');
    return;
}
Id keeperId = keepers[0].Id;
System.debug('Keeping restaurant: ' + keepers[0].Name + ' (' + KEEP_CODE + ')  Id=' + keeperId);

// ---------- 2. Delete everything for OTHER restaurants ----------

Set<Id> otherRestoIds = new Map<Id, Restaurant__c>(
    [SELECT Id FROM Restaurant__c WHERE Id != :keeperId]
).keySet();

if (!otherRestoIds.isEmpty()) {
    System.debug('Other restaurants to purge: ' + otherRestoIds.size());

    List<Receipt__c> otherReceipts = [SELECT Id FROM Receipt__c WHERE Restaurant__c IN :otherRestoIds];
    if (!otherReceipts.isEmpty()) { Database.delete(otherReceipts, false); }
    System.debug('  Deleted receipts: ' + otherReceipts.size());

    // Order_Item__c cascade-deletes with POS_Order__c, but explicit delete avoids Restrict issues
    List<Order_Item__c> otherItems = [SELECT Id FROM Order_Item__c WHERE POS_Order__c IN (SELECT Id FROM POS_Order__c WHERE Restaurant__c IN :otherRestoIds)];
    if (!otherItems.isEmpty()) { Database.delete(otherItems, false); }
    System.debug('  Deleted order items: ' + otherItems.size());

    List<POS_Order__c> otherOrders = [SELECT Id FROM POS_Order__c WHERE Restaurant__c IN :otherRestoIds];
    if (!otherOrders.isEmpty()) { Database.delete(otherOrders, false); }
    System.debug('  Deleted orders: ' + otherOrders.size());

    List<Menu_Item__c> otherMenuItems = [SELECT Id FROM Menu_Item__c WHERE Restaurant__c IN :otherRestoIds];
    if (!otherMenuItems.isEmpty()) { Database.delete(otherMenuItems, false); }
    System.debug('  Deleted menu items: ' + otherMenuItems.size());

    List<Menu_Category__c> otherCats = [SELECT Id FROM Menu_Category__c WHERE Restaurant__c IN :otherRestoIds];
    if (!otherCats.isEmpty()) { Database.delete(otherCats, false); }
    System.debug('  Deleted categories: ' + otherCats.size());

    List<Restaurant_Table__c> otherTables = [SELECT Id FROM Restaurant_Table__c WHERE Restaurant__c IN :otherRestoIds];
    if (!otherTables.isEmpty()) { Database.delete(otherTables, false); }
    System.debug('  Deleted tables: ' + otherTables.size());

    List<Customer__c> otherCustomers = [SELECT Id FROM Customer__c WHERE Restaurant__c IN :otherRestoIds];
    if (!otherCustomers.isEmpty()) { Database.delete(otherCustomers, false); }
    System.debug('  Deleted customers: ' + otherCustomers.size());

    // Delete content (logos) attached to other restaurants
    List<ContentDocumentLink> otherCDLs = [SELECT ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId IN :otherRestoIds];
    if (!otherCDLs.isEmpty()) {
        Set<Id> docIds = new Set<Id>();
        for (ContentDocumentLink cdl : otherCDLs) { docIds.add(cdl.ContentDocumentId); }
        Database.delete([SELECT Id FROM ContentDocument WHERE Id IN :docIds], false);
        System.debug('  Deleted content docs: ' + docIds.size());
    }

    // Finally delete the restaurant records themselves
    Database.delete([SELECT Id FROM Restaurant__c WHERE Id IN :otherRestoIds], false);
    System.debug('  Deleted restaurant records: ' + otherRestoIds.size());
} else {
    System.debug('No other restaurants found -- nothing to purge.');
}

// ---------- 3. Trim TCH001 orders to the N most recent ----------

List<POS_Order__c> allKeeperOrders = [
    SELECT Id FROM POS_Order__c
    WHERE Restaurant__c = :keeperId
    ORDER BY CreatedDate DESC
];

System.debug('TCH001 total orders: ' + allKeeperOrders.size());

if (allKeeperOrders.size() > ORDERS_TO_KEEP) {
    Set<Id> keepOrderIds = new Set<Id>();
    for (Integer i = 0; i < ORDERS_TO_KEEP; i++) {
        keepOrderIds.add(allKeeperOrders[i].Id);
    }

    List<Id> deleteOrderIds = new List<Id>();
    for (Integer i = ORDERS_TO_KEEP; i < allKeeperOrders.size(); i++) {
        deleteOrderIds.add(allKeeperOrders[i].Id);
    }

    // Receipts for orders being deleted
    List<Receipt__c> oldReceipts = [SELECT Id FROM Receipt__c WHERE POS_Order__c IN :deleteOrderIds];
    if (!oldReceipts.isEmpty()) { Database.delete(oldReceipts, false); }
    System.debug('  Trimmed receipts: ' + oldReceipts.size());

    // Order items cascade, but explicit delete to be safe
    List<Order_Item__c> oldOI = [SELECT Id FROM Order_Item__c WHERE POS_Order__c IN :deleteOrderIds];
    if (!oldOI.isEmpty()) { Database.delete(oldOI, false); }
    System.debug('  Trimmed order items: ' + oldOI.size());

    Database.delete([SELECT Id FROM POS_Order__c WHERE Id IN :deleteOrderIds], false);
    System.debug('  Trimmed orders: ' + deleteOrderIds.size() + '  (kept ' + ORDERS_TO_KEEP + ')');
} else {
    System.debug('TCH001 has <= ' + ORDERS_TO_KEEP + ' orders -- nothing to trim.');
}

// ---------- 4. Reset TCH001 tables to Available ----------

List<Restaurant_Table__c> keeperTables = [
    SELECT Id, Status__c, Current_Order__c FROM Restaurant_Table__c
    WHERE Restaurant__c = :keeperId
];
for (Restaurant_Table__c t : keeperTables) {
    t.Status__c = 'Available';
    t.Current_Order__c = null;
}
if (!keeperTables.isEmpty()) { update keeperTables; }
System.debug('Reset ' + keeperTables.size() + ' tables to Available.');

// ---------- 5. Summary ----------

Integer finalOrders = [SELECT COUNT() FROM POS_Order__c WHERE Restaurant__c = :keeperId];
Integer finalItems  = [SELECT COUNT() FROM Order_Item__c WHERE POS_Order__c IN (SELECT Id FROM POS_Order__c WHERE Restaurant__c = :keeperId)];
Integer finalTables = [SELECT COUNT() FROM Restaurant_Table__c WHERE Restaurant__c = :keeperId];
Integer finalCats   = [SELECT COUNT() FROM Menu_Category__c WHERE Restaurant__c = :keeperId];
Integer finalMenu   = [SELECT COUNT() FROM Menu_Item__c WHERE Restaurant__c = :keeperId];
Integer finalCust   = [SELECT COUNT() FROM Customer__c WHERE Restaurant__c = :keeperId];

System.debug('===== CLEANUP COMPLETE =====');
System.debug('Restaurant: ' + keepers[0].Name + ' (' + KEEP_CODE + ')');
System.debug('  Tables:      ' + finalTables);
System.debug('  Categories:  ' + finalCats);
System.debug('  Menu Items:  ' + finalMenu);
System.debug('  Orders:      ' + finalOrders);
System.debug('  Order Items: ' + finalItems);
System.debug('  Customers:   ' + finalCust);
System.debug('============================');

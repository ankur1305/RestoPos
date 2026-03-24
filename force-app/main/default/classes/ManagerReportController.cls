public without sharing class ManagerReportController {

    @AuraEnabled
    public static ReportPayload getManagerReport(String restaurantId, Date startDate, Date endDate) {
        if (!POS_Order__c.SObjectType.getDescribe().isAccessible()
            || !Order_Item__c.SObjectType.getDescribe().isAccessible()) {
            throw new AuraHandledException('No permission to access reporting data.');
        }
        Date fromDate = startDate == null ? Date.today() : startDate;
        Date toDate = endDate == null ? Date.today() : endDate;
        if (toDate < fromDate) {
            throw new AuraHandledException('End date cannot be before start date.');
        }

        DateTime startDt = DateTime.newInstance(fromDate, Time.newInstance(0, 0, 0, 0));
        DateTime endDt = DateTime.newInstance(toDate.addDays(1), Time.newInstance(0, 0, 0, 0));

        AggregateResult summary = [
            SELECT COUNT(Id) orderCount,
                   SUM(Total_Amount__c) revenue,
                   SUM(Discount_Amount__c) discountAmount
            FROM POS_Order__c
            WHERE Restaurant__c = :restaurantId
              AND Order_DateTime__c >= :startDt
              AND Order_DateTime__c < :endDt
              AND Status__c IN ('Served', 'Closed')
        ];

        Decimal orderCount = (Decimal)(summary.get('orderCount') == null ? 0 : summary.get('orderCount'));
        Decimal revenue = (Decimal)(summary.get('revenue') == null ? 0 : summary.get('revenue'));
        Decimal discounts = (Decimal)(summary.get('discountAmount') == null ? 0 : summary.get('discountAmount'));

        List<AggregateResult> top = [
            SELECT Item_Name__c itemName,
                   SUM(Quantity__c) qty,
                   SUM(Line_Total__c) lineRevenue
            FROM Order_Item__c
            WHERE POS_Order__r.Restaurant__c = :restaurantId
              AND POS_Order__r.Order_DateTime__c >= :startDt
              AND POS_Order__r.Order_DateTime__c < :endDt
              AND POS_Order__r.Status__c IN ('Served', 'Closed')
            GROUP BY Item_Name__c
            ORDER BY SUM(Quantity__c) DESC
            LIMIT 10
        ];

        ReportPayload payload = new ReportPayload();
        payload.orderCount = orderCount.intValue();
        payload.revenue = revenue;
        payload.discountAmount = discounts;
        payload.avgOrderValue = orderCount > 0 ? revenue / orderCount : 0;
        payload.topItems = new List<TopItem>();
        for (AggregateResult row : top) {
            TopItem item = new TopItem();
            item.itemName = (String)row.get('itemName');
            item.quantity = ((Decimal)row.get('qty')).intValue();
            item.revenue = (Decimal)row.get('lineRevenue');
            payload.topItems.add(item);
        }
        return payload;
    }

    public class ReportPayload {
        @AuraEnabled public Integer orderCount;
        @AuraEnabled public Decimal revenue;
        @AuraEnabled public Decimal discountAmount;
        @AuraEnabled public Decimal avgOrderValue;
        @AuraEnabled public List<TopItem> topItems;
    }

    public class TopItem {
        @AuraEnabled public String itemName;
        @AuraEnabled public Integer quantity;
        @AuraEnabled public Decimal revenue;
    }
}

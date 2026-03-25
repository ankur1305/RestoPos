public without sharing class ManagerReportController {

    @AuraEnabled
    public static String createExcelExport(String fileName, String fileContent) {
        if (String.isBlank(fileName)) {
            throw new AuraHandledException('File name is required.');
        }
        if (String.isBlank(fileContent)) {
            throw new AuraHandledException('No export data available.');
        }
        if (!isGuestContext() && !ContentVersion.SObjectType.getDescribe().isCreateable()) {
            throw new AuraHandledException('No permission to create export file.');
        }

        ContentVersion exportFile = new ContentVersion(
            Title = fileName.replace('.xls', ''),
            PathOnClient = fileName,
            VersionData = Blob.valueOf(fileContent),
            IsMajorVersion = true
        );
        insert exportFile;

        return '/sfc/servlet.shepherd/version/download/' + exportFile.Id;
    }

    @AuraEnabled
    public static ReportPayload getManagerReport(
        String restaurantId,
        Date startDate,
        Date endDate,
        String datePreset,
        String categoryId,
        String paymentMethod,
        Boolean includeCancelled
    ) {
        if (!isGuestContext()
            && (!POS_Order__c.SObjectType.getDescribe().isAccessible()
            || !Order_Item__c.SObjectType.getDescribe().isAccessible())) {
            throw new AuraHandledException('No permission to access reporting data.');
        }
        if (String.isBlank(restaurantId)) {
            throw new AuraHandledException('Restaurant is required for reports.');
        }

        DateRange selectedRange = resolveDateRange(startDate, endDate, datePreset);
        Date fromDate = selectedRange.fromDate;
        Date toDate = selectedRange.toDate;
        if (toDate < fromDate) {
            throw new AuraHandledException('End date cannot be before start date.');
        }

        DateTime startDt = DateTime.newInstance(fromDate, Time.newInstance(0, 0, 0, 0));
        DateTime endDt = DateTime.newInstance(toDate.addDays(1), Time.newInstance(0, 0, 0, 0));
        Integer daySpan = fromDate.daysBetween(toDate) + 1;
        Date prevFromDate = fromDate.addDays(-daySpan);
        Date prevToDate = fromDate.addDays(-1);
        DateTime prevStartDt = DateTime.newInstance(prevFromDate, Time.newInstance(0, 0, 0, 0));
        DateTime prevEndDt = DateTime.newInstance(prevToDate.addDays(1), Time.newInstance(0, 0, 0, 0));

        Set<String> statuses = includeCancelled == true
            ? new Set<String>{ 'Served', 'Closed', 'Cancelled' }
            : new Set<String>{ 'Served', 'Closed' };

        String orderWhere = buildOrderWhere(restaurantId, startDt, endDt, statuses, paymentMethod, categoryId);
        String prevOrderWhere = buildOrderWhere(restaurantId, prevStartDt, prevEndDt, statuses, paymentMethod, categoryId);

        AggregateResult summary = (AggregateResult)Database.query(
            'SELECT COUNT(Id) orderCount, SUM(Total_Amount__c) revenue, SUM(Discount_Amount__c) discountAmount, SUM(Tax_Amount__c) taxAmount ' +
            'FROM POS_Order__c WHERE ' + orderWhere
        )[0];

        AggregateResult previousSummary = (AggregateResult)Database.query(
            'SELECT COUNT(Id) orderCount, SUM(Total_Amount__c) revenue FROM POS_Order__c WHERE ' + prevOrderWhere
        )[0];

        Decimal orderCountD = toDecimal(summary.get('orderCount'));
        Decimal revenue = toDecimal(summary.get('revenue'));
        Decimal discounts = toDecimal(summary.get('discountAmount'));
        Decimal taxAmount = toDecimal(summary.get('taxAmount'));

        Decimal prevOrderCountD = toDecimal(previousSummary.get('orderCount'));
        Decimal prevRevenue = toDecimal(previousSummary.get('revenue'));

        ReportPayload payload = new ReportPayload();
        payload.summary = new SummarySection();
        payload.summary.orderCount = orderCountD.intValue();
        payload.summary.revenue = revenue;
        payload.summary.discountAmount = discounts;
        payload.summary.avgOrderValue = orderCountD > 0 ? (revenue / orderCountD).setScale(2) : 0;
        payload.summary.taxAmount = taxAmount;
        payload.summary.cgstAmount = (taxAmount / 2).setScale(2);
        payload.summary.sgstAmount = (taxAmount / 2).setScale(2);
        payload.summary.discountRate = revenue > 0 ? ((discounts / revenue) * 100).setScale(2) : 0;

        payload.comparison = new ComparisonSection();
        payload.comparison.previousOrderCount = prevOrderCountD.intValue();
        payload.comparison.previousRevenue = prevRevenue;
        payload.comparison.orderDeltaPercent = percentDelta(orderCountD, prevOrderCountD);
        payload.comparison.revenueDeltaPercent = percentDelta(revenue, prevRevenue);

        payload.hourlyTrend = new List<HourlyPoint>();
        List<AggregateResult> hourlyRows = Database.query(
            'SELECT HOUR_IN_DAY(Order_DateTime__c) hourBucket, COUNT(Id) orderCount, SUM(Total_Amount__c) revenue ' +
            'FROM POS_Order__c WHERE ' + orderWhere +
            ' GROUP BY HOUR_IN_DAY(Order_DateTime__c) ORDER BY HOUR_IN_DAY(Order_DateTime__c)'
        );
        for (AggregateResult row : hourlyRows) {
            HourlyPoint point = new HourlyPoint();
            Integer hour = ((Decimal)row.get('hourBucket')).intValue();
            point.label = hour.format().leftPad(2, '0') + ':00';
            point.orderCount = toDecimal(row.get('orderCount')).intValue();
            point.revenue = toDecimal(row.get('revenue'));
            payload.hourlyTrend.add(point);
        }

        payload.dailyTrend = new List<DailyPoint>();
        List<AggregateResult> dailyRows = Database.query(
            'SELECT DAY_ONLY(Order_DateTime__c) dayBucket, COUNT(Id) orderCount, SUM(Total_Amount__c) revenue ' +
            'FROM POS_Order__c WHERE ' + orderWhere +
            ' GROUP BY DAY_ONLY(Order_DateTime__c) ORDER BY DAY_ONLY(Order_DateTime__c)'
        );
        for (AggregateResult row : dailyRows) {
            DailyPoint point = new DailyPoint();
            Date day = (Date)row.get('dayBucket');
            point.dateLabel = day == null ? '' : day.format();
            point.orderCount = toDecimal(row.get('orderCount')).intValue();
            point.revenue = toDecimal(row.get('revenue'));
            payload.dailyTrend.add(point);
        }

        String itemWhere = buildItemWhere(restaurantId, startDt, endDt, statuses, paymentMethod, categoryId);

        payload.categoryMix = new List<CategoryPoint>();
        List<AggregateResult> categoryRows = Database.query(
            'SELECT Menu_Item__r.Menu_Category__c categoryId, Menu_Item__r.Menu_Category__r.Name categoryName, ' +
            'COUNT_DISTINCT(POS_Order__c) orderCount, SUM(Line_Total__c) revenue ' +
            'FROM Order_Item__c WHERE ' + itemWhere +
            ' GROUP BY Menu_Item__r.Menu_Category__c, Menu_Item__r.Menu_Category__r.Name ' +
            'ORDER BY SUM(Line_Total__c) DESC'
        );
        Set<Id> missingCategoryIds = new Set<Id>();
        for (AggregateResult row : categoryRows) {
            Id aggCategoryId = (Id)row.get('categoryId');
            String aggCategoryName = (String)row.get('categoryName');
            if (aggCategoryId != null && String.isBlank(aggCategoryName)) {
                missingCategoryIds.add(aggCategoryId);
            }
        }
        Map<Id, String> deletedCategoryNamesById = new Map<Id, String>();
        if (!missingCategoryIds.isEmpty()) {
            for (Menu_Category__c deletedCat : [
                SELECT Id, Name
                FROM Menu_Category__c
                WHERE Id IN :missingCategoryIds
                ALL ROWS
            ]) {
                deletedCategoryNamesById.put(deletedCat.Id, deletedCat.Name);
            }
        }
        for (AggregateResult row : categoryRows) {
            CategoryPoint point = new CategoryPoint();
            point.categoryId = (Id)row.get('categoryId');
            String rawCategoryName = (String)row.get('categoryName');
            if (String.isBlank(rawCategoryName)) {
                point.isDeleted = true;
                String deletedName = point.categoryId == null ? null : deletedCategoryNamesById.get(point.categoryId);
                if (String.isBlank(deletedName)) {
                    deletedName = 'Unknown Category';
                }
                point.categoryName = deletedName + ' (deleted now)';
            } else {
                point.categoryName = rawCategoryName;
                point.isDeleted = false;
            }
            point.orderCount = toDecimal(row.get('orderCount')).intValue();
            point.revenue = toDecimal(row.get('revenue'));
            payload.categoryMix.add(point);
        }

        payload.paymentMix = new List<PaymentPoint>();
        List<AggregateResult> paymentRows = Database.query(
            'SELECT Payment_Method__c paymentMethod, COUNT(Id) orderCount, SUM(Total_Amount__c) revenue ' +
            'FROM POS_Order__c WHERE ' + orderWhere +
            ' GROUP BY Payment_Method__c ORDER BY SUM(Total_Amount__c) DESC'
        );
        for (AggregateResult row : paymentRows) {
            PaymentPoint point = new PaymentPoint();
            point.paymentMethod = String.isBlank((String)row.get('paymentMethod')) ? 'Unspecified' : (String)row.get('paymentMethod');
            point.orderCount = toDecimal(row.get('orderCount')).intValue();
            point.revenue = toDecimal(row.get('revenue'));
            payload.paymentMix.add(point);
        }

        payload.tableStats = new List<TablePoint>();
        List<AggregateResult> tableRows = Database.query(
            'SELECT Table__r.Name tableName, COUNT(Id) orderCount, SUM(Total_Amount__c) revenue ' +
            'FROM POS_Order__c WHERE ' + orderWhere +
            ' GROUP BY Table__r.Name ORDER BY COUNT(Id) DESC LIMIT 12'
        );
        for (AggregateResult row : tableRows) {
            TablePoint point = new TablePoint();
            point.tableName = (String)row.get('tableName');
            point.orderCount = toDecimal(row.get('orderCount')).intValue();
            point.revenue = toDecimal(row.get('revenue'));
            point.avgOrderValue = point.orderCount > 0 ? (point.revenue / point.orderCount).setScale(2) : 0;
            payload.tableStats.add(point);
        }

        payload.orderDetails = new List<OrderDetail>();
        List<POS_Order__c> orderRows = Database.query(
            'SELECT Id, Name, Status__c, Order_DateTime__c, Table__r.Name, Customer_Name__c, Customer__r.Name, Customer__r.Phone__c, ' +
            'Payment_Method__c, Payment_Status__c, Item_Count__c, Subtotal__c, Discount_Amount__c, Tax_Amount__c, Total_Amount__c, Notes__c, ' +
            '(SELECT Id, Item_Name__c, Quantity__c, Unit_Price__c, Line_Total__c, Notes__c, Status__c FROM Order_Items__r ORDER BY CreatedDate ASC) ' +
            'FROM POS_Order__c WHERE ' + orderWhere +
            ' ORDER BY Order_DateTime__c DESC LIMIT 100'
        );
        for (POS_Order__c orderRec : orderRows) {
            OrderDetail detail = new OrderDetail();
            detail.orderId = orderRec.Id;
            detail.orderName = orderRec.Name;
            detail.status = orderRec.Status__c;
            detail.orderDateTime = orderRec.Order_DateTime__c;
            detail.tableName = orderRec.Table__r == null ? null : orderRec.Table__r.Name;
            detail.customerName = String.isNotBlank(orderRec.Customer_Name__c)
                ? orderRec.Customer_Name__c
                : (orderRec.Customer__r == null ? null : orderRec.Customer__r.Name);
            detail.customerPhone = orderRec.Customer__r == null ? null : orderRec.Customer__r.Phone__c;
            detail.paymentMethod = orderRec.Payment_Method__c;
            detail.paymentStatus = orderRec.Payment_Status__c;
            detail.itemCount = orderRec.Item_Count__c == null ? 0 : orderRec.Item_Count__c.intValue();
            detail.subtotal = orderRec.Subtotal__c;
            detail.discountAmount = orderRec.Discount_Amount__c;
            detail.taxAmount = orderRec.Tax_Amount__c;
            detail.totalAmount = orderRec.Total_Amount__c;
            detail.notes = orderRec.Notes__c;
            detail.lineItems = new List<OrderLineItem>();
            if (orderRec.Order_Items__r != null) {
                for (Order_Item__c line : orderRec.Order_Items__r) {
                    OrderLineItem lineItem = new OrderLineItem();
                    lineItem.itemName = line.Item_Name__c;
                    lineItem.quantity = line.Quantity__c == null ? 0 : line.Quantity__c.intValue();
                    lineItem.unitPrice = line.Unit_Price__c;
                    lineItem.lineTotal = line.Line_Total__c;
                    lineItem.notes = line.Notes__c;
                    lineItem.status = line.Status__c;
                    detail.lineItems.add(lineItem);
                }
            }
            payload.orderDetails.add(detail);
        }

        payload.topItems = new List<ItemPoint>();
        List<AggregateResult> topRows = Database.query(
            'SELECT Item_Name__c itemName, SUM(Quantity__c) qty, SUM(Line_Total__c) lineRevenue ' +
            'FROM Order_Item__c WHERE ' + itemWhere +
            ' GROUP BY Item_Name__c ORDER BY SUM(Quantity__c) DESC LIMIT 5'
        );
        for (AggregateResult row : topRows) {
            payload.topItems.add(toItemPoint(row));
        }

        payload.slowItems = new List<ItemPoint>();
        List<AggregateResult> slowRows = Database.query(
            'SELECT Item_Name__c itemName, SUM(Quantity__c) qty, SUM(Line_Total__c) lineRevenue ' +
            'FROM Order_Item__c WHERE ' + itemWhere +
            ' GROUP BY Item_Name__c ORDER BY SUM(Quantity__c) ASC LIMIT 5'
        );
        for (AggregateResult row : slowRows) {
            payload.slowItems.add(toItemPoint(row));
        }

        payload.exceptions = new ExceptionSection();
        payload.exceptions.highDiscountOrderCount = [
            SELECT COUNT()
            FROM POS_Order__c
            WHERE Restaurant__c = :restaurantId
              AND Order_DateTime__c >= :startDt
              AND Order_DateTime__c < :endDt
              AND Discount_Percent__c >= 20
        ];
        payload.exceptions.cancelledOrderCount = [
            SELECT COUNT()
            FROM POS_Order__c
            WHERE Restaurant__c = :restaurantId
              AND Order_DateTime__c >= :startDt
              AND Order_DateTime__c < :endDt
              AND Status__c = 'Cancelled'
        ];
        payload.exceptions.unpaidOrderCount = [
            SELECT COUNT()
            FROM POS_Order__c
            WHERE Restaurant__c = :restaurantId
              AND Order_DateTime__c >= :startDt
              AND Order_DateTime__c < :endDt
              AND Status__c IN ('Served', 'Closed')
              AND (Payment_Status__c = null OR Payment_Status__c != 'Paid')
        ];
        payload.exceptions.soldOutItemCount = [
            SELECT COUNT()
            FROM Menu_Item__c
            WHERE Restaurant__c = :restaurantId
              AND Is_Available__c = false
        ];

        return payload;
    }

    private static DateRange resolveDateRange(Date startDate, Date endDate, String preset) {
        Date today = Date.today();
        DateRange range = new DateRange();
        String normalizedPreset = String.isBlank(preset) ? 'today' : preset.toLowerCase();
        if (normalizedPreset == 'yesterday') {
            range.fromDate = today.addDays(-1);
            range.toDate = today.addDays(-1);
            return range;
        }
        if (normalizedPreset == 'last7') {
            range.fromDate = today.addDays(-6);
            range.toDate = today;
            return range;
        }
        if (normalizedPreset == 'last30') {
            range.fromDate = today.addDays(-29);
            range.toDate = today;
            return range;
        }
        if (normalizedPreset == 'custom') {
            range.fromDate = startDate == null ? today : startDate;
            range.toDate = endDate == null ? today : endDate;
            return range;
        }
        range.fromDate = today;
        range.toDate = today;
        return range;
    }

    private static String buildOrderWhere(
        String restaurantId,
        DateTime startDt,
        DateTime endDt,
        Set<String> statuses,
        String paymentMethod,
        String categoryId
    ) {
        String whereClause = 'Restaurant__c = :restaurantId AND Order_DateTime__c >= :startDt AND Order_DateTime__c < :endDt AND Status__c IN :statuses';
        if (String.isNotBlank(paymentMethod)) {
            whereClause += ' AND Payment_Method__c = :paymentMethod';
        }
        if (String.isNotBlank(categoryId)) {
            whereClause += ' AND Id IN (SELECT POS_Order__c FROM Order_Item__c WHERE Menu_Item__r.Menu_Category__c = :categoryId)';
        }
        return whereClause;
    }

    private static String buildItemWhere(
        String restaurantId,
        DateTime startDt,
        DateTime endDt,
        Set<String> statuses,
        String paymentMethod,
        String categoryId
    ) {
        String whereClause = 'POS_Order__r.Restaurant__c = :restaurantId AND POS_Order__r.Order_DateTime__c >= :startDt AND POS_Order__r.Order_DateTime__c < :endDt AND POS_Order__r.Status__c IN :statuses';
        if (String.isNotBlank(paymentMethod)) {
            whereClause += ' AND POS_Order__r.Payment_Method__c = :paymentMethod';
        }
        if (String.isNotBlank(categoryId)) {
            whereClause += ' AND Menu_Item__r.Menu_Category__c = :categoryId';
        }
        return whereClause;
    }

    private static ItemPoint toItemPoint(AggregateResult row) {
        ItemPoint item = new ItemPoint();
        item.itemName = (String)row.get('itemName');
        item.quantity = toDecimal(row.get('qty')).intValue();
        item.revenue = toDecimal(row.get('lineRevenue'));
        return item;
    }

    private static Decimal toDecimal(Object value) {
        if (value == null) {
            return 0;
        }
        if (value instanceof Decimal) {
            return (Decimal)value;
        }
        if (value instanceof Integer) {
            return Decimal.valueOf((Integer)value);
        }
        if (value instanceof Long) {
            return Decimal.valueOf(String.valueOf((Long)value));
        }
        return Decimal.valueOf(String.valueOf(value));
    }

    private static Decimal percentDelta(Decimal currentValue, Decimal previousValue) {
        if (previousValue == null || previousValue == 0) {
            return currentValue > 0 ? 100 : 0;
        }
        return (((currentValue - previousValue) / previousValue) * 100).setScale(2);
    }

    public class ReportPayload {
        @AuraEnabled public SummarySection summary;
        @AuraEnabled public ComparisonSection comparison;
        @AuraEnabled public List<HourlyPoint> hourlyTrend;
        @AuraEnabled public List<DailyPoint> dailyTrend;
        @AuraEnabled public List<CategoryPoint> categoryMix;
        @AuraEnabled public List<PaymentPoint> paymentMix;
        @AuraEnabled public List<TablePoint> tableStats;
        @AuraEnabled public List<OrderDetail> orderDetails;
        @AuraEnabled public ExceptionSection exceptions;
        @AuraEnabled public List<ItemPoint> topItems;
        @AuraEnabled public List<ItemPoint> slowItems;
    }

    public class SummarySection {
        @AuraEnabled public Integer orderCount;
        @AuraEnabled public Decimal revenue;
        @AuraEnabled public Decimal discountAmount;
        @AuraEnabled public Decimal avgOrderValue;
        @AuraEnabled public Decimal discountRate;
        @AuraEnabled public Decimal taxAmount;
        @AuraEnabled public Decimal cgstAmount;
        @AuraEnabled public Decimal sgstAmount;
    }

    public class ComparisonSection {
        @AuraEnabled public Integer previousOrderCount;
        @AuraEnabled public Decimal previousRevenue;
        @AuraEnabled public Decimal orderDeltaPercent;
        @AuraEnabled public Decimal revenueDeltaPercent;
    }

    public class HourlyPoint {
        @AuraEnabled public String label;
        @AuraEnabled public Integer orderCount;
        @AuraEnabled public Decimal revenue;
    }

    public class DailyPoint {
        @AuraEnabled public String dateLabel;
        @AuraEnabled public Integer orderCount;
        @AuraEnabled public Decimal revenue;
    }

    public class CategoryPoint {
        @AuraEnabled public Id categoryId;
        @AuraEnabled public String categoryName;
        @AuraEnabled public Boolean isDeleted;
        @AuraEnabled public Integer orderCount;
        @AuraEnabled public Decimal revenue;
    }

    public class PaymentPoint {
        @AuraEnabled public String paymentMethod;
        @AuraEnabled public Integer orderCount;
        @AuraEnabled public Decimal revenue;
    }

    public class TablePoint {
        @AuraEnabled public String tableName;
        @AuraEnabled public Integer orderCount;
        @AuraEnabled public Decimal revenue;
        @AuraEnabled public Decimal avgOrderValue;
    }

    public class ExceptionSection {
        @AuraEnabled public Integer highDiscountOrderCount;
        @AuraEnabled public Integer cancelledOrderCount;
        @AuraEnabled public Integer unpaidOrderCount;
        @AuraEnabled public Integer soldOutItemCount;
    }

    public class ItemPoint {
        @AuraEnabled public String itemName;
        @AuraEnabled public Integer quantity;
        @AuraEnabled public Decimal revenue;
    }

    public class OrderDetail {
        @AuraEnabled public Id orderId;
        @AuraEnabled public String orderName;
        @AuraEnabled public String status;
        @AuraEnabled public DateTime orderDateTime;
        @AuraEnabled public String tableName;
        @AuraEnabled public String customerName;
        @AuraEnabled public String customerPhone;
        @AuraEnabled public String paymentMethod;
        @AuraEnabled public String paymentStatus;
        @AuraEnabled public Integer itemCount;
        @AuraEnabled public Decimal subtotal;
        @AuraEnabled public Decimal discountAmount;
        @AuraEnabled public Decimal taxAmount;
        @AuraEnabled public Decimal totalAmount;
        @AuraEnabled public String notes;
        @AuraEnabled public List<OrderLineItem> lineItems;
    }

    public class OrderLineItem {
        @AuraEnabled public String itemName;
        @AuraEnabled public Integer quantity;
        @AuraEnabled public Decimal unitPrice;
        @AuraEnabled public Decimal lineTotal;
        @AuraEnabled public String notes;
        @AuraEnabled public String status;
    }

    private class DateRange {
        public Date fromDate;
        public Date toDate;
    }

    private static Boolean isGuestContext() {
        return UserInfo.getUserType() == 'Guest';
    }
}

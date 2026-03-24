public without sharing class OrderController {

    @AuraEnabled
    public static POS_Order__c createOrder(String restaurantId, String tableId, String customerId) {
        POS_Order__c ord = new POS_Order__c(
            Restaurant__c = restaurantId,
            Table__c = tableId,
            Status__c = 'New',
            Order_DateTime__c = Datetime.now(),
            Subtotal__c = 0,
            Tax_Amount__c = 0,
            Total_Amount__c = 0,
            Item_Count__c = 0
        );
        if (String.isNotBlank(customerId)) {
            ord.Customer__c = customerId;
        }
        insert ord;

        Restaurant_Table__c tbl = new Restaurant_Table__c(
            Id = tableId,
            Current_Order__c = ord.Id
        );
        update tbl;

        return [
            SELECT Id, Name, Status__c, Order_DateTime__c,
                   Subtotal__c, Tax_Amount__c, Total_Amount__c,
                   Table__r.Name, Item_Count__c
            FROM POS_Order__c
            WHERE Id = :ord.Id
        ];
    }

    @AuraEnabled
    public static Order_Item__c addOrderItem(String orderId, String menuItemId, Integer quantity, String notes) {
        Integer qty = (quantity != null && quantity > 0) ? quantity : 1;

        List<Order_Item__c> existing = [
            SELECT Id, Quantity__c
            FROM Order_Item__c
            WHERE POS_Order__c = :orderId
              AND Menu_Item__c = :menuItemId
              AND Status__c != 'Cancelled'
            LIMIT 1
        ];

        Id itemId;
        if (!existing.isEmpty()) {
            existing[0].Quantity__c += qty;
            update existing[0];
            itemId = existing[0].Id;
        } else {
            Menu_Item__c menuItem = [
                SELECT Id, Name, Price__c
                FROM Menu_Item__c
                WHERE Id = :menuItemId
                LIMIT 1
            ];
            Order_Item__c item = new Order_Item__c(
                POS_Order__c = orderId,
                Menu_Item__c = menuItemId,
                Item_Name__c = menuItem.Name,
                Unit_Price__c = menuItem.Price__c,
                Quantity__c = qty,
                Notes__c = notes,
                Status__c = 'Ordered'
            );
            insert item;
            itemId = item.Id;
        }

        recalculateOrderTotals(orderId);

        return [
            SELECT Id, Name, Item_Name__c, Quantity__c, Unit_Price__c,
                   Line_Total__c, Notes__c, Status__c
            FROM Order_Item__c
            WHERE Id = :itemId
        ];
    }

    @AuraEnabled
    public static void updateOrderItemQuantity(String orderItemId, Integer quantity) {
        Order_Item__c item = [SELECT Id, POS_Order__c FROM Order_Item__c WHERE Id = :orderItemId];
        if (quantity <= 0) {
            delete item;
        } else {
            item.Quantity__c = quantity;
            update item;
        }
        recalculateOrderTotals(item.POS_Order__c);
    }

    @AuraEnabled
    public static void removeOrderItem(String orderItemId) {
        Order_Item__c item = [SELECT Id, POS_Order__c FROM Order_Item__c WHERE Id = :orderItemId];
        Id orderId = item.POS_Order__c;
        delete item;
        recalculateOrderTotals(orderId);
    }

    /**
     * Cart-only payload after line mutations: lighter than getOrder (no customer/table/restaurant joins).
     */
    @AuraEnabled
    public static OrderCartSnapshot getOrderCartSnapshot(String orderId) {
        POS_Order__c header = [
            SELECT Subtotal__c, Tax_Amount__c, Discount_Amount__c, Discount_Percent__c,
                   Total_Amount__c, Item_Count__c
            FROM POS_Order__c
            WHERE Id = :orderId
        ];
        List<Order_Item__c> lines = [
            SELECT Id, Item_Name__c, Quantity__c, Unit_Price__c, Line_Total__c,
                   Notes__c, Status__c, Menu_Item__c
            FROM Order_Item__c
            WHERE POS_Order__c = :orderId
              AND Status__c != 'Cancelled'
            ORDER BY CreatedDate ASC
        ];
        OrderCartSnapshot snap = new OrderCartSnapshot();
        snap.subtotal = header.Subtotal__c;
        snap.taxAmount = header.Tax_Amount__c;
        snap.discountAmount = header.Discount_Amount__c;
        snap.discountPercent = header.Discount_Percent__c;
        snap.totalAmount = header.Total_Amount__c;
        snap.itemCount = header.Item_Count__c == null ? 0 : header.Item_Count__c.intValue();
        snap.lineItems = lines;
        return snap;
    }

    @AuraEnabled
    public static POS_Order__c getOrder(String orderId) {
        return [
            SELECT Id, Name, Status__c, Order_DateTime__c,
                   Subtotal__c, Tax_Amount__c, Discount_Percent__c,
                   Discount_Amount__c, Total_Amount__c,
                   Payment_Method__c, Payment_Status__c,
                   Customer_Name__c, Notes__c, Item_Count__c,
                   Customer__c, Customer__r.Name, Customer__r.Phone__c,
                   Customer__r.Visit_Count__c,
                   WhatsApp_Receipt_Opt_In__c,
                   Restaurant__c, Restaurant__r.Name,
                   Restaurant__r.Tax_Rate__c, Restaurant__r.Currency_Code__c,
                   Table__c, Table__r.Name,
                   (SELECT Id, Item_Name__c, Quantity__c, Unit_Price__c,
                           Line_Total__c, Notes__c, Status__c, Menu_Item__c
                    FROM Order_Items__r
                    WHERE Status__c != 'Cancelled'
                    ORDER BY CreatedDate ASC)
            FROM POS_Order__c
            WHERE Id = :orderId
        ];
    }

    @AuraEnabled
    public static List<POS_Order__c> getActiveOrders(String restaurantId) {
        return [
            SELECT Id, Name, Status__c, Order_DateTime__c,
                   Table__r.Name, Total_Amount__c, Item_Count__c
            FROM POS_Order__c
            WHERE Restaurant__c = :restaurantId
              AND Status__c NOT IN ('Closed', 'Cancelled', 'Served')
            ORDER BY Order_DateTime__c DESC
        ];
    }

    @AuraEnabled
    public static POS_Order__c updateOrderStatus(String orderId, String status) {
        POS_Order__c ord = new POS_Order__c(Id = orderId, Status__c = status);
        update ord;

        if (status == 'Served' || status == 'Closed' || status == 'Cancelled') {
            List<POS_Order__c> orderWithTable = [
                SELECT Table__c FROM POS_Order__c WHERE Id = :orderId
            ];
            if (!orderWithTable.isEmpty() && orderWithTable[0].Table__c != null) {
                Restaurant_Table__c tbl = new Restaurant_Table__c(
                    Id = orderWithTable[0].Table__c,
                    Status__c = 'Available',
                    Current_Order__c = null
                );
                update tbl;
            }
        }

        return [SELECT Id, Name, Status__c FROM POS_Order__c WHERE Id = :orderId];
    }

    @AuraEnabled
    public static void linkCustomerToOrder(String orderId, String customerId) {
        POS_Order__c ord = new POS_Order__c(Id = orderId, Customer__c = customerId);
        update ord;
    }

    @AuraEnabled
    public static void updateOrderWhatsAppOptIn(String orderId, Boolean optIn) {
        if (String.isBlank(orderId)) {
            return;
        }
        update new POS_Order__c(Id = orderId, WhatsApp_Receipt_Opt_In__c = (optIn == true));
    }

    @AuraEnabled
    public static void updateOrderPaymentDetails(String orderId, String paymentMethod, String paymentStatus) {
        if (String.isBlank(orderId)) {
            throw new AuraHandledException('Order id is required.');
        }
        if (String.isBlank(paymentMethod)) {
            throw new AuraHandledException('Payment method is required.');
        }
        if (String.isBlank(paymentStatus)) {
            throw new AuraHandledException('Payment status is required.');
        }
        update new POS_Order__c(
            Id = orderId,
            Payment_Method__c = paymentMethod,
            Payment_Status__c = paymentStatus
        );
    }

    @AuraEnabled
    public static POS_Order__c applyDiscount(String orderId, Decimal discountPercent) {
        POS_Order__c ord = [
            SELECT Id, Subtotal__c, Restaurant__r.Tax_Rate__c
            FROM POS_Order__c
            WHERE Id = :orderId
        ];
        Decimal subtotal = ord.Subtotal__c != null ? ord.Subtotal__c : 0;
        Decimal discountAmt = subtotal * (discountPercent / 100);
        Decimal taxRate = ord.Restaurant__r.Tax_Rate__c != null ? ord.Restaurant__r.Tax_Rate__c : 0;
        Decimal taxAmt = (subtotal - discountAmt) * (taxRate / 100);

        ord.Discount_Percent__c = discountPercent;
        ord.Discount_Amount__c = discountAmt;
        ord.Tax_Amount__c = taxAmt;
        ord.Total_Amount__c = subtotal - discountAmt + taxAmt;
        update ord;

        return getOrder(orderId);
    }

    @AuraEnabled
    public static Receipt__c closeOrder(String orderId) {
        POS_Order__c ord = [SELECT Id, Customer__c, Table__c, Payment_Method__c, Payment_Status__c FROM POS_Order__c WHERE Id = :orderId];
        if (String.isBlank(ord.Payment_Status__c)) {
            ord.Payment_Status__c = 'Pending';
        }
        ord.Status__c = 'Served';
        update ord;

        if (ord.Table__c != null) {
            Restaurant_Table__c tbl = new Restaurant_Table__c(
                Id = ord.Table__c,
                Status__c = 'Available',
                Current_Order__c = null
            );
            update tbl;
        }

        if (ord.Customer__c != null) {
            Customer__c cust = [SELECT Id, Visit_Count__c FROM Customer__c WHERE Id = :ord.Customer__c];
            cust.Visit_Count__c = (cust.Visit_Count__c != null ? cust.Visit_Count__c : 0) + 1;
            cust.Last_Visit__c = Datetime.now();
            update cust;
        }

        return ReceiptController.generateReceipt(orderId);
    }

    private static void recalculateOrderTotals(Id orderId) {
        List<AggregateResult> agg = [
            SELECT SUM(Line_Total__c) totalAmt, COUNT(Id) itemCount
            FROM Order_Item__c
            WHERE POS_Order__c = :orderId AND Status__c != 'Cancelled'
        ];

        Decimal subtotal = 0;
        Integer itemCount = 0;
        if (!agg.isEmpty()) {
            subtotal = (Decimal)(agg[0].get('totalAmt') != null ? agg[0].get('totalAmt') : 0);
            itemCount = (Integer)agg[0].get('itemCount');
        }

        POS_Order__c ord = [
            SELECT Id, Discount_Percent__c, Restaurant__r.Tax_Rate__c
            FROM POS_Order__c
            WHERE Id = :orderId
        ];

        Decimal discountPct = ord.Discount_Percent__c != null ? ord.Discount_Percent__c : 0;
        Decimal discountAmt = subtotal * (discountPct / 100);
        Decimal taxRate = ord.Restaurant__r.Tax_Rate__c != null ? ord.Restaurant__r.Tax_Rate__c : 0;
        Decimal taxAmt = (subtotal - discountAmt) * (taxRate / 100);

        ord.Subtotal__c = subtotal;
        ord.Item_Count__c = itemCount;
        ord.Discount_Amount__c = discountAmt;
        ord.Tax_Amount__c = taxAmt;
        ord.Total_Amount__c = subtotal - discountAmt + taxAmt;
        update ord;
    }

    public class OrderCartSnapshot {
        @AuraEnabled
        public Decimal subtotal;
        @AuraEnabled
        public Decimal taxAmount;
        @AuraEnabled
        public Decimal discountAmount;
        @AuraEnabled
        public Decimal discountPercent;
        @AuraEnabled
        public Decimal totalAmount;
        @AuraEnabled
        public Integer itemCount;
        @AuraEnabled
        public List<Order_Item__c> lineItems;
    }
}

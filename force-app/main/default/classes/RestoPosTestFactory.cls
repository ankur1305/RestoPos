@IsTest
public class RestoPosTestFactory {

    public static Restaurant__c createRestaurant() {
        Restaurant__c r = new Restaurant__c(
            Name = 'Test Restaurant',
            Code__c = 'TEST01',
            Tax_Rate__c = 5.0,
            Currency_Code__c = 'INR',
            PIN__c = '123456',
            Manager_PIN__c = '999999',
            Is_Active__c = true,
            Address__c = '123 Test Street',
            Phone__c = '9876543210',
            Email__c = 'test@example.com'
        );
        insert r;
        return r;
    }

    public static List<Restaurant_Table__c> createTables(Id restaurantId, Integer count) {
        List<Restaurant_Table__c> tables = new List<Restaurant_Table__c>();
        for (Integer i = 1; i <= count; i++) {
            tables.add(new Restaurant_Table__c(
                Name = 'T' + i,
                Restaurant__c = restaurantId,
                Capacity__c = 4,
                Status__c = 'Available',
                Sort_Order__c = i
            ));
        }
        insert tables;
        return tables;
    }

    public static Menu_Category__c createCategory(Id restaurantId, String name) {
        Menu_Category__c cat = new Menu_Category__c(
            Name = name,
            Restaurant__c = restaurantId,
            Sort_Order__c = 1,
            Is_Active__c = true
        );
        insert cat;
        return cat;
    }

    public static Menu_Item__c createMenuItem(Id restaurantId, Id categoryId, String name, Decimal price) {
        Menu_Item__c item = new Menu_Item__c(
            Name = name,
            Restaurant__c = restaurantId,
            Menu_Category__c = categoryId,
            Price__c = price,
            Is_Available__c = true,
            Sort_Order__c = 1
        );
        insert item;
        return item;
    }

    public static Customer__c createCustomer(Id restaurantId, String name, String phone, String email) {
        Customer__c customer = new Customer__c(
            Name = name,
            Phone__c = phone,
            Email__c = email,
            Restaurant__c = restaurantId,
            Visit_Count__c = 0
        );
        insert customer;
        return customer;
    }
}

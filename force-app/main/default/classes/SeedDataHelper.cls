public class SeedDataHelper {

    public static void run() {
        delete [SELECT Id FROM Receipt__c];
        delete [SELECT Id FROM Order_Item__c];
        delete [SELECT Id FROM POS_Order__c];
        delete [SELECT Id FROM Menu_Item__c];
        delete [SELECT Id FROM Menu_Category__c];
        delete [SELECT Id FROM Restaurant_Table__c];
        delete [SELECT Id FROM Restaurant__c];

        Restaurant__c rest = new Restaurant__c(
            Name = 'The Curry House',
            Code__c = 'TCH001',
            Address__c = '123 MG Road, Bengaluru 560001',
            Phone__c = '+91-9876543210',
            Tax_Rate__c = 5.0,
            Currency_Code__c = 'INR',
            PIN__c = '1234',
            Is_Active__c = true
        );
        insert rest;

        List<Restaurant_Table__c> tables = new List<Restaurant_Table__c>();
        for (Integer i = 1; i <= 10; i++) {
            tables.add(new Restaurant_Table__c(
                Name = 'T' + i,
                Restaurant__c = rest.Id,
                Capacity__c = (Math.mod(i, 3) == 0) ? 6 : 4,
                Status__c = 'Available',
                Sort_Order__c = i
            ));
        }
        insert tables;

        List<Menu_Category__c> categories = new List<Menu_Category__c>{
            new Menu_Category__c(Name='Starters', Restaurant__c=rest.Id, Sort_Order__c=1, Is_Active__c=true),
            new Menu_Category__c(Name='Main Course', Restaurant__c=rest.Id, Sort_Order__c=2, Is_Active__c=true),
            new Menu_Category__c(Name='Breads', Restaurant__c=rest.Id, Sort_Order__c=3, Is_Active__c=true),
            new Menu_Category__c(Name='Beverages', Restaurant__c=rest.Id, Sort_Order__c=4, Is_Active__c=true),
            new Menu_Category__c(Name='Desserts', Restaurant__c=rest.Id, Sort_Order__c=5, Is_Active__c=true)
        };
        insert categories;

        Map<String, Id> catMap = new Map<String, Id>();
        for (Menu_Category__c c : categories) { catMap.put(c.Name, c.Id); }

        List<Menu_Item__c> items = new List<Menu_Item__c>{
            new Menu_Item__c(Name='Paneer Tikka', Menu_Category__c=catMap.get('Starters'), Restaurant__c=rest.Id, Price__c=250, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=1),
            new Menu_Item__c(Name='Chicken 65', Menu_Category__c=catMap.get('Starters'), Restaurant__c=rest.Id, Price__c=280, Is_Available__c=true, Is_Vegetarian__c=false, Sort_Order__c=2),
            new Menu_Item__c(Name='Veg Spring Roll', Menu_Category__c=catMap.get('Starters'), Restaurant__c=rest.Id, Price__c=180, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=3),
            new Menu_Item__c(Name='Butter Chicken', Menu_Category__c=catMap.get('Main Course'), Restaurant__c=rest.Id, Price__c=350, Is_Available__c=true, Is_Vegetarian__c=false, Sort_Order__c=1),
            new Menu_Item__c(Name='Dal Makhani', Menu_Category__c=catMap.get('Main Course'), Restaurant__c=rest.Id, Price__c=220, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=2),
            new Menu_Item__c(Name='Palak Paneer', Menu_Category__c=catMap.get('Main Course'), Restaurant__c=rest.Id, Price__c=240, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=3),
            new Menu_Item__c(Name='Chicken Biryani', Menu_Category__c=catMap.get('Main Course'), Restaurant__c=rest.Id, Price__c=300, Is_Available__c=true, Is_Vegetarian__c=false, Sort_Order__c=4),
            new Menu_Item__c(Name='Butter Naan', Menu_Category__c=catMap.get('Breads'), Restaurant__c=rest.Id, Price__c=60, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=1),
            new Menu_Item__c(Name='Garlic Naan', Menu_Category__c=catMap.get('Breads'), Restaurant__c=rest.Id, Price__c=70, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=2),
            new Menu_Item__c(Name='Tandoori Roti', Menu_Category__c=catMap.get('Breads'), Restaurant__c=rest.Id, Price__c=40, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=3),
            new Menu_Item__c(Name='Masala Chai', Menu_Category__c=catMap.get('Beverages'), Restaurant__c=rest.Id, Price__c=40, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=1),
            new Menu_Item__c(Name='Fresh Lime Soda', Menu_Category__c=catMap.get('Beverages'), Restaurant__c=rest.Id, Price__c=60, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=2),
            new Menu_Item__c(Name='Cold Coffee', Menu_Category__c=catMap.get('Beverages'), Restaurant__c=rest.Id, Price__c=80, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=3),
            new Menu_Item__c(Name='Gulab Jamun', Menu_Category__c=catMap.get('Desserts'), Restaurant__c=rest.Id, Price__c=100, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=1),
            new Menu_Item__c(Name='Rasmalai', Menu_Category__c=catMap.get('Desserts'), Restaurant__c=rest.Id, Price__c=120, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=2)
        };
        insert items;

        System.debug('Seed data created: ' + rest.Name + ' (Code: ' + rest.Code__c + ', PIN: 1234)');
        System.debug('Tables: ' + tables.size() + ', Categories: ' + categories.size() + ', Menu Items: ' + items.size());
    }

    public static void addMoreRestaurants() {
        // Restaurant 2: Spice Garden
        Restaurant__c r2 = new Restaurant__c(
            Name = 'Spice Garden',
            Code__c = 'SPG001',
            Address__c = '45 Brigade Road, Bengaluru 560025',
            Phone__c = '+91-9988776655',
            Tax_Rate__c = 5.0,
            Currency_Code__c = 'INR',
            PIN__c = '5678',
            Is_Active__c = true
        );
        insert r2;

        List<Restaurant_Table__c> tables2 = new List<Restaurant_Table__c>();
        for (Integer i = 1; i <= 8; i++) {
            tables2.add(new Restaurant_Table__c(
                Name = 'S' + i,
                Restaurant__c = r2.Id,
                Capacity__c = (Math.mod(i, 4) == 0) ? 8 : (Math.mod(i, 2) == 0) ? 6 : 4,
                Status__c = 'Available',
                Sort_Order__c = i
            ));
        }
        insert tables2;

        List<Menu_Category__c> cats2 = new List<Menu_Category__c>{
            new Menu_Category__c(Name='Soups', Restaurant__c=r2.Id, Sort_Order__c=1, Is_Active__c=true),
            new Menu_Category__c(Name='Tandoor', Restaurant__c=r2.Id, Sort_Order__c=2, Is_Active__c=true),
            new Menu_Category__c(Name='Curries', Restaurant__c=r2.Id, Sort_Order__c=3, Is_Active__c=true),
            new Menu_Category__c(Name='Rice & Biryani', Restaurant__c=r2.Id, Sort_Order__c=4, Is_Active__c=true),
            new Menu_Category__c(Name='Drinks', Restaurant__c=r2.Id, Sort_Order__c=5, Is_Active__c=true),
            new Menu_Category__c(Name='Desserts', Restaurant__c=r2.Id, Sort_Order__c=6, Is_Active__c=true)
        };
        insert cats2;

        Map<String, Id> cm2 = new Map<String, Id>();
        for (Menu_Category__c c : cats2) { cm2.put(c.Name, c.Id); }

        List<Menu_Item__c> items2 = new List<Menu_Item__c>{
            new Menu_Item__c(Name='Tomato Shorba', Menu_Category__c=cm2.get('Soups'), Restaurant__c=r2.Id, Price__c=150, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=1),
            new Menu_Item__c(Name='Chicken Hot & Sour', Menu_Category__c=cm2.get('Soups'), Restaurant__c=r2.Id, Price__c=180, Is_Available__c=true, Is_Vegetarian__c=false, Sort_Order__c=2),
            new Menu_Item__c(Name='Paneer Tikka', Menu_Category__c=cm2.get('Tandoor'), Restaurant__c=r2.Id, Price__c=280, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=1),
            new Menu_Item__c(Name='Chicken Tikka', Menu_Category__c=cm2.get('Tandoor'), Restaurant__c=r2.Id, Price__c=320, Is_Available__c=true, Is_Vegetarian__c=false, Sort_Order__c=2),
            new Menu_Item__c(Name='Seekh Kebab', Menu_Category__c=cm2.get('Tandoor'), Restaurant__c=r2.Id, Price__c=340, Is_Available__c=true, Is_Vegetarian__c=false, Sort_Order__c=3),
            new Menu_Item__c(Name='Tandoori Roti', Menu_Category__c=cm2.get('Tandoor'), Restaurant__c=r2.Id, Price__c=40, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=4),
            new Menu_Item__c(Name='Kadai Paneer', Menu_Category__c=cm2.get('Curries'), Restaurant__c=r2.Id, Price__c=260, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=1),
            new Menu_Item__c(Name='Rogan Josh', Menu_Category__c=cm2.get('Curries'), Restaurant__c=r2.Id, Price__c=380, Is_Available__c=true, Is_Vegetarian__c=false, Sort_Order__c=2),
            new Menu_Item__c(Name='Chettinad Chicken', Menu_Category__c=cm2.get('Curries'), Restaurant__c=r2.Id, Price__c=350, Is_Available__c=true, Is_Vegetarian__c=false, Sort_Order__c=3),
            new Menu_Item__c(Name='Dal Tadka', Menu_Category__c=cm2.get('Curries'), Restaurant__c=r2.Id, Price__c=200, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=4),
            new Menu_Item__c(Name='Veg Biryani', Menu_Category__c=cm2.get('Rice & Biryani'), Restaurant__c=r2.Id, Price__c=250, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=1),
            new Menu_Item__c(Name='Hyderabadi Dum Biryani', Menu_Category__c=cm2.get('Rice & Biryani'), Restaurant__c=r2.Id, Price__c=350, Is_Available__c=true, Is_Vegetarian__c=false, Sort_Order__c=2),
            new Menu_Item__c(Name='Jeera Rice', Menu_Category__c=cm2.get('Rice & Biryani'), Restaurant__c=r2.Id, Price__c=150, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=3),
            new Menu_Item__c(Name='Mango Lassi', Menu_Category__c=cm2.get('Drinks'), Restaurant__c=r2.Id, Price__c=90, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=1),
            new Menu_Item__c(Name='Masala Chaas', Menu_Category__c=cm2.get('Drinks'), Restaurant__c=r2.Id, Price__c=60, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=2),
            new Menu_Item__c(Name='Fresh Lime Water', Menu_Category__c=cm2.get('Drinks'), Restaurant__c=r2.Id, Price__c=50, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=3),
            new Menu_Item__c(Name='Phirni', Menu_Category__c=cm2.get('Desserts'), Restaurant__c=r2.Id, Price__c=120, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=1),
            new Menu_Item__c(Name='Kulfi', Menu_Category__c=cm2.get('Desserts'), Restaurant__c=r2.Id, Price__c=100, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=2)
        };
        insert items2;
        System.debug('Created: ' + r2.Name + ' (Code: SPG001, PIN: 5678) - ' + tables2.size() + ' tables, ' + items2.size() + ' items');

        // Restaurant 3: The Coastal Kitchen
        Restaurant__c r3 = new Restaurant__c(
            Name = 'The Coastal Kitchen',
            Code__c = 'TCK001',
            Address__c = '12 Koramangala 5th Block, Bengaluru 560095',
            Phone__c = '+91-9112233445',
            Tax_Rate__c = 5.0,
            Currency_Code__c = 'INR',
            PIN__c = '9012',
            Is_Active__c = true
        );
        insert r3;

        List<Restaurant_Table__c> tables3 = new List<Restaurant_Table__c>();
        for (Integer i = 1; i <= 12; i++) {
            tables3.add(new Restaurant_Table__c(
                Name = 'C' + i,
                Restaurant__c = r3.Id,
                Capacity__c = (i <= 4) ? 2 : (i <= 8) ? 4 : 6,
                Status__c = 'Available',
                Sort_Order__c = i
            ));
        }
        insert tables3;

        List<Menu_Category__c> cats3 = new List<Menu_Category__c>{
            new Menu_Category__c(Name='Appetizers', Restaurant__c=r3.Id, Sort_Order__c=1, Is_Active__c=true),
            new Menu_Category__c(Name='Seafood', Restaurant__c=r3.Id, Sort_Order__c=2, Is_Active__c=true),
            new Menu_Category__c(Name='South Indian', Restaurant__c=r3.Id, Sort_Order__c=3, Is_Active__c=true),
            new Menu_Category__c(Name='Mains', Restaurant__c=r3.Id, Sort_Order__c=4, Is_Active__c=true),
            new Menu_Category__c(Name='Beverages', Restaurant__c=r3.Id, Sort_Order__c=5, Is_Active__c=true),
            new Menu_Category__c(Name='Desserts', Restaurant__c=r3.Id, Sort_Order__c=6, Is_Active__c=true)
        };
        insert cats3;

        Map<String, Id> cm3 = new Map<String, Id>();
        for (Menu_Category__c c : cats3) { cm3.put(c.Name, c.Id); }

        List<Menu_Item__c> items3 = new List<Menu_Item__c>{
            new Menu_Item__c(Name='Fish Fry', Menu_Category__c=cm3.get('Appetizers'), Restaurant__c=r3.Id, Price__c=250, Is_Available__c=true, Is_Vegetarian__c=false, Sort_Order__c=1),
            new Menu_Item__c(Name='Prawn Koliwada', Menu_Category__c=cm3.get('Appetizers'), Restaurant__c=r3.Id, Price__c=320, Is_Available__c=true, Is_Vegetarian__c=false, Sort_Order__c=2),
            new Menu_Item__c(Name='Medu Vada', Menu_Category__c=cm3.get('Appetizers'), Restaurant__c=r3.Id, Price__c=120, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=3),
            new Menu_Item__c(Name='Goan Fish Curry', Menu_Category__c=cm3.get('Seafood'), Restaurant__c=r3.Id, Price__c=380, Is_Available__c=true, Is_Vegetarian__c=false, Sort_Order__c=1),
            new Menu_Item__c(Name='Prawn Masala', Menu_Category__c=cm3.get('Seafood'), Restaurant__c=r3.Id, Price__c=420, Is_Available__c=true, Is_Vegetarian__c=false, Sort_Order__c=2),
            new Menu_Item__c(Name='Crab Roast', Menu_Category__c=cm3.get('Seafood'), Restaurant__c=r3.Id, Price__c=500, Is_Available__c=true, Is_Vegetarian__c=false, Sort_Order__c=3),
            new Menu_Item__c(Name='Squid Pepper Fry', Menu_Category__c=cm3.get('Seafood'), Restaurant__c=r3.Id, Price__c=350, Is_Available__c=true, Is_Vegetarian__c=false, Sort_Order__c=4),
            new Menu_Item__c(Name='Masala Dosa', Menu_Category__c=cm3.get('South Indian'), Restaurant__c=r3.Id, Price__c=120, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=1),
            new Menu_Item__c(Name='Idli Sambar', Menu_Category__c=cm3.get('South Indian'), Restaurant__c=r3.Id, Price__c=100, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=2),
            new Menu_Item__c(Name='Appam with Stew', Menu_Category__c=cm3.get('South Indian'), Restaurant__c=r3.Id, Price__c=180, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=3),
            new Menu_Item__c(Name='Kerala Fish Moilee', Menu_Category__c=cm3.get('Mains'), Restaurant__c=r3.Id, Price__c=360, Is_Available__c=true, Is_Vegetarian__c=false, Sort_Order__c=1),
            new Menu_Item__c(Name='Malabar Parotta', Menu_Category__c=cm3.get('Mains'), Restaurant__c=r3.Id, Price__c=60, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=2),
            new Menu_Item__c(Name='Neer Dosa', Menu_Category__c=cm3.get('Mains'), Restaurant__c=r3.Id, Price__c=80, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=3),
            new Menu_Item__c(Name='Coconut Water', Menu_Category__c=cm3.get('Beverages'), Restaurant__c=r3.Id, Price__c=60, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=1),
            new Menu_Item__c(Name='Filter Coffee', Menu_Category__c=cm3.get('Beverages'), Restaurant__c=r3.Id, Price__c=50, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=2),
            new Menu_Item__c(Name='Sol Kadhi', Menu_Category__c=cm3.get('Beverages'), Restaurant__c=r3.Id, Price__c=70, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=3),
            new Menu_Item__c(Name='Payasam', Menu_Category__c=cm3.get('Desserts'), Restaurant__c=r3.Id, Price__c=110, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=1),
            new Menu_Item__c(Name='Mysore Pak', Menu_Category__c=cm3.get('Desserts'), Restaurant__c=r3.Id, Price__c=90, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=2)
        };
        insert items3;
        System.debug('Created: ' + r3.Name + ' (Code: TCK001, PIN: 9012) - ' + tables3.size() + ' tables, ' + items3.size() + ' items');
    }
}

// Delete existing test data
delete [SELECT Id FROM Receipt__c];
delete [SELECT Id FROM Order_Item__c];
delete [SELECT Id FROM POS_Order__c];
delete [SELECT Id FROM Menu_Item__c];
delete [SELECT Id FROM Menu_Category__c];
delete [SELECT Id FROM Restaurant_Table__c];
delete [SELECT Id FROM Restaurant__c];

// Create a Restaurant
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

// Create Tables
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

// Create Menu Categories
List<Menu_Category__c> categories = new List<Menu_Category__c>{
    new Menu_Category__c(Name='Starters', Restaurant__c=rest.Id, Sort_Order__c=1, Is_Active__c=true),
    new Menu_Category__c(Name='Main Course', Restaurant__c=rest.Id, Sort_Order__c=2, Is_Active__c=true),
    new Menu_Category__c(Name='Breads', Restaurant__c=rest.Id, Sort_Order__c=3, Is_Active__c=true),
    new Menu_Category__c(Name='Beverages', Restaurant__c=rest.Id, Sort_Order__c=4, Is_Active__c=true),
    new Menu_Category__c(Name='Desserts', Restaurant__c=rest.Id, Sort_Order__c=5, Is_Active__c=true)
};
insert categories;

// Create Menu Items
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

System.debug('Seed data created successfully!');
System.debug('Restaurant: ' + rest.Name + ' (Code: ' + rest.Code__c + ', PIN: 1234)');
System.debug('Tables: ' + tables.size());
System.debug('Categories: ' + categories.size());
System.debug('Menu Items: ' + items.size());

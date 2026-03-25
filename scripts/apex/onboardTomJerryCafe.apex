// Onboarding script for Tom & Jerry Cafe menu.
// Run:
// sf apex run --file scripts/apex/onboardTomJerryCafe.apex

String restaurantCode = 'TJC001';

List<Restaurant__c> existingRestaurants = [
    SELECT Id, Name
    FROM Restaurant__c
    WHERE Code__c = :restaurantCode
    LIMIT 1
];

Restaurant__c restaurant;
if (existingRestaurants.isEmpty()) {
    restaurant = new Restaurant__c(
        Name = 'Tom & Jerry Cafe',
        Code__c = restaurantCode,
        Address__c = 'Jain Mandir Road, Mohan Nagar Ex. Chouraha, Hindaun City (Karauli)',
        Phone__c = '+91-7340621959, +91-7300292655',
        Tax_Rate__c = 5.0,
        Currency_Code__c = 'INR',
        PIN__c = '123456',
        Manager_PIN__c = '999999',
        Is_Active__c = true
    );
    insert restaurant;
    System.debug('Created restaurant: ' + restaurant.Name);
} else {
    restaurant = existingRestaurants[0];
    System.debug('Restaurant already exists: ' + restaurant.Name + ' (reusing existing record).');
}

// Create tables only if none exist for this restaurant.
Integer existingTableCount = [
    SELECT COUNT()
    FROM Restaurant_Table__c
    WHERE Restaurant__c = :restaurant.Id
];

if (existingTableCount == 0) {
    List<Restaurant_Table__c> tables = new List<Restaurant_Table__c>();
    for (Integer i = 1; i <= 12; i++) {
        tables.add(new Restaurant_Table__c(
            Name = 'TJ-' + i,
            Restaurant__c = restaurant.Id,
            Capacity__c = (Math.mod(i, 4) == 0) ? 6 : 4,
            Status__c = 'Available',
            Sort_Order__c = i
        ));
    }
    insert tables;
    System.debug('Created tables: ' + tables.size());
} else {
    System.debug('Tables already exist for restaurant. Skipping table creation.');
}

List<String> categoryNames = new List<String>{
    'Aloo Kathi Roll',
    'Mix Veg Kathi Roll',
    'Paneer Kathi Roll',
    'Chap Kathi Roll',
    'Pizza',
    'Garlic Bread',
    'Cold Coffee',
    'Hot Coffee',
    'Burger',
    'Shake',
    'Patties',
    'Sandwiches',
    'Fries',
    'Momos',
    'Noodles',
    'Maggi',
    'Patatos'
};

Map<String, Menu_Category__c> existingCategoriesByName = new Map<String, Menu_Category__c>();
for (Menu_Category__c c : [
    SELECT Id, Name
    FROM Menu_Category__c
    WHERE Restaurant__c = :restaurant.Id
]) {
    existingCategoriesByName.put(c.Name, c);
}

List<Menu_Category__c> categoriesToInsert = new List<Menu_Category__c>();
for (Integer i = 0; i < categoryNames.size(); i++) {
    String categoryName = categoryNames[i];
    if (!existingCategoriesByName.containsKey(categoryName)) {
        categoriesToInsert.add(new Menu_Category__c(
            Name = categoryName,
            Restaurant__c = restaurant.Id,
            Sort_Order__c = i + 1,
            Is_Active__c = true
        ));
    }
}
if (!categoriesToInsert.isEmpty()) {
    insert categoriesToInsert;
}

Map<String, Id> categoryIdByName = new Map<String, Id>();
for (Menu_Category__c c : [
    SELECT Id, Name
    FROM Menu_Category__c
    WHERE Restaurant__c = :restaurant.Id
]) {
    categoryIdByName.put(c.Name, c.Id);
}

Map<String, Menu_Item__c> existingItemsByKey = new Map<String, Menu_Item__c>();
for (Menu_Item__c item : [
    SELECT Id, Name, Menu_Category__c
    FROM Menu_Item__c
    WHERE Restaurant__c = :restaurant.Id
]) {
    String key = item.Menu_Category__c + '|' + item.Name;
    existingItemsByKey.put(key, item);
}

List<Menu_Item__c> itemsToInsert = new List<Menu_Item__c>();
Map<String, Integer> sortOrderByCategory = new Map<String, Integer>();
for (String categoryName : categoryNames) {
    sortOrderByCategory.put(categoryName, 1);
}

List<String> menuRows = new List<String>{
    'Aloo Kathi Roll|Aloo Kathi Roll (Single)|40|true',
    'Aloo Kathi Roll|Aloo Kathi Roll (Double)|50|true',
    'Aloo Kathi Roll|Aloo Paneer Kathi Roll (Single)|50|true',
    'Aloo Kathi Roll|Aloo Paneer Kathi Roll (Double)|60|true',
    'Aloo Kathi Roll|Aloo Tandoori Kathi Roll (Single)|50|true',
    'Aloo Kathi Roll|Aloo Tandoori Kathi Roll (Double)|60|true',
    'Aloo Kathi Roll|Aloo Cheese Kathi Roll (Single)|50|true',
    'Aloo Kathi Roll|Aloo Cheese Kathi Roll (Double)|60|true',
    'Aloo Kathi Roll|Aloo Chilli Garlic Kathi Roll (Single)|50|true',
    'Aloo Kathi Roll|Aloo Chilli Garlic Kathi Roll (Double)|60|true',
    'Aloo Kathi Roll|Special Aloo Kathi Roll (Single)|60|true',
    'Aloo Kathi Roll|Special Aloo Kathi Roll (Double)|70|true',
    'Aloo Kathi Roll|Chowmean Roll (Single)|40|true',
    'Aloo Kathi Roll|Chowmean Roll (Double)|60|true',
    'Mix Veg Kathi Roll|Mix Veg Roll (Single)|50|true',
    'Mix Veg Kathi Roll|Mix Veg Roll (Double)|60|true',
    'Mix Veg Kathi Roll|Mix Veg Paneer Roll (Single)|60|true',
    'Mix Veg Kathi Roll|Mix Veg Paneer Roll (Double)|70|true',
    'Mix Veg Kathi Roll|Mix Veg Paneer Tandoori Roll (Single)|70|true',
    'Mix Veg Kathi Roll|Mix Veg Paneer Tandoori Roll (Double)|80|true',
    'Mix Veg Kathi Roll|Mix Veg Panner Cheese Roll (Single)|70|true',
    'Mix Veg Kathi Roll|Mix Veg Panner Cheese Roll (Double)|80|true',
    'Mix Veg Kathi Roll|Mix Veg Panner Makhni Roll (Single)|70|true',
    'Mix Veg Kathi Roll|Mix Veg Panner Makhni Roll (Double)|80|true',
    'Mix Veg Kathi Roll|Mix Veg Chilli Garlic Roll (Single)|70|true',
    'Mix Veg Kathi Roll|Mix Veg Chilli Garlic Roll (Double)|80|true',
    'Mix Veg Kathi Roll|Tom & Jerry Special Mix Veg Roll (Single)|70|true',
    'Mix Veg Kathi Roll|Tom & Jerry Special Mix Veg Roll (Double)|80|true',
    'Paneer Kathi Roll|Paneer Kathi Roll (Single)|70|true',
    'Paneer Kathi Roll|Paneer Kathi Roll (Double)|80|true',
    'Paneer Kathi Roll|Paneeri Tandoori Kathi Roll (Single)|80|true',
    'Paneer Kathi Roll|Paneeri Tandoori Kathi Roll (Double)|90|true',
    'Paneer Kathi Roll|Cheese Panner Kathi Roll (Single)|80|true',
    'Paneer Kathi Roll|Cheese Panner Kathi Roll (Double)|90|true',
    'Paneer Kathi Roll|Paneer Makhni Kathi Roll (Single)|80|true',
    'Paneer Kathi Roll|Paneer Makhni Kathi Roll (Double)|90|true',
    'Paneer Kathi Roll|Paneer Chilli Garlic Kathi Roll (Single)|80|true',
    'Paneer Kathi Roll|Paneer Chilli Garlic Kathi Roll (Double)|90|true',
    'Paneer Kathi Roll|Malai Paneer Kathi Roll (Single)|90|true',
    'Paneer Kathi Roll|Malai Paneer Kathi Roll (Double)|100|true',
    'Paneer Kathi Roll|Panner Bhujji Kathi Roll (Single)|90|true',
    'Paneer Kathi Roll|Panner Bhujji Kathi Roll (Double)|100|true',
    'Paneer Kathi Roll|Tom & Jerry Special Roll (Single)|90|true',
    'Paneer Kathi Roll|Tom & Jerry Special Roll (Double)|100|true',
    'Paneer Kathi Roll|Panner Tikka Kathi Roll (Single)|100|true',
    'Paneer Kathi Roll|Panner Tikka Kathi Roll (Double)|110|true',
    'Chap Kathi Roll|Masala Chap Roll (Single)|70|true',
    'Chap Kathi Roll|Masala Chap Roll (Double)|90|true',
    'Chap Kathi Roll|Malai Chap Roll (Single)|80|true',
    'Chap Kathi Roll|Malai Chap Roll (Double)|100|true',
    'Chap Kathi Roll|Mashroom Roll (Double)|120|true',
    'Chap Kathi Roll|Malai Mashroom Roll (Double)|140|true',
    'Pizza|Plain Cheese Pizza|99|true',
    'Pizza|Corn Pizza|109|true',
    'Pizza|Cipolla Pizza|119|true',
    'Pizza|Capsicum Pizza|119|true',
    'Pizza|Tomato Pizza|119|true',
    'Pizza|OTC Pizza|129|true',
    'Pizza|Fungo Pizza|149|true',
    'Pizza|Paneer Onion Pizza|149|true',
    'Pizza|Tandoor Pizza|179|true',
    'Pizza|Spicy Paneer Pizza|199|true',
    'Pizza|Mexicana Pizza|229|true',
    'Garlic Bread|Cheese Garlic Bread|69|true',
    'Garlic Bread|Corn Garlic Bread|99|true',
    'Garlic Bread|Mexican Garlic Bread|119|true',
    'Cold Coffee|Cold Coffee|70|true',
    'Cold Coffee|Cold Coffee with Ice Cream|80|true',
    'Cold Coffee|Cold Coffee with Chocochips|90|true',
    'Hot Coffee|Hot Coffee|30|true',
    'Burger|Aloo Tikki Burger|40|true',
    'Burger|Aloo Bechara Burger|50|true',
    'Burger|Cheese Burger|60|true',
    'Burger|Spy Chilly Lava Burger|80|true',
    'Burger|Crunchy Paneer Burger|90|true',
    'Shake|Mango Shake|60|true',
    'Shake|Vanilla Shake|60|true',
    'Shake|Pineapple Shake|60|true',
    'Shake|Butter Scotch Shake|70|true',
    'Shake|Blue Berry Shake|70|true',
    'Shake|Kit Kat Shake|80|true',
    'Shake|Strawberry Shake|80|true',
    'Shake|Chocolate Shake|80|true',
    'Shake|Oreo Chocolate Shake|99|true',
    'Shake|Tom & Jerry Shake|120|true',
    'Patties|Aloo Patties|20|true',
    'Patties|Masala Patties|30|true',
    'Patties|Cheese Patties|40|true',
    'Patties|Tandoori Paneer Patties|40|true',
    'Patties|Cheese Paneer Patties|50|true',
    'Patties|Pizza Patties|50|true',
    'Sandwiches|Veg. Grill Sandwich|49|true',
    'Sandwiches|Club Sandwiches|59|true',
    'Sandwiches|Cheese Sandwich|69|true',
    'Sandwiches|Mexican Cottae|89|true',
    'Sandwiches|Pizza Sandwich|109|true',
    'Fries|Small Fries|49|true',
    'Fries|Large Fries|69|true',
    'Fries|Peri Peri Large Fries|99|true',
    'Momos|Steam Momos (8 Pcs.)|40|true',
    'Momos|Fry Momos (8 Pcs.)|50|true',
    'Momos|Tandoori Gravy Momos (8 Pcs.)|70|true',
    'Momos|Veg. Cheese Momos (8 Pcs.)|90|true',
    'Momos|Pari Pari Momos (8 Pcs.)|100|true',
    'Momos|Kurkury Momos (8 Pcs.)|100|true',
    'Momos|Paneer Momos (8 Pcs.)|100|true',
    'Momos|Cheese Corn Momos (8 Pcs.)|110|true',
    'Noodles|Chowmein|40|true',
    'Noodles|Paneer Chowmein|60|true',
    'Noodles|Hakka Noodles|80|true',
    'Noodles|Garlic Noodles|100|true',
    'Maggi|Plan Maggi|40|true',
    'Maggi|Masala Maggi|50|true',
    'Maggi|Veg. Maggi|60|true',
    'Maggi|Paneer Maggi|70|true',
    'Patatos|Chilli Patato|90|true',
    'Patatos|Honey Chilli Patato|120|true',
    'Patatos|Gravy Mancharuan|120|true',
    'Patatos|Paneer Chilli Patato|150|true'
};

for (String menuRow : menuRows) {
    List<String> parts = menuRow.split('\\|');
    if (parts.size() != 4) {
        continue;
    }
    String categoryName = parts[0];
    String itemName = parts[1];
    Decimal price = Decimal.valueOf(parts[2]);
    Boolean isVeg = (parts[3] == 'true');

    Id categoryId = categoryIdByName.get(categoryName);
    if (categoryId == null) {
        continue;
    }

    String key = categoryId + '|' + itemName;
    if (existingItemsByKey.containsKey(key)) {
        continue;
    }

    Integer sortOrder = sortOrderByCategory.get(categoryName);
    itemsToInsert.add(new Menu_Item__c(
        Name = itemName,
        Menu_Category__c = categoryId,
        Restaurant__c = restaurant.Id,
        Price__c = price,
        Is_Available__c = true,
        Is_Vegetarian__c = isVeg,
        Sort_Order__c = sortOrder
    ));
    sortOrderByCategory.put(categoryName, sortOrder + 1);
}

if (!itemsToInsert.isEmpty()) {
    insert itemsToInsert;
}

System.debug('Tom & Jerry Cafe onboarding complete.');
System.debug('Restaurant Id: ' + restaurant.Id);
System.debug('Categories inserted this run: ' + categoriesToInsert.size());
System.debug('Menu items inserted this run: ' + itemsToInsert.size());

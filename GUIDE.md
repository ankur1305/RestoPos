
# RestoPos — Restaurant POS on Salesforce (Public Site)

## Complete Step-by-Step Implementation Guide

**Target Org:** PDE (Partner Developer Edition)
**Licensing Model:** 1 User License per Restaurant, Public Site for POS access
**Scale:** POC for 2–10 Restaurants in a single org
**API Version:** 65.0

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Phase 1 — Org Setup & Feature Enablement](#2-phase-1--org-setup--feature-enablement)
3. [Phase 2 — Data Model (Custom Objects & Fields)](#3-phase-2--data-model)
4. [Phase 3 — Sample/Seed Data Strategy](#4-phase-3--sample-data-strategy)
5. [Phase 4 — Apex Controllers](#5-phase-4--apex-controllers)
6. [Phase 5 — LWC Components](#6-phase-5--lwc-components)
7. [Phase 6 — Experience Cloud Site Setup](#7-phase-6--experience-cloud-site-setup)
8. [Phase 7 — Security & Guest User Permissions](#8-phase-7--security--guest-user-permissions)
9. [Phase 8 — Receipt Generation & Printing](#9-phase-8--receipt-generation--printing)
10. [Phase 9 — Testing & Deployment](#10-phase-9--testing--deployment)
11. [Multi-Restaurant Isolation Strategy](#11-multi-restaurant-isolation-strategy)
12. [Common Pitfalls & Troubleshooting](#12-common-pitfalls--troubleshooting)
13. [Future Enhancements](#13-future-enhancements)

---

## 1. Architecture Overview

### High-Level Flow

```
Restaurant Staff (Browser/Tablet)
        │
        ▼
┌──────────────────────────┐
│  Experience Cloud Site   │  ← Public (Guest User Access, no SF login)
│  (LWC Components)        │
└──────────┬───────────────┘
           │ @AuraEnabled Apex
           ▼
┌──────────────────────────┐
│  Apex Controllers        │  ← Business Logic, CRUD, Receipt Gen
│  (without sharing where  │
│   needed for guest user) │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│  Custom Objects          │  ← Restaurant, Table, Menu, Order, etc.
│  (Platform License)      │
└──────────────────────────┘
```

### Why Experience Cloud (not Salesforce Sites)?

| Feature                  | Salesforce Sites (VF) | Experience Cloud      |
|--------------------------|----------------------|----------------------|
| LWC Support              | Via Lightning Out only | Native               |
| Modern UI                | Manual styling        | Built-in themes      |
| Guest User Access        | Yes                   | Yes                  |
| Available in PDE         | Yes                   | Yes                  |
| Mobile Responsive        | Manual                | Built-in             |
| Cost                     | Free                  | Free (Guest license) |

**Recommendation:** Use Experience Cloud with an **Aura-based site template** (e.g., "Build Your Own (LWR)" or "Customer Service") for native LWC support and a modern, responsive UI out of the box.

### Licensing Strategy

- **PDE Org** comes with multiple license types including Customer Community licenses
- **Guest User License** (free, unlimited) is used for the public-facing POS site
- **1 Platform User License per restaurant** for admin/config tasks (menu management, reporting)
- Restaurant staff accesses the POS via the public URL — no individual SF licenses needed
- A lightweight **PIN-based authentication** at the app level identifies the restaurant and staff role

---

## 2. Phase 1 — Org Setup & Feature Enablement

### Step 1.1: Verify Your PDE Org

```bash
sf org display --target-org <your-pde-alias>
```

Confirm the org edition is "Partner Developer Edition."

### Step 1.2: Enable Digital Experiences (Communities)

1. Go to **Setup → Digital Experiences → Settings**
2. Check **"Enable Digital Experiences"**
3. Pick a domain name (e.g., `restopos-dev-ed`)
   - This becomes your site URL: `https://restopos-dev-ed.my.site.com/pos`
4. Click **Save**

> **Important:** The domain name cannot be changed after creation. Choose wisely.

### Step 1.3: Verify Default Security Settings

Guest user security is enforced by default in current Salesforce releases:
- Guest users **cannot** see other community members (locked down by default)
- Standard external profiles are usable by default (no toggle needed)

No action required here — move to the next step.

### Step 1.4: Update `sfdx-project.json`

Make sure the source API version matches your org:

```json
{
  "packageDirectories": [
    {
      "path": "force-app",
      "default": true
    }
  ],
  "name": "RestoPos",
  "namespace": "",
  "sfdcLoginUrl": "https://login.salesforce.com",
  "sourceApiVersion": "65.0"
}
```

### Step 1.5: Update `project-scratch-def.json` (for Scratch Orgs)

If using scratch orgs for development:

```json
{
  "orgName": "RestoPos Dev",
  "edition": "Developer",
  "features": [
    "EnableSetPasswordInApi",
    "Communities",
    "Sites"
  ],
  "settings": {
    "lightningExperienceSettings": {
      "enableS1DesktopEnabled": true
    },
    "communitiesSettings": {
      "enableNetworksEnabled": true
    },
    "mobileSettings": {
      "enableS1EncryptedStoragePref2": false
    }
  }
}
```

---

## 3. Phase 2 — Data Model

### Entity Relationship Diagram

```
Restaurant__c
 ├── Restaurant_Table__c (Lookup)
 ├── Menu_Category__c (Lookup)
 │    └── Menu_Item__c (Lookup to Category + Restaurant)
 └── POS_Order__c (Lookup)
      ├── Order_Item__c (Master-Detail to POS_Order)
      └── Receipt__c (Lookup)
```

### Step 2.1: Create Custom Objects

Create each object via SFDX metadata or Setup UI. Below is the full schema.

---

#### Object 1: `Restaurant__c`

| Field API Name      | Type           | Details                                      |
|---------------------|----------------|----------------------------------------------|
| Name                | Text (80)      | Standard Name field — Restaurant name         |
| Code__c             | Text (10)      | **Unique, Required, External ID** — e.g., "REST001" used in URL |
| Address__c          | Text Area (255)| Restaurant address                            |
| Phone__c            | Phone          | Contact number                                |
| Tax_Rate__c         | Percent (4,2)  | Tax percentage (e.g., 5.00, 18.00)           |
| Currency_Code__c    | Text (3)       | Default "INR"                                 |
| PIN__c              | Text (6)       | Staff access PIN for the POS                  |
| Is_Active__c        | Checkbox       | Default: true                                 |
| Logo_URL__c         | URL            | Restaurant logo for receipts                  |

**Object Settings:**
- Allow Reports: Yes
- Allow Search: Yes
- Sharing Model: Private (we control access via Apex)

---

#### Object 2: `Restaurant_Table__c`

| Field API Name      | Type              | Details                                    |
|---------------------|-------------------|--------------------------------------------|
| Name                | Text (20)         | e.g., "T1", "Patio-A"                     |
| Restaurant__c       | Lookup (Restaurant__c) | Required                              |
| Capacity__c         | Number (3,0)      | Seats available                            |
| Status__c           | Picklist          | Values: **Available, Occupied, Reserved, Out of Service** — Default: Available |
| Current_Order__c    | Lookup (POS_Order__c)  | The active order on this table        |
| Sort_Order__c       | Number (3,0)      | Display sequence                           |

---

#### Object 3: `Menu_Category__c`

| Field API Name      | Type              | Details                                    |
|---------------------|-------------------|--------------------------------------------|
| Name                | Text (80)         | e.g., "Appetizers", "Main Course"          |
| Restaurant__c       | Lookup (Restaurant__c) | Required                              |
| Sort_Order__c       | Number (3,0)      | Display sequence                           |
| Is_Active__c        | Checkbox          | Default: true                              |
| Icon__c             | Text (50)         | Icon name (e.g., "utility:food_and_drink") |

---

#### Object 4: `Menu_Item__c`

| Field API Name          | Type                   | Details                                |
|-------------------------|------------------------|----------------------------------------|
| Name                    | Text (80)              | Item name, e.g., "Butter Chicken"      |
| Menu_Category__c        | Lookup (Menu_Category__c) | Required                            |
| Restaurant__c           | Lookup (Restaurant__c) | Required (denormalized for queries)    |
| Price__c                | Currency (8,2)         | Item price                             |
| Description__c          | Text Area (500)        | Item description                       |
| Is_Available__c         | Checkbox               | Default: true — toggle for sold out    |
| Is_Vegetarian__c        | Checkbox               | Dietary flag                           |
| Image_URL__c            | URL                    | Item photo URL                         |
| Sort_Order__c           | Number (3,0)           | Display sequence within category       |
| Tax_Inclusive__c        | Checkbox               | Whether price includes tax             |

---

#### Object 5: `POS_Order__c`

| Field API Name         | Type                   | Details                                 |
|------------------------|------------------------|-----------------------------------------|
| Name                   | Auto Number            | Format: `ORD-{00000}` — auto-generated  |
| Restaurant__c          | Lookup (Restaurant__c) | Required                                |
| Table__c               | Lookup (Restaurant_Table__c) | Required                          |
| Status__c              | Picklist               | Values: **New, In Progress, Ready, Served, Closed, Cancelled** — Default: New |
| Order_DateTime__c      | DateTime               | When order was placed                   |
| Subtotal__c            | Currency (10,2)        | Populated by Apex (sum of line items)   |
| Tax_Amount__c          | Currency (10,2)        | Calculated: Subtotal × Tax Rate         |
| Discount_Percent__c    | Percent (4,2)          | Optional discount                       |
| Discount_Amount__c     | Currency (10,2)        | Calculated from percent or manual entry |
| Total_Amount__c        | Currency (10,2)        | Formula: Subtotal + Tax - Discount      |
| Payment_Method__c      | Picklist               | Values: **Cash, Card, UPI, Other**      |
| Payment_Status__c      | Picklist               | Values: **Pending, Paid, Partially Paid** — Default: Pending |
| Customer_Name__c       | Text (100)             | Optional customer name                  |
| Notes__c               | Long Text Area (1000)  | Special instructions                    |
| Item_Count__c          | Number (4,0)           | Roll-up: count of order items           |

> **Note:** Use `POS_Order__c` (not `Order__c`) to avoid conflicts with the standard Order object.

---

#### Object 6: `Order_Item__c`

| Field API Name      | Type                      | Details                                  |
|---------------------|---------------------------|------------------------------------------|
| Name                | Auto Number               | Format: `OI-{00000}`                     |
| POS_Order__c        | **Master-Detail (POS_Order__c)** | Required — enables roll-up summaries |
| Menu_Item__c        | Lookup (Menu_Item__c)     | Which menu item was ordered              |
| Item_Name__c        | Text (80)                 | Denormalized — copied from Menu_Item at time of order |
| Quantity__c         | Number (4,0)              | Default: 1                               |
| Unit_Price__c       | Currency (8,2)            | Price at time of order (snapshot)        |
| Line_Total__c       | Currency (10,2)           | **Formula:** `Quantity__c * Unit_Price__c` |
| Notes__c            | Text Area (255)           | "No onions", "Extra spicy", etc.         |
| Status__c           | Picklist                  | Values: **Ordered, Preparing, Ready, Served, Cancelled** — Default: Ordered |

**Roll-Up Summary Fields on POS_Order__c:**
- `Subtotal__c` = Roll-Up SUM of `Order_Item__c.Line_Total__c` (where Status != Cancelled)
- `Item_Count__c` = Roll-Up COUNT of `Order_Item__c` (where Status != Cancelled)

---

#### Object 7: `Receipt__c`

| Field API Name       | Type                    | Details                                 |
|----------------------|-------------------------|-----------------------------------------|
| Name                 | Auto Number             | Format: `RCP-{00000}`                   |
| POS_Order__c         | Lookup (POS_Order__c)   | Required                                |
| Restaurant__c        | Lookup (Restaurant__c)  | Required                                |
| Receipt_Number__c    | Text (20)               | Unique formatted receipt number         |
| Generated_DateTime__c| DateTime                | When receipt was generated              |
| Subtotal__c          | Currency (10,2)         | Snapshot from order                     |
| Tax_Amount__c        | Currency (10,2)         | Snapshot                                |
| Discount_Amount__c   | Currency (10,2)         | Snapshot                                |
| Total_Amount__c      | Currency (10,2)         | Snapshot                                |
| Payment_Method__c    | Text (20)               | Snapshot                                |

---

### Step 2.2: Create the Metadata Files

Create the object XML files under `force-app/main/default/objects/`. Here's the directory structure you need:

```
force-app/main/default/objects/
├── Restaurant__c/
│   ├── Restaurant__c.object-meta.xml
│   └── fields/
│       ├── Code__c.field-meta.xml
│       ├── Address__c.field-meta.xml
│       ├── Phone__c.field-meta.xml
│       ├── Tax_Rate__c.field-meta.xml
│       ├── Currency_Code__c.field-meta.xml
│       ├── PIN__c.field-meta.xml
│       ├── Is_Active__c.field-meta.xml
│       └── Logo_URL__c.field-meta.xml
├── Restaurant_Table__c/
│   ├── Restaurant_Table__c.object-meta.xml
│   └── fields/
│       ├── Restaurant__c.field-meta.xml
│       ├── Capacity__c.field-meta.xml
│       ├── Status__c.field-meta.xml
│       ├── Current_Order__c.field-meta.xml
│       └── Sort_Order__c.field-meta.xml
├── Menu_Category__c/
│   └── ... (similar structure)
├── Menu_Item__c/
│   └── ...
├── POS_Order__c/
│   └── ...
├── Order_Item__c/
│   └── ...
└── Receipt__c/
    └── ...
```

> **Tip:** You can create these via Setup UI (point-and-click) and then pull them into source format:
> ```bash
> sf project retrieve start --metadata CustomObject:Restaurant__c,CustomObject:Restaurant_Table__c,CustomObject:Menu_Category__c,CustomObject:Menu_Item__c,CustomObject:POS_Order__c,CustomObject:Order_Item__c,CustomObject:Receipt__c --target-org <alias>
> ```

---

## 4. Phase 3 — Sample Data Strategy

### Step 3.1: Create an Apex Script for Seed Data

Create the file `scripts/apex/seedData.apex` to quickly populate test data:

```apex
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
    new Menu_Item__c(Name='Butter Chicken', Menu_Category__c=catMap.get('Main Course'), Restaurant__c=rest.Id, Price__c=350, Is_Available__c=true, Is_Vegetarian__c=false, Sort_Order__c=1),
    new Menu_Item__c(Name='Dal Makhani', Menu_Category__c=catMap.get('Main Course'), Restaurant__c=rest.Id, Price__c=220, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=2),
    new Menu_Item__c(Name='Palak Paneer', Menu_Category__c=catMap.get('Main Course'), Restaurant__c=rest.Id, Price__c=240, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=3),
    new Menu_Item__c(Name='Butter Naan', Menu_Category__c=catMap.get('Breads'), Restaurant__c=rest.Id, Price__c=60, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=1),
    new Menu_Item__c(Name='Garlic Naan', Menu_Category__c=catMap.get('Breads'), Restaurant__c=rest.Id, Price__c=70, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=2),
    new Menu_Item__c(Name='Masala Chai', Menu_Category__c=catMap.get('Beverages'), Restaurant__c=rest.Id, Price__c=40, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=1),
    new Menu_Item__c(Name='Fresh Lime Soda', Menu_Category__c=catMap.get('Beverages'), Restaurant__c=rest.Id, Price__c=60, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=2),
    new Menu_Item__c(Name='Gulab Jamun', Menu_Category__c=catMap.get('Desserts'), Restaurant__c=rest.Id, Price__c=100, Is_Available__c=true, Is_Vegetarian__c=true, Sort_Order__c=1)
};
insert items;

System.debug('Seed data created for: ' + rest.Name);
```

Run with:
```bash
sf apex run --file scripts/apex/seedData.apex --target-org <alias>
```

---

## 5. Phase 4 — Apex Controllers

All Apex controllers use `@AuraEnabled` methods for LWC communication and run `without sharing` where necessary for guest user access.

### Controller Architecture

```
Apex Classes:
├── RestoPosController.cls       — Main controller (restaurant auth, config)
├── TableController.cls          — Table CRUD & status management
├── MenuController.cls           — Menu categories & items retrieval
├── OrderController.cls          — Order lifecycle management
├── ReceiptController.cls        — Receipt generation & retrieval
└── RestoPosTestFactory.cls      — Test data factory
```

### Step 4.1: `RestoPosController.cls`

```apex
public without sharing class RestoPosController {

    @AuraEnabled(cacheable=true)
    public static Restaurant__c getRestaurantByCode(String code) {
        List<Restaurant__c> restaurants = [
            SELECT Id, Name, Code__c, Address__c, Phone__c,
                   Tax_Rate__c, Currency_Code__c, Is_Active__c, Logo_URL__c
            FROM Restaurant__c
            WHERE Code__c = :code AND Is_Active__c = true
            LIMIT 1
        ];
        if (restaurants.isEmpty()) {
            throw new AuraHandledException('Restaurant not found or inactive.');
        }
        return restaurants[0];
    }

    @AuraEnabled
    public static Boolean verifyPin(String restaurantId, String pin) {
        List<Restaurant__c> restaurants = [
            SELECT PIN__c FROM Restaurant__c
            WHERE Id = :restaurantId
            LIMIT 1
        ];
        if (restaurants.isEmpty()) {
            throw new AuraHandledException('Restaurant not found.');
        }
        return restaurants[0].PIN__c == pin;
    }
}
```

### Step 4.2: `TableController.cls`

```apex
public without sharing class TableController {

    @AuraEnabled(cacheable=true)
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
            SELECT Id, Status__c, Current_Order__c
            FROM Restaurant_Table__c
            WHERE Id = :tableId
            LIMIT 1
        ];
        tbl.Status__c = status;
        if (status == 'Available') {
            tbl.Current_Order__c = null;
        }
        update tbl;
        return tbl;
    }
}
```

### Step 4.3: `MenuController.cls`

```apex
public without sharing class MenuController {

    @AuraEnabled(cacheable=true)
    public static List<Menu_Category__c> getMenuCategories(String restaurantId) {
        return [
            SELECT Id, Name, Sort_Order__c, Icon__c
            FROM Menu_Category__c
            WHERE Restaurant__c = :restaurantId
              AND Is_Active__c = true
            ORDER BY Sort_Order__c ASC
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<Menu_Item__c> getMenuItems(String restaurantId, String categoryId) {
        String query = 'SELECT Id, Name, Price__c, Description__c, Is_Available__c, '
                     + 'Is_Vegetarian__c, Image_URL__c, Sort_Order__c, Menu_Category__c '
                     + 'FROM Menu_Item__c '
                     + 'WHERE Restaurant__c = :restaurantId AND Is_Available__c = true ';
        if (String.isNotBlank(categoryId)) {
            query += 'AND Menu_Category__c = :categoryId ';
        }
        query += 'ORDER BY Sort_Order__c ASC';
        return Database.query(query);
    }

    @AuraEnabled(cacheable=true)
    public static List<Menu_Item__c> searchMenuItems(String restaurantId, String searchTerm) {
        String searchKey = '%' + String.escapeSingleQuotes(searchTerm) + '%';
        return [
            SELECT Id, Name, Price__c, Description__c, Is_Available__c,
                   Is_Vegetarian__c, Menu_Category__c, Menu_Category__r.Name
            FROM Menu_Item__c
            WHERE Restaurant__c = :restaurantId
              AND Is_Available__c = true
              AND Name LIKE :searchKey
            ORDER BY Name ASC
            LIMIT 20
        ];
    }
}
```

### Step 4.4: `OrderController.cls`

```apex
public without sharing class OrderController {

    @AuraEnabled
    public static POS_Order__c createOrder(String restaurantId, String tableId) {
        POS_Order__c ord = new POS_Order__c(
            Restaurant__c = restaurantId,
            Table__c = tableId,
            Status__c = 'New',
            Order_DateTime__c = Datetime.now(),
            Payment_Status__c = 'Pending'
        );
        insert ord;

        Restaurant_Table__c tbl = new Restaurant_Table__c(
            Id = tableId,
            Status__c = 'Occupied',
            Current_Order__c = ord.Id
        );
        update tbl;

        return [
            SELECT Id, Name, Status__c, Order_DateTime__c,
                   Subtotal__c, Tax_Amount__c, Total_Amount__c,
                   Table__r.Name, Payment_Status__c
            FROM POS_Order__c
            WHERE Id = :ord.Id
        ];
    }

    @AuraEnabled
    public static Order_Item__c addOrderItem(String orderId, String menuItemId, Integer quantity, String notes) {
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
            Quantity__c = (quantity != null && quantity > 0) ? quantity : 1,
            Notes__c = notes,
            Status__c = 'Ordered'
        );
        insert item;

        return [
            SELECT Id, Name, Item_Name__c, Quantity__c, Unit_Price__c,
                   Line_Total__c, Notes__c, Status__c
            FROM Order_Item__c
            WHERE Id = :item.Id
        ];
    }

    @AuraEnabled
    public static void updateOrderItemQuantity(String orderItemId, Integer quantity) {
        if (quantity <= 0) {
            delete [SELECT Id FROM Order_Item__c WHERE Id = :orderItemId];
            return;
        }
        Order_Item__c item = new Order_Item__c(Id = orderItemId, Quantity__c = quantity);
        update item;
    }

    @AuraEnabled
    public static void removeOrderItem(String orderItemId) {
        delete [SELECT Id FROM Order_Item__c WHERE Id = :orderItemId];
    }

    @AuraEnabled(cacheable=true)
    public static POS_Order__c getOrder(String orderId) {
        return [
            SELECT Id, Name, Status__c, Order_DateTime__c,
                   Subtotal__c, Tax_Amount__c, Discount_Percent__c,
                   Discount_Amount__c, Total_Amount__c,
                   Payment_Method__c, Payment_Status__c,
                   Customer_Name__c, Notes__c,
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

    @AuraEnabled(cacheable=true)
    public static List<POS_Order__c> getActiveOrders(String restaurantId) {
        return [
            SELECT Id, Name, Status__c, Order_DateTime__c,
                   Table__r.Name, Total_Amount__c, Item_Count__c
            FROM POS_Order__c
            WHERE Restaurant__c = :restaurantId
              AND Status__c NOT IN ('Closed', 'Cancelled')
            ORDER BY Order_DateTime__c DESC
        ];
    }

    @AuraEnabled
    public static POS_Order__c updateOrderStatus(String orderId, String status) {
        POS_Order__c ord = new POS_Order__c(Id = orderId, Status__c = status);
        update ord;

        if (status == 'Closed' || status == 'Cancelled') {
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
    public static POS_Order__c applyDiscount(String orderId, Decimal discountPercent) {
        POS_Order__c ord = [
            SELECT Id, Subtotal__c, Tax_Amount__c
            FROM POS_Order__c
            WHERE Id = :orderId
        ];
        ord.Discount_Percent__c = discountPercent;
        ord.Discount_Amount__c = (ord.Subtotal__c != null ? ord.Subtotal__c : 0) * (discountPercent / 100);
        update ord;

        return getOrder(orderId);
    }

    @AuraEnabled
    public static POS_Order__c processPayment(String orderId, String paymentMethod) {
        POS_Order__c ord = new POS_Order__c(
            Id = orderId,
            Payment_Method__c = paymentMethod,
            Payment_Status__c = 'Paid',
            Status__c = 'Closed'
        );
        update ord;

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

        return getOrder(orderId);
    }
}
```

### Step 4.5: `ReceiptController.cls`

```apex
public without sharing class ReceiptController {

    @AuraEnabled
    public static Receipt__c generateReceipt(String orderId) {
        POS_Order__c ord = [
            SELECT Id, Name, Subtotal__c, Tax_Amount__c,
                   Discount_Amount__c, Total_Amount__c,
                   Payment_Method__c, Restaurant__c
            FROM POS_Order__c
            WHERE Id = :orderId
        ];

        Receipt__c receipt = new Receipt__c(
            POS_Order__c = orderId,
            Restaurant__c = ord.Restaurant__c,
            Receipt_Number__c = 'R-' + String.valueOf(Datetime.now().getTime()),
            Generated_DateTime__c = Datetime.now(),
            Subtotal__c = ord.Subtotal__c,
            Tax_Amount__c = ord.Tax_Amount__c,
            Discount_Amount__c = ord.Discount_Amount__c,
            Total_Amount__c = ord.Total_Amount__c,
            Payment_Method__c = ord.Payment_Method__c
        );
        insert receipt;

        return [
            SELECT Id, Name, Receipt_Number__c, Generated_DateTime__c,
                   Subtotal__c, Tax_Amount__c, Discount_Amount__c,
                   Total_Amount__c, Payment_Method__c,
                   POS_Order__r.Name, POS_Order__r.Table__r.Name,
                   POS_Order__r.Order_DateTime__c,
                   POS_Order__r.Customer_Name__c,
                   Restaurant__r.Name, Restaurant__r.Address__c,
                   Restaurant__r.Phone__c, Restaurant__r.Logo_URL__c
            FROM Receipt__c
            WHERE Id = :receipt.Id
        ];
    }

    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getReceiptData(String receiptId) {
        Receipt__c receipt = [
            SELECT Id, Name, Receipt_Number__c, Generated_DateTime__c,
                   Subtotal__c, Tax_Amount__c, Discount_Amount__c,
                   Total_Amount__c, Payment_Method__c,
                   POS_Order__c, POS_Order__r.Name,
                   POS_Order__r.Table__r.Name,
                   POS_Order__r.Order_DateTime__c,
                   POS_Order__r.Customer_Name__c,
                   Restaurant__r.Name, Restaurant__r.Address__c,
                   Restaurant__r.Phone__c, Restaurant__r.Logo_URL__c,
                   Restaurant__r.Tax_Rate__c
            FROM Receipt__c
            WHERE Id = :receiptId
        ];

        List<Order_Item__c> items = [
            SELECT Item_Name__c, Quantity__c, Unit_Price__c, Line_Total__c
            FROM Order_Item__c
            WHERE POS_Order__c = :receipt.POS_Order__c
              AND Status__c != 'Cancelled'
            ORDER BY CreatedDate ASC
        ];

        Map<String, Object> result = new Map<String, Object>();
        result.put('receipt', receipt);
        result.put('items', items);
        return result;
    }
}
```

### Step 4.6: Deploy Apex Classes

```bash
sf project deploy start --source-dir force-app/main/default/classes --target-org <alias>
```

---

## 6. Phase 5 — LWC Components

### Component Architecture

```
LWC Components:
├── restoPosApp/              — Main app shell (router, state management)
├── posLogin/                 — PIN entry screen
├── posTableView/             — Table grid with status indicators
├── posOrderScreen/           — Active order management
├── posMenuBrowser/           — Category & item selection
├── posOrderItem/             — Single order item row
├── posPayment/               — Payment method selection
├── posReceipt/               — Receipt display & print
├── posHeader/                — App header bar
└── posKitchenDisplay/        — (Bonus) Kitchen order queue
```

### Step 5.1: Main App Shell — `restoPosApp`

This is the top-level component that acts as a router and state manager.

**`restoPosApp.js`**

```javascript
import { LightningElement, track } from 'lwc';
import getRestaurantByCode from '@salesforce/apex/RestoPosController.getRestaurantByCode';
import verifyPin from '@salesforce/apex/RestoPosController.verifyPin';

export default class RestoPosApp extends LightningElement {
    @track currentView = 'login'; // login, tables, order, receipt
    @track restaurant;
    @track selectedTableId;
    @track selectedOrderId;
    @track receiptId;
    @track error;
    isLoading = false;

    get isLoginView() { return this.currentView === 'login'; }
    get isTableView() { return this.currentView === 'tables'; }
    get isOrderView() { return this.currentView === 'order'; }
    get isReceiptView() { return this.currentView === 'receipt'; }
    get isKitchenView() { return this.currentView === 'kitchen'; }

    get restaurantName() {
        return this.restaurant ? this.restaurant.Name : 'RestoPos';
    }

    connectedCallback() {
        // Try to get restaurant code from URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('rc');
        if (code) {
            this.loadRestaurant(code);
        }
    }

    async loadRestaurant(code) {
        try {
            this.isLoading = true;
            this.restaurant = await getRestaurantByCode({ code });
            this.error = null;
        } catch (err) {
            this.error = err.body?.message || 'Failed to load restaurant';
        } finally {
            this.isLoading = false;
        }
    }

    handleLogin(event) {
        const { restaurantCode, pin } = event.detail;
        this.handleLoginAsync(restaurantCode, pin);
    }

    async handleLoginAsync(restaurantCode, pin) {
        try {
            this.isLoading = true;
            if (!this.restaurant) {
                await this.loadRestaurant(restaurantCode);
            }
            const valid = await verifyPin({
                restaurantId: this.restaurant.Id,
                pin: pin
            });
            if (valid) {
                this.currentView = 'tables';
            } else {
                this.error = 'Invalid PIN';
            }
        } catch (err) {
            this.error = err.body?.message || 'Login failed';
        } finally {
            this.isLoading = false;
        }
    }

    handleTableSelect(event) {
        this.selectedTableId = event.detail.tableId;
        this.selectedOrderId = event.detail.orderId;
        this.currentView = 'order';
    }

    handleBackToTables() {
        this.selectedTableId = null;
        this.selectedOrderId = null;
        this.currentView = 'tables';
    }

    handleViewReceipt(event) {
        this.receiptId = event.detail.receiptId;
        this.currentView = 'receipt';
    }

    handleNavigation(event) {
        this.currentView = event.detail.view;
    }
}
```

**`restoPosApp.html`**

```html
<template>
    <div class="restopos-app">
        <!-- Header -->
        <template lwc:if={restaurant}>
            <c-pos-header
                restaurant-name={restaurantName}
                current-view={currentView}
                onnavigate={handleNavigation}
                onbacktotables={handleBackToTables}
            ></c-pos-header>
        </template>

        <!-- Loading -->
        <template lwc:if={isLoading}>
            <div class="loading-container">
                <lightning-spinner alternative-text="Loading..." size="large"></lightning-spinner>
            </div>
        </template>

        <!-- Error -->
        <template lwc:if={error}>
            <div class="error-banner">
                <lightning-icon icon-name="utility:error" variant="error" size="small"></lightning-icon>
                <span class="slds-m-left_small">{error}</span>
            </div>
        </template>

        <!-- Views -->
        <div class="main-content">
            <template lwc:if={isLoginView}>
                <c-pos-login onlogin={handleLogin}></c-pos-login>
            </template>

            <template lwc:if={isTableView}>
                <c-pos-table-view
                    restaurant-id={restaurant.Id}
                    ontableselect={handleTableSelect}
                ></c-pos-table-view>
            </template>

            <template lwc:if={isOrderView}>
                <c-pos-order-screen
                    restaurant-id={restaurant.Id}
                    table-id={selectedTableId}
                    order-id={selectedOrderId}
                    tax-rate={restaurant.Tax_Rate__c}
                    currency-code={restaurant.Currency_Code__c}
                    onbacktotables={handleBackToTables}
                    onviewreceipt={handleViewReceipt}
                ></c-pos-order-screen>
            </template>

            <template lwc:if={isReceiptView}>
                <c-pos-receipt
                    receipt-id={receiptId}
                    onbacktotables={handleBackToTables}
                ></c-pos-receipt>
            </template>
        </div>
    </div>
</template>
```

**`restoPosApp.css`**

```css
:host {
    --color-primary: #1a73e8;
    --color-success: #34a853;
    --color-warning: #fbbc04;
    --color-danger: #ea4335;
    --color-bg: #f5f5f5;
    --color-surface: #ffffff;
    --color-text: #202124;
    --color-text-secondary: #5f6368;
    --radius: 12px;
    --shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.restopos-app {
    min-height: 100vh;
    background: var(--color-bg);
    font-family: 'Segoe UI', Roboto, sans-serif;
}

.main-content {
    padding: 1rem;
    max-width: 1400px;
    margin: 0 auto;
}

.loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 60vh;
}

.error-banner {
    display: flex;
    align-items: center;
    background: #fce8e6;
    color: #c5221f;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    margin: 1rem;
}
```

**`restoPosApp.js-meta.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>65.0</apiVersion>
    <isExposed>true</isExposed>
    <targets>
        <target>lightning__AppPage</target>
        <target>lightningCommunity__Page</target>
        <target>lightningCommunity__Default</target>
    </targets>
</LightningComponentBundle>
```

> **Critical:** The `lightningCommunity__Page` and `lightningCommunity__Default` targets
> make this component available in Experience Cloud Builder.

### Step 5.2: Login Component — `posLogin`

```javascript
// posLogin.js
import { LightningElement, track } from 'lwc';

export default class PosLogin extends LightningElement {
    @track restaurantCode = '';
    @track pin = '';

    handleCodeChange(event) {
        this.restaurantCode = event.target.value;
    }

    handlePinChange(event) {
        this.pin = event.target.value;
    }

    handleSubmit() {
        if (!this.restaurantCode || !this.pin) return;
        this.dispatchEvent(new CustomEvent('login', {
            detail: {
                restaurantCode: this.restaurantCode,
                pin: this.pin
            }
        }));
    }

    handleKeyUp(event) {
        if (event.key === 'Enter') {
            this.handleSubmit();
        }
    }
}
```

```html
<!-- posLogin.html -->
<template>
    <div class="login-container">
        <div class="login-card">
            <div class="login-header">
                <h1 class="login-title">RestoPos</h1>
                <p class="login-subtitle">Restaurant Point of Sale</p>
            </div>
            <div class="login-form">
                <lightning-input
                    label="Restaurant Code"
                    value={restaurantCode}
                    placeholder="e.g., TCH001"
                    onchange={handleCodeChange}
                    onkeyup={handleKeyUp}
                    class="slds-m-bottom_medium"
                ></lightning-input>
                <lightning-input
                    type="password"
                    label="Staff PIN"
                    value={pin}
                    placeholder="Enter PIN"
                    onchange={handlePinChange}
                    onkeyup={handleKeyUp}
                    class="slds-m-bottom_large"
                    maxlength="6"
                ></lightning-input>
                <lightning-button
                    variant="brand"
                    label="Enter POS"
                    onclick={handleSubmit}
                    class="full-width-btn"
                ></lightning-button>
            </div>
        </div>
    </div>
</template>
```

### Step 5.3: Table View — `posTableView`

```javascript
// posTableView.js
import { LightningElement, api, track, wire } from 'lwc';
import getTables from '@salesforce/apex/TableController.getTables';
import { refreshApex } from '@salesforce/apex';

export default class PosTableView extends LightningElement {
    @api restaurantId;
    @track tables = [];
    wiredTablesResult;

    @wire(getTables, { restaurantId: '$restaurantId' })
    wiredTables(result) {
        this.wiredTablesResult = result;
        if (result.data) {
            this.tables = result.data.map(t => ({
                ...t,
                cssClass: 'table-card table-' + t.Status__c.toLowerCase().replace(/\s/g, '-'),
                statusLabel: t.Status__c,
                hasOrder: !!t.Current_Order__c,
                orderName: t.Current_Order__r ? t.Current_Order__r.Name : '',
                orderTotal: t.Current_Order__r ? t.Current_Order__r.Total_Amount__c : 0,
                itemCount: t.Current_Order__r ? t.Current_Order__r.Item_Count__c : 0
            }));
        }
    }

    handleTableClick(event) {
        const tableId = event.currentTarget.dataset.id;
        const table = this.tables.find(t => t.Id === tableId);
        this.dispatchEvent(new CustomEvent('tableselect', {
            detail: {
                tableId: tableId,
                orderId: table.Current_Order__c || null
            }
        }));
    }

    handleRefresh() {
        refreshApex(this.wiredTablesResult);
    }
}
```

```html
<!-- posTableView.html -->
<template>
    <div class="table-view">
        <div class="view-header">
            <h2 class="view-title">Tables</h2>
            <lightning-button
                icon-name="utility:refresh"
                label="Refresh"
                onclick={handleRefresh}
            ></lightning-button>
        </div>

        <div class="legend">
            <span class="legend-item"><span class="dot available"></span> Available</span>
            <span class="legend-item"><span class="dot occupied"></span> Occupied</span>
            <span class="legend-item"><span class="dot reserved"></span> Reserved</span>
        </div>

        <div class="table-grid">
            <template for:each={tables} for:item="table">
                <div key={table.Id}
                     class={table.cssClass}
                     data-id={table.Id}
                     onclick={handleTableClick}>
                    <div class="table-name">{table.Name}</div>
                    <div class="table-capacity">
                        <lightning-icon icon-name="utility:user" size="xx-small"></lightning-icon>
                        {table.Capacity__c}
                    </div>
                    <div class="table-status">{table.statusLabel}</div>
                    <template lwc:if={table.hasOrder}>
                        <div class="table-order-info">
                            <span>{table.orderName}</span>
                            <span>{table.itemCount} items</span>
                        </div>
                    </template>
                </div>
            </template>
        </div>
    </div>
</template>
```

### Step 5.4: Order Screen — `posOrderScreen`

This is the most complex component — it shows the current order and a menu browser side by side.

```javascript
// posOrderScreen.js
import { LightningElement, api, track } from 'lwc';
import createOrder from '@salesforce/apex/OrderController.createOrder';
import getOrder from '@salesforce/apex/OrderController.getOrder';
import addOrderItem from '@salesforce/apex/OrderController.addOrderItem';
import removeOrderItem from '@salesforce/apex/OrderController.removeOrderItem';
import updateOrderItemQuantity from '@salesforce/apex/OrderController.updateOrderItemQuantity';
import processPayment from '@salesforce/apex/OrderController.processPayment';
import applyDiscount from '@salesforce/apex/OrderController.applyDiscount';
import generateReceipt from '@salesforce/apex/ReceiptController.generateReceipt';

export default class PosOrderScreen extends LightningElement {
    @api restaurantId;
    @api tableId;
    @api taxRate;
    @api currencyCode;
    @track order;
    @track orderItems = [];
    @track showPayment = false;
    isLoading = false;

    _orderId;
    @api
    get orderId() { return this._orderId; }
    set orderId(value) {
        this._orderId = value;
        if (value) {
            this.loadOrder(value);
        }
    }

    connectedCallback() {
        if (this._orderId) {
            this.loadOrder(this._orderId);
        } else {
            this.createNewOrder();
        }
    }

    async createNewOrder() {
        try {
            this.isLoading = true;
            this.order = await createOrder({
                restaurantId: this.restaurantId,
                tableId: this.tableId
            });
            this._orderId = this.order.Id;
            this.orderItems = [];
        } catch (err) {
            console.error('Create order error:', err);
        } finally {
            this.isLoading = false;
        }
    }

    async loadOrder(orderId) {
        try {
            this.isLoading = true;
            this.order = await getOrder({ orderId });
            this.orderItems = this.order.Order_Items__r || [];
        } catch (err) {
            console.error('Load order error:', err);
        } finally {
            this.isLoading = false;
        }
    }

    async handleAddItem(event) {
        const { menuItemId, quantity, notes } = event.detail;
        try {
            await addOrderItem({
                orderId: this._orderId,
                menuItemId,
                quantity: quantity || 1,
                notes: notes || ''
            });
            await this.loadOrder(this._orderId);
        } catch (err) {
            console.error('Add item error:', err);
        }
    }

    async handleRemoveItem(event) {
        try {
            await removeOrderItem({ orderItemId: event.detail.itemId });
            await this.loadOrder(this._orderId);
        } catch (err) {
            console.error('Remove item error:', err);
        }
    }

    async handleUpdateQuantity(event) {
        try {
            await updateOrderItemQuantity({
                orderItemId: event.detail.itemId,
                quantity: event.detail.quantity
            });
            await this.loadOrder(this._orderId);
        } catch (err) {
            console.error('Update quantity error:', err);
        }
    }

    async handleApplyDiscount(event) {
        try {
            this.order = await applyDiscount({
                orderId: this._orderId,
                discountPercent: event.detail.percent
            });
            this.orderItems = this.order.Order_Items__r || [];
        } catch (err) {
            console.error('Discount error:', err);
        }
    }

    handleShowPayment() {
        this.showPayment = true;
    }

    async handleProcessPayment(event) {
        try {
            this.isLoading = true;
            this.order = await processPayment({
                orderId: this._orderId,
                paymentMethod: event.detail.method
            });
            const receipt = await generateReceipt({ orderId: this._orderId });
            this.dispatchEvent(new CustomEvent('viewreceipt', {
                detail: { receiptId: receipt.Id }
            }));
        } catch (err) {
            console.error('Payment error:', err);
        } finally {
            this.isLoading = false;
            this.showPayment = false;
        }
    }

    handleBack() {
        this.dispatchEvent(new CustomEvent('backtotables'));
    }

    get orderTotal() {
        return this.order?.Total_Amount__c || 0;
    }

    get orderSubtotal() {
        return this.order?.Subtotal__c || 0;
    }

    get taxAmount() {
        const subtotal = this.order?.Subtotal__c || 0;
        const rate = this.taxRate || 0;
        return subtotal * (rate / 100);
    }

    get hasItems() {
        return this.orderItems && this.orderItems.length > 0;
    }

    get tableName() {
        return this.order?.Table__r?.Name || '';
    }

    get orderName() {
        return this.order?.Name || '';
    }
}
```

```html
<!-- posOrderScreen.html -->
<template>
    <div class="order-screen">
        <div class="order-layout">
            <!-- Left: Menu Browser -->
            <div class="menu-panel">
                <c-pos-menu-browser
                    restaurant-id={restaurantId}
                    currency-code={currencyCode}
                    onadditem={handleAddItem}
                ></c-pos-menu-browser>
            </div>

            <!-- Right: Current Order -->
            <div class="order-panel">
                <div class="order-header">
                    <h3>{orderName} — {tableName}</h3>
                    <lightning-button
                        icon-name="utility:back"
                        label="Tables"
                        onclick={handleBack}
                        variant="neutral"
                    ></lightning-button>
                </div>

                <div class="order-items-list">
                    <template lwc:if={hasItems}>
                        <template for:each={orderItems} for:item="item">
                            <c-pos-order-item
                                key={item.Id}
                                item={item}
                                currency-code={currencyCode}
                                onremoveitem={handleRemoveItem}
                                onupdatequantity={handleUpdateQuantity}
                            ></c-pos-order-item>
                        </template>
                    </template>
                    <template lwc:else>
                        <div class="empty-order">
                            <p>No items yet. Browse the menu to add items.</p>
                        </div>
                    </template>
                </div>

                <div class="order-totals">
                    <div class="total-row">
                        <span>Subtotal</span>
                        <span>{orderSubtotal}</span>
                    </div>
                    <div class="total-row">
                        <span>Tax ({taxRate}%)</span>
                        <span>{taxAmount}</span>
                    </div>
                    <template lwc:if={order.Discount_Amount__c}>
                        <div class="total-row discount">
                            <span>Discount ({order.Discount_Percent__c}%)</span>
                            <span>-{order.Discount_Amount__c}</span>
                        </div>
                    </template>
                    <div class="total-row grand-total">
                        <span>Total</span>
                        <span>{orderTotal}</span>
                    </div>
                </div>

                <div class="order-actions">
                    <lightning-button
                        label="Apply Discount"
                        onclick={handleShowDiscount}
                        variant="neutral"
                        class="slds-m-right_small"
                        disabled={!hasItems}
                    ></lightning-button>
                    <lightning-button
                        label="Pay & Close"
                        onclick={handleShowPayment}
                        variant="brand"
                        disabled={!hasItems}
                    ></lightning-button>
                </div>

                <!-- Payment Modal -->
                <template lwc:if={showPayment}>
                    <c-pos-payment
                        total={orderTotal}
                        currency-code={currencyCode}
                        onpay={handleProcessPayment}
                        oncancel={handleClosePayment}
                    ></c-pos-payment>
                </template>
            </div>
        </div>
    </div>
</template>
```

### Step 5.5: Menu Browser — `posMenuBrowser`

```javascript
// posMenuBrowser.js
import { LightningElement, api, track, wire } from 'lwc';
import getMenuCategories from '@salesforce/apex/MenuController.getMenuCategories';
import getMenuItems from '@salesforce/apex/MenuController.getMenuItems';
import searchMenuItems from '@salesforce/apex/MenuController.searchMenuItems';

export default class PosMenuBrowser extends LightningElement {
    @api restaurantId;
    @api currencyCode;
    @track categories = [];
    @track items = [];
    @track selectedCategoryId;
    @track searchTerm = '';
    isLoading = false;

    @wire(getMenuCategories, { restaurantId: '$restaurantId' })
    wiredCategories({ data }) {
        if (data) {
            this.categories = data;
            if (data.length > 0 && !this.selectedCategoryId) {
                this.selectedCategoryId = data[0].Id;
            }
        }
    }

    @wire(getMenuItems, { restaurantId: '$restaurantId', categoryId: '$selectedCategoryId' })
    wiredItems({ data }) {
        if (data) {
            this.items = data;
        }
    }

    handleCategoryClick(event) {
        this.selectedCategoryId = event.currentTarget.dataset.id;
        this.searchTerm = '';
    }

    async handleSearch(event) {
        this.searchTerm = event.target.value;
        if (this.searchTerm.length >= 2) {
            try {
                this.items = await searchMenuItems({
                    restaurantId: this.restaurantId,
                    searchTerm: this.searchTerm
                });
            } catch (err) {
                console.error(err);
            }
        }
    }

    handleAddItem(event) {
        const menuItemId = event.currentTarget.dataset.id;
        this.dispatchEvent(new CustomEvent('additem', {
            detail: { menuItemId, quantity: 1, notes: '' }
        }));
    }

    isCategorySelected(categoryId) {
        return categoryId === this.selectedCategoryId;
    }
}
```

```html
<!-- posMenuBrowser.html -->
<template>
    <div class="menu-browser">
        <div class="menu-search">
            <lightning-input
                type="search"
                placeholder="Search menu..."
                value={searchTerm}
                onchange={handleSearch}
            ></lightning-input>
        </div>

        <div class="category-tabs">
            <template for:each={categories} for:item="cat">
                <button key={cat.Id}
                        class="category-tab"
                        data-id={cat.Id}
                        onclick={handleCategoryClick}>
                    {cat.Name}
                </button>
            </template>
        </div>

        <div class="menu-items-grid">
            <template for:each={items} for:item="item">
                <div key={item.Id} class="menu-item-card" data-id={item.Id} onclick={handleAddItem}>
                    <div class="item-info">
                        <span class="item-name">
                            <template lwc:if={item.Is_Vegetarian__c}>
                                <span class="veg-badge">●</span>
                            </template>
                            <template lwc:else>
                                <span class="non-veg-badge">●</span>
                            </template>
                            {item.Name}
                        </span>
                        <span class="item-price">{item.Price__c}</span>
                    </div>
                    <template lwc:if={item.Description__c}>
                        <div class="item-desc">{item.Description__c}</div>
                    </template>
                    <div class="add-btn">
                        <lightning-icon icon-name="utility:add" size="xx-small"></lightning-icon>
                        Add
                    </div>
                </div>
            </template>
        </div>
    </div>
</template>
```

### Step 5.6: Order Item Row — `posOrderItem`

```javascript
// posOrderItem.js
import { LightningElement, api } from 'lwc';

export default class PosOrderItem extends LightningElement {
    @api item;
    @api currencyCode;

    handleIncrement() {
        this.dispatchEvent(new CustomEvent('updatequantity', {
            detail: {
                itemId: this.item.Id,
                quantity: this.item.Quantity__c + 1
            }
        }));
    }

    handleDecrement() {
        const newQty = this.item.Quantity__c - 1;
        if (newQty <= 0) {
            this.handleRemove();
        } else {
            this.dispatchEvent(new CustomEvent('updatequantity', {
                detail: {
                    itemId: this.item.Id,
                    quantity: newQty
                }
            }));
        }
    }

    handleRemove() {
        this.dispatchEvent(new CustomEvent('removeitem', {
            detail: { itemId: this.item.Id }
        }));
    }
}
```

```html
<!-- posOrderItem.html -->
<template>
    <div class="order-item-row">
        <div class="item-details">
            <span class="item-name">{item.Item_Name__c}</span>
            <template lwc:if={item.Notes__c}>
                <span class="item-notes">{item.Notes__c}</span>
            </template>
        </div>
        <div class="item-quantity">
            <button class="qty-btn" onclick={handleDecrement}>−</button>
            <span class="qty-value">{item.Quantity__c}</span>
            <button class="qty-btn" onclick={handleIncrement}>+</button>
        </div>
        <div class="item-price">{item.Line_Total__c}</div>
        <button class="remove-btn" onclick={handleRemove}>
            <lightning-icon icon-name="utility:delete" size="xx-small" variant="error"></lightning-icon>
        </button>
    </div>
</template>
```

### Step 5.7: Payment Component — `posPayment`

```javascript
// posPayment.js
import { LightningElement, api, track } from 'lwc';

export default class PosPayment extends LightningElement {
    @api total;
    @api currencyCode;
    @track selectedMethod = '';

    paymentMethods = [
        { label: 'Cash', value: 'Cash', icon: 'utility:money' },
        { label: 'Card', value: 'Card', icon: 'utility:record' },
        { label: 'UPI', value: 'UPI', icon: 'utility:phone_portrait' }
    ];

    handleSelectMethod(event) {
        this.selectedMethod = event.currentTarget.dataset.value;
    }

    handlePay() {
        if (!this.selectedMethod) return;
        this.dispatchEvent(new CustomEvent('pay', {
            detail: { method: this.selectedMethod }
        }));
    }

    handleCancel() {
        this.dispatchEvent(new CustomEvent('cancel'));
    }
}
```

```html
<!-- posPayment.html -->
<template>
    <section class="slds-modal slds-fade-in-open" role="dialog">
        <div class="slds-modal__container">
            <header class="slds-modal__header">
                <h2 class="slds-modal__title">Payment</h2>
            </header>
            <div class="slds-modal__content slds-p-around_medium">
                <div class="payment-total">
                    <span>Total Amount</span>
                    <span class="total-value">{total}</span>
                </div>
                <div class="payment-methods">
                    <template for:each={paymentMethods} for:item="pm">
                        <button key={pm.value}
                                class="payment-method-btn"
                                data-value={pm.value}
                                onclick={handleSelectMethod}>
                            <lightning-icon icon-name={pm.icon} size="medium"></lightning-icon>
                            <span>{pm.label}</span>
                        </button>
                    </template>
                </div>
            </div>
            <footer class="slds-modal__footer">
                <lightning-button label="Cancel" onclick={handleCancel}></lightning-button>
                <lightning-button
                    label="Confirm Payment"
                    variant="brand"
                    onclick={handlePay}
                    disabled={!selectedMethod}
                    class="slds-m-left_small"
                ></lightning-button>
            </footer>
        </div>
    </section>
    <div class="slds-backdrop slds-backdrop_open"></div>
</template>
```

### Step 5.8: Receipt Component — `posReceipt`

```javascript
// posReceipt.js
import { LightningElement, api, track } from 'lwc';
import getReceiptData from '@salesforce/apex/ReceiptController.getReceiptData';

export default class PosReceipt extends LightningElement {
    @api receiptId;
    @track receipt;
    @track items = [];
    isLoading = true;

    connectedCallback() {
        this.loadReceipt();
    }

    async loadReceipt() {
        try {
            const result = await getReceiptData({ receiptId: this.receiptId });
            this.receipt = result.receipt;
            this.items = result.items;
        } catch (err) {
            console.error('Receipt load error:', err);
        } finally {
            this.isLoading = false;
        }
    }

    handlePrint() {
        const receiptEl = this.template.querySelector('.receipt-print-area');
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html><head><title>Receipt</title>
            <style>
                body { font-family: 'Courier New', monospace; max-width: 300px; margin: 0 auto; padding: 10px; font-size: 12px; }
                .center { text-align: center; }
                .line { border-top: 1px dashed #000; margin: 8px 0; }
                .row { display: flex; justify-content: space-between; }
                .bold { font-weight: bold; }
                h2 { margin: 4px 0; }
                @media print { body { margin: 0; } }
            </style></head><body>
            ${receiptEl.innerHTML}
            </body></html>
        `);
        printWindow.document.close();
        printWindow.print();
    }

    handleBack() {
        this.dispatchEvent(new CustomEvent('backtotables'));
    }

    get restaurantName() { return this.receipt?.Restaurant__r?.Name || ''; }
    get restaurantAddress() { return this.receipt?.Restaurant__r?.Address__c || ''; }
    get restaurantPhone() { return this.receipt?.Restaurant__r?.Phone__c || ''; }
    get receiptNumber() { return this.receipt?.Receipt_Number__c || ''; }
    get orderNumber() { return this.receipt?.POS_Order__r?.Name || ''; }
    get tableName() { return this.receipt?.POS_Order__r?.Table__r?.Name || ''; }
    get formattedDate() {
        if (!this.receipt?.Generated_DateTime__c) return '';
        return new Date(this.receipt.Generated_DateTime__c).toLocaleString();
    }
}
```

```html
<!-- posReceipt.html -->
<template>
    <div class="receipt-container">
        <template lwc:if={isLoading}>
            <lightning-spinner alternative-text="Loading..."></lightning-spinner>
        </template>
        <template lwc:else>
            <div class="receipt-actions">
                <lightning-button label="Print Receipt" variant="brand"
                    icon-name="utility:print" onclick={handlePrint}></lightning-button>
                <lightning-button label="Back to Tables"
                    onclick={handleBack} class="slds-m-left_small"></lightning-button>
            </div>

            <div class="receipt-print-area">
                <div class="center">
                    <h2>{restaurantName}</h2>
                    <p>{restaurantAddress}</p>
                    <p>Tel: {restaurantPhone}</p>
                </div>
                <div class="line"></div>
                <div class="row"><span>Receipt #:</span><span>{receiptNumber}</span></div>
                <div class="row"><span>Order:</span><span>{orderNumber}</span></div>
                <div class="row"><span>Table:</span><span>{tableName}</span></div>
                <div class="row"><span>Date:</span><span>{formattedDate}</span></div>
                <div class="line"></div>

                <div class="row bold">
                    <span>Item</span>
                    <span>Qty</span>
                    <span>Amt</span>
                </div>
                <div class="line"></div>

                <template for:each={items} for:item="item">
                    <div key={item.Id} class="row">
                        <span>{item.Item_Name__c}</span>
                        <span>{item.Quantity__c}</span>
                        <span>{item.Line_Total__c}</span>
                    </div>
                </template>

                <div class="line"></div>
                <div class="row"><span>Subtotal:</span><span>{receipt.Subtotal__c}</span></div>
                <div class="row"><span>Tax:</span><span>{receipt.Tax_Amount__c}</span></div>
                <template lwc:if={receipt.Discount_Amount__c}>
                    <div class="row"><span>Discount:</span><span>-{receipt.Discount_Amount__c}</span></div>
                </template>
                <div class="line"></div>
                <div class="row bold"><span>TOTAL:</span><span>{receipt.Total_Amount__c}</span></div>
                <div class="line"></div>
                <div class="row"><span>Payment:</span><span>{receipt.Payment_Method__c}</span></div>
                <div class="line"></div>
                <div class="center">
                    <p>Thank you for dining with us!</p>
                </div>
            </div>
        </template>
    </div>
</template>
```

### Step 5.9: Header Component — `posHeader`

```javascript
// posHeader.js
import { LightningElement, api } from 'lwc';

export default class PosHeader extends LightningElement {
    @api restaurantName;
    @api currentView;

    get showBackButton() {
        return this.currentView !== 'tables' && this.currentView !== 'login';
    }

    handleBack() {
        this.dispatchEvent(new CustomEvent('backtotables'));
    }

    handleNavTables() {
        this.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'tables' } }));
    }

    handleNavKitchen() {
        this.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'kitchen' } }));
    }
}
```

```html
<!-- posHeader.html -->
<template>
    <header class="pos-header">
        <div class="header-left">
            <template lwc:if={showBackButton}>
                <lightning-button-icon
                    icon-name="utility:back"
                    variant="bare-inverse"
                    onclick={handleBack}
                    class="slds-m-right_small"
                ></lightning-button-icon>
            </template>
            <h1 class="header-title">{restaurantName}</h1>
        </div>
        <div class="header-right">
            <lightning-button label="Tables" onclick={handleNavTables}
                variant="neutral" class="slds-m-right_small"></lightning-button>
            <lightning-button label="Kitchen" onclick={handleNavKitchen}
                variant="neutral"></lightning-button>
        </div>
    </header>
</template>
```

### Step 5.10: Deploy LWC Components

```bash
sf project deploy start --source-dir force-app/main/default/lwc --target-org <alias>
```

---

## 7. Phase 6 — Experience Cloud Site Setup

### Step 6.1: Create the Experience Cloud Site

1. Go to **Setup → Digital Experiences → All Sites**
2. Click **"New"**
3. Choose template: **"Build Your Own (LWR)"** or **"Aura"**
   - **Recommended: Aura** (better LWC compatibility for custom apps)
   - If you want a more modern framework, choose LWR (Lightning Web Runtime)
4. Site Name: **"RestoPos"**
5. URL Suffix: **pos** (site URL becomes `https://your-domain.my.site.com/pos`)
6. Click **Create**

### Step 6.2: Configure the Site in Experience Builder

1. After creation, click **"Builder"** to open Experience Builder
2. Go to **Settings (gear icon) → General:**
   - Site URL: Verify it's correct
   - Guest User Profile: Note the auto-created guest profile name

3. **Create a new page:**
   - Click **Pages** (in the left sidebar) → **New Page**
   - Choose **"Standard Page"** → **"Flexible Layout"**
   - Name: **"POS Terminal"**
   - Set this as the **Default/Home page**

4. **Add the LWC component:**
   - In Experience Builder, drag from **Custom Components** section
   - Find **"restoPosApp"** (it appears because of the `lightningCommunity__Page` target)
   - Drop it into the page's main content area
   - It should take up the full width

5. **Theme Configuration:**
   - Go to **Theme** settings
   - Hide the default header/footer (the POS has its own header)
   - Or set the theme to minimal

### Step 6.3: Configure Guest User Access

1. In Experience Builder → **Settings → General:**
   - Enable **"Guest users can see and interact with the site without logging in"**

2. **Set the Guest User Profile:**
   - Go to **Setup → Sites → [Your Site]**
   - Click on the **Guest User Profile** link
   - Note the profile name (e.g., "RestoPos Profile")

### Step 6.4: Publish the Site

1. In Experience Builder, click **"Publish"**
2. Confirm publication
3. Your site is now live at: `https://your-domain.my.site.com/pos`

### Step 6.5: Access the POS

Staff can access the POS at:
```
https://your-domain.my.site.com/pos?rc=TCH001
```
Where `rc=TCH001` is the restaurant code passed as a URL parameter.

---

## 8. Phase 7 — Security & Guest User Permissions

This is **critical** — without proper permissions, the guest user cannot access custom objects.

### Step 7.1: Guest User Profile — Object Permissions

Go to the Guest User Profile (Setup → Profiles → [Site Guest User Profile]) and set:

| Object               | Read | Create | Edit | Delete |
|----------------------|------|--------|------|--------|
| Restaurant__c        | ✅   | ❌     | ❌   | ❌     |
| Restaurant_Table__c  | ✅   | ❌     | ✅   | ❌     |
| Menu_Category__c     | ✅   | ❌     | ❌   | ❌     |
| Menu_Item__c         | ✅   | ❌     | ❌   | ❌     |
| POS_Order__c         | ✅   | ✅     | ✅   | ❌     |
| Order_Item__c        | ✅   | ✅     | ✅   | ✅     |
| Receipt__c           | ✅   | ✅     | ❌   | ❌     |

### Step 7.2: Field-Level Security

For each object above, ensure all relevant fields are **Visible** on the Guest User Profile. Go to each object → Fields → Set Field-Level Security.

### Step 7.3: Guest User Sharing

Since we use `without sharing` in Apex controllers, the guest user bypasses OWD sharing rules. However, for extra safety:

1. **Setup → Sharing Settings:**
   - Set OWD for custom objects to **Public Read Only** or **Public Read/Write** for the POC
   - For production, use **Private** and manage via Apex `without sharing`

2. **Alternatively**, create a Sharing Rule:
   - Share all Restaurant records with the Guest User
   - Or set OWD to Public Read Only for simplicity in POC

### Step 7.4: Apex Class Access for Guest User

The Guest User Profile must have access to all Apex controllers:

1. Go to **Guest User Profile → Apex Class Access**
2. Add all POS controllers:
   - `RestoPosController`
   - `TableController`
   - `MenuController`
   - `OrderController`
   - `ReceiptController`

### Step 7.5: Configure CORS (if needed)

If the site makes API calls:
1. **Setup → CORS → New**
2. Add your site URL: `https://your-domain.my.site.com`

### Step 7.6: Secure the Guest User (Important!)

Guest user security best practices:
- Never expose sensitive data (no PII in guest-accessible queries)
- The PIN field is checked via Apex — never expose it in wire queries
- Use `@AuraEnabled` methods (not wire for sensitive operations)
- Add rate limiting via Custom Settings if needed
- Monitor guest user API usage in Setup → Security → Login History

---

## 9. Phase 8 — Receipt Generation & Printing

### Approach 1: Browser Print (Recommended for POC)

Already implemented in the `posReceipt` component above. It opens a print-friendly window using `window.print()`.

### Approach 2: PDF Receipt via Visualforce

For a more polished receipt, create a Visualforce page:

```html
<!-- ReceiptPDF.page -->
<apex:page standardController="Receipt__c" extensions="ReceiptPDFController"
           renderAs="pdf" showHeader="false" sidebar="false"
           applyHtmlTag="false" applyBodyTag="false">
<html>
<head>
    <style>
        body { font-family: 'Courier New', monospace; width: 80mm; margin: 0 auto; font-size: 11px; }
        .center { text-align: center; }
        .line { border-top: 1px dashed #000; margin: 5px 0; }
        table { width: 100%; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
    </style>
</head>
<body>
    <div class="center">
        <h3>{!restaurant.Name}</h3>
        <p>{!restaurant.Address__c}</p>
        <p>Tel: {!restaurant.Phone__c}</p>
    </div>
    <div class="line"></div>
    <p>Receipt: {!Receipt__c.Receipt_Number__c}</p>
    <p>Date: <apex:outputText value="{0,date,dd/MM/yyyy HH:mm}"><apex:param value="{!Receipt__c.Generated_DateTime__c}"/></apex:outputText></p>
    <p>Table: {!Receipt__c.POS_Order__r.Table__r.Name}</p>
    <div class="line"></div>

    <table>
        <tr class="bold"><td>Item</td><td class="right">Qty</td><td class="right">Amount</td></tr>
        <apex:repeat value="{!orderItems}" var="item">
            <tr>
                <td>{!item.Item_Name__c}</td>
                <td class="right">{!item.Quantity__c}</td>
                <td class="right">{!item.Line_Total__c}</td>
            </tr>
        </apex:repeat>
    </table>

    <div class="line"></div>
    <table>
        <tr><td>Subtotal:</td><td class="right">{!Receipt__c.Subtotal__c}</td></tr>
        <tr><td>Tax:</td><td class="right">{!Receipt__c.Tax_Amount__c}</td></tr>
        <tr class="bold"><td>TOTAL:</td><td class="right">{!Receipt__c.Total_Amount__c}</td></tr>
    </table>
    <div class="line"></div>
    <div class="center"><p>Thank you!</p></div>
</body>
</html>
</apex:page>
```

### Approach 3: Thermal Printer Integration (Future)

For physical receipt printers, you'll need:
- A local print server (Node.js app) running on the restaurant's network
- The LWC sends receipt data to the local print server via HTTP
- The print server formats and sends to the ESC/POS thermal printer
- This is a Phase 2 enhancement

---

## 10. Phase 9 — Testing & Deployment

### Step 9.1: Apex Unit Tests

Create test classes for all controllers. Minimum 75% code coverage required for deployment.

```apex
@IsTest
public class RestoPosTestFactory {

    public static Restaurant__c createRestaurant() {
        Restaurant__c r = new Restaurant__c(
            Name = 'Test Restaurant',
            Code__c = 'TEST01',
            Tax_Rate__c = 5.0,
            Currency_Code__c = 'INR',
            PIN__c = '1234',
            Is_Active__c = true
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
}
```

```apex
@IsTest
public class OrderControllerTest {

    @TestSetup
    static void setup() {
        Restaurant__c r = RestoPosTestFactory.createRestaurant();
        RestoPosTestFactory.createTables(r.Id, 5);
        Menu_Category__c cat = RestoPosTestFactory.createCategory(r.Id, 'Main');
        RestoPosTestFactory.createMenuItem(r.Id, cat.Id, 'Test Item', 100);
    }

    @IsTest
    static void testCreateOrder() {
        Restaurant__c r = [SELECT Id FROM Restaurant__c LIMIT 1];
        Restaurant_Table__c t = [SELECT Id FROM Restaurant_Table__c LIMIT 1];

        Test.startTest();
        POS_Order__c ord = OrderController.createOrder(r.Id, t.Id);
        Test.stopTest();

        System.assertNotEquals(null, ord.Id);
        System.assertEquals('New', ord.Status__c);
    }

    @IsTest
    static void testAddAndRemoveOrderItem() {
        Restaurant__c r = [SELECT Id FROM Restaurant__c LIMIT 1];
        Restaurant_Table__c t = [SELECT Id FROM Restaurant_Table__c LIMIT 1];
        Menu_Item__c mi = [SELECT Id FROM Menu_Item__c LIMIT 1];

        POS_Order__c ord = OrderController.createOrder(r.Id, t.Id);

        Test.startTest();
        Order_Item__c item = OrderController.addOrderItem(ord.Id, mi.Id, 2, 'Extra spicy');
        System.assertNotEquals(null, item.Id);
        System.assertEquals(2, item.Quantity__c);

        OrderController.updateOrderItemQuantity(item.Id, 3);
        OrderController.removeOrderItem(item.Id);
        Test.stopTest();
    }

    @IsTest
    static void testProcessPayment() {
        Restaurant__c r = [SELECT Id FROM Restaurant__c LIMIT 1];
        Restaurant_Table__c t = [SELECT Id FROM Restaurant_Table__c LIMIT 1];
        Menu_Item__c mi = [SELECT Id FROM Menu_Item__c LIMIT 1];

        POS_Order__c ord = OrderController.createOrder(r.Id, t.Id);
        OrderController.addOrderItem(ord.Id, mi.Id, 1, '');

        Test.startTest();
        POS_Order__c result = OrderController.processPayment(ord.Id, 'Cash');
        Test.stopTest();

        System.assertEquals('Paid', result.Payment_Status__c);
    }
}
```

### Step 9.2: Run Tests

```bash
sf apex run test --test-level RunLocalTests --target-org <alias> --wait 10
```

### Step 9.3: Deploy Everything

```bash
# Deploy all metadata
sf project deploy start --source-dir force-app --target-org <alias>

# Verify deployment
sf project deploy report --target-org <alias>
```

### Step 9.4: Post-Deployment Checklist

- [ ] Verify all custom objects appear in Setup → Object Manager
- [ ] Run seed data script to create test restaurant & menu
- [ ] Open the Experience Cloud site URL in an incognito browser
- [ ] Test PIN login flow
- [ ] Test table selection & order creation
- [ ] Test adding/removing menu items
- [ ] Test payment & receipt generation
- [ ] Test print receipt functionality
- [ ] Test on tablet/mobile (POS is typically used on tablets)

---

## 11. Multi-Restaurant Isolation Strategy

### How 1 License = 1 Restaurant Works

```
PDE Org
├── User License 1 → Restaurant A (manages via Setup/App)
│   └── Public Site URL: .../pos?rc=RESTA
│       └── All data filtered by Restaurant__c = RESTA
│
├── User License 2 → Restaurant B
│   └── Public Site URL: .../pos?rc=RESTB
│       └── All data filtered by Restaurant__c = RESTB
│
└── Guest User (shared across all restaurants)
    └── Apex controllers filter by restaurant code from URL
```

### Data Isolation via Apex

All controllers already filter by `restaurantId`. The flow:

1. Staff opens `https://site.com/pos?rc=TCH001`
2. LWC reads `rc` parameter from URL
3. Calls `getRestaurantByCode('TCH001')` → gets Restaurant record
4. All subsequent Apex calls include `restaurantId` as a parameter
5. All SOQL queries include `WHERE Restaurant__c = :restaurantId`

### Per-Restaurant Admin

Each restaurant's Platform User (with a Platform license) can:
- Log into Salesforce directly
- Manage their menu items, categories, tables
- View reports & dashboards for their restaurant
- Use a custom app (Lightning App) built for restaurant management

### Optional: Custom Admin App

Create a Lightning App called "RestoPos Admin" with:
- Tab: Restaurants
- Tab: Menu Management (custom LWC for bulk menu editing)
- Tab: Reports (order volume, revenue, popular items)

---

## 12. Common Pitfalls & Troubleshooting

### Problem: "No access to entity" error on public site

**Cause:** Guest user profile doesn't have object permissions.
**Fix:** Go to the Guest User Profile → Object Settings → Enable Read/Create/Edit as needed.

### Problem: `@AuraEnabled` methods fail with "Insufficient access"

**Cause:** Guest profile doesn't have Apex Class Access.
**Fix:** Profile → Apex Class Access → Add all controller classes.

### Problem: Fields show as null in LWC despite having data

**Cause:** Field-Level Security on guest profile hides the fields.
**Fix:** Profile → Field-Level Security → Set Visible for all needed fields.

### Problem: `refreshApex` doesn't work

**Cause:** Only works with `@wire` decorated properties.
**Fix:** Store the wired result and pass it to `refreshApex`. See `posTableView` example.

### Problem: LWC doesn't appear in Experience Builder

**Cause:** Missing `lightningCommunity__Page` target in `js-meta.xml`.
**Fix:** Add both `lightningCommunity__Page` and `lightningCommunity__Default` targets.

### Problem: SOQL relationship name for child query

**Cause:** Child relationship name for `Order_Item__c` under `POS_Order__c`.
**Fix:** Check the actual relationship name in Setup → Object Manager → POS_Order__c → Relationships. It's typically `Order_Items__r` (pluralized API name with `__r`).

### Problem: Guest user can see all restaurant data

**Cause:** OWD is Public Read/Write, no filtering in queries.
**Fix:** All Apex controllers already filter by `restaurantId`. For extra safety, use `with sharing` and create sharing rules, or use a Record-Type-based approach.

### Problem: Experience Cloud site not loading

**Fix checklist:**
1. Is the site **Published**? (Builder → Publish)
2. Is the site **Active**? (Setup → All Sites → check Status)
3. Is the Guest User Profile **active**?
4. Clear browser cache and try incognito

---

## 13. Future Enhancements

### Phase 2 (Post-POC)

- **Kitchen Display System (KDS):** Real-time order queue for the kitchen using Platform Events
- **Inventory Management:** Track ingredient stock levels
- **Staff Management:** Waiter assignment to tables, shift tracking
- **Reporting Dashboard:** Daily revenue, popular items, peak hours (using Salesforce Reports/Dashboards)
- **Customer Feedback:** QR code on receipt linking to a feedback form
- **Multi-language Menu:** Translation workbench or custom labels
- **Offline Mode:** Service Worker + IndexedDB for intermittent connectivity
- **Thermal Printer Integration:** Direct ESC/POS printer support via local bridge app
- **GST/Tax Compliance:** Indian GST format receipts with GSTIN, HSN codes
- **Table Reservation System:** Time-slot based reservation with SMS/WhatsApp confirmation

### Phase 3 (Scale)

- **Managed Package:** Package RestoPos as a Salesforce managed package for AppExchange
- **Multi-Org Strategy:** Each restaurant gets their own org (for larger deployments)
- **Mobile App:** Salesforce Mobile SDK-based native app
- **Analytics:** Einstein Analytics dashboards
- **AI:** Einstein-powered menu recommendations, demand forecasting

---

## Quick Reference: File Structure

```
force-app/main/default/
├── classes/
│   ├── RestoPosController.cls
│   ├── RestoPosController.cls-meta.xml
│   ├── TableController.cls
│   ├── TableController.cls-meta.xml
│   ├── MenuController.cls
│   ├── MenuController.cls-meta.xml
│   ├── OrderController.cls
│   ├── OrderController.cls-meta.xml
│   ├── ReceiptController.cls
│   ├── ReceiptController.cls-meta.xml
│   ├── ReceiptPDFController.cls
│   ├── ReceiptPDFController.cls-meta.xml
│   ├── RestoPosTestFactory.cls
│   ├── RestoPosTestFactory.cls-meta.xml
│   └── OrderControllerTest.cls
│   └── OrderControllerTest.cls-meta.xml
├── lwc/
│   ├── restoPosApp/
│   ├── posLogin/
│   ├── posTableView/
│   ├── posOrderScreen/
│   ├── posMenuBrowser/
│   ├── posOrderItem/
│   ├── posPayment/
│   ├── posReceipt/
│   └── posHeader/
├── objects/
│   ├── Restaurant__c/
│   ├── Restaurant_Table__c/
│   ├── Menu_Category__c/
│   ├── Menu_Item__c/
│   ├── POS_Order__c/
│   ├── Order_Item__c/
│   └── Receipt__c/
├── pages/
│   └── ReceiptPDF.page
└── sites/
    └── (Experience Cloud site metadata)
```

---

## Summary of Steps

| # | Phase | Action | Time Estimate |
|---|-------|--------|---------------|
| 1 | Org Setup | Enable Digital Experiences, verify PDE | 30 min |
| 2 | Data Model | Create 7 custom objects with fields | 2-3 hours |
| 3 | Seed Data | Run Apex script to create test data | 15 min |
| 4 | Apex | Build 5 controller classes | 3-4 hours |
| 5 | LWC | Build 8 components | 6-8 hours |
| 6 | Site Setup | Create & configure Experience Cloud site | 1-2 hours |
| 7 | Security | Guest user profile, permissions, FLS | 1-2 hours |
| 8 | Receipts | Browser print + optional PDF | 1-2 hours |
| 9 | Testing | Unit tests, integration testing | 2-3 hours |
| **Total** | | | **~18-25 hours** |

---

*Guide created for RestoPos — March 2026*

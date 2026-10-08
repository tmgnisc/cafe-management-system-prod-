-- =====================================================================
-- Demo seed: tables, categories, menu, inventory, recipes
-- DEVELOPMENT ONLY. Requires the superadmin (user id 1) to exist.
-- Also adds a demo STAFF account: staff@ishascozycafe.com / IshaStaff@2026
-- =====================================================================
USE `cafe`;

INSERT INTO users (name, email, phone, password, role, status) VALUES
('Ram Thapa', 'staff@ishascozycafe.com', '9800000002', '$2y$10$NZ4SMUSNsq0DqFj49SF/X./NyB09NYbfH7x6Olbuk/0p4AMlnBx02', 'STAFF', 'ACTIVE');

INSERT INTO cafe_tables (table_number, name, capacity, section) VALUES
('01', 'Table 01', 2, 'Indoor'),
('02', 'Table 02', 2, 'Indoor'),
('03', 'Table 03', 4, 'Indoor'),
('04', 'Table 04', 4, 'Indoor'),
('05', 'Table 05', 4, 'Window'),
('06', 'Table 06', 6, 'Outdoor'),
('07', 'Table 07', 6, 'Outdoor'),
('08', 'Table 08', 8, 'Garden');

INSERT INTO categories (name, description, sort_order) VALUES
('Coffee',      'Freshly pulled espresso drinks',          1),
('Tea',         'Himalayan teas and chiya',                2),
('Cold Drinks', 'Chilled coffees and refreshers',          3),
('Breakfast',   'Sandwiches and morning plates',           4),
('Snacks',      'Momo, fries and bites',                   5),
('Main Course', 'Pasta, pizza and hearty plates',          6),
('Desserts',    'Cakes and sweet treats',                  7);

INSERT INTO menu_items (category_id, name, sku, description, selling_price, cost_price, track_inventory) VALUES
((SELECT id FROM categories WHERE name='Coffee'),      'Espresso',         'COF-ESP', 'Single origin double shot',                 150, 55, 1),
((SELECT id FROM categories WHERE name='Coffee'),      'Cappuccino',       'COF-CAP', 'Espresso with velvety steamed milk foam',   180, 65, 1),
((SELECT id FROM categories WHERE name='Coffee'),      'Latte',            'COF-LAT', 'Smooth espresso with silky milk',           240, 70, 1),
((SELECT id FROM categories WHERE name='Coffee'),      'Americano',        'COF-AME', 'Espresso lengthened with hot water',        170, 45, 1),
((SELECT id FROM categories WHERE name='Coffee'),      'Mocha',            'COF-MOC', 'Espresso, chocolate and steamed milk',      260, 90, 1),
((SELECT id FROM categories WHERE name='Tea'),         'Masala Tea',       'TEA-MAS', 'Spiced milk chiya',                         80, 25, 1),
((SELECT id FROM categories WHERE name='Tea'),         'Milk Tea',         'TEA-MLK', 'Classic Nepali milk tea',                   60, 20, 1),
((SELECT id FROM categories WHERE name='Tea'),         'Lemon Tea',        'TEA-LEM', 'Black tea with fresh lemon',                70, 15, 1),
((SELECT id FROM categories WHERE name='Cold Drinks'), 'Iced Coffee',      'CLD-ICE', 'Espresso over ice',                         250, 60, 1),
((SELECT id FROM categories WHERE name='Cold Drinks'), 'Cold Coffee',      'CLD-CCF', 'Blended coffee with milk and ice',          280, 80, 1),
((SELECT id FROM categories WHERE name='Breakfast'),   'Chicken Sandwich', 'BRK-CSW', 'Grilled chicken, cheese, toasted bread',    320, 130, 1),
((SELECT id FROM categories WHERE name='Breakfast'),   'Club Sandwich',    'BRK-CLB', 'Triple-decker with chicken and cheese',     380, 150, 1),
((SELECT id FROM categories WHERE name='Snacks'),      'French Fries',     'SNK-FRY', 'Crispy salted fries',                       180, 45, 1),
((SELECT id FROM categories WHERE name='Snacks'),      'Chicken Momo',     'SNK-CMO', 'Steamed chicken dumplings with achar',      250, 95, 1),
((SELECT id FROM categories WHERE name='Snacks'),      'Veg Momo',         'SNK-VMO', 'Steamed vegetable dumplings with achar',    200, 60, 1),
((SELECT id FROM categories WHERE name='Main Course'), 'Pasta',            'MCS-PST', 'Creamy white-sauce penne',                  420, 150, 1),
((SELECT id FROM categories WHERE name='Main Course'), 'Pizza',            'MCS-PZA', '10" chicken & cheese pizza',                650, 260, 1),
((SELECT id FROM categories WHERE name='Desserts'),    'Chocolate Cake',   'DES-CAK', 'Rich layered chocolate cake slice',         280, 95, 1),
((SELECT id FROM categories WHERE name='Desserts'),    'Brownie',          'DES-BRW', 'Fudgy walnut brownie',                      220, 70, 1);

INSERT INTO inventory_items (name, sku, unit, current_quantity, minimum_quantity, cost_per_unit, supplier) VALUES
('Coffee Beans', 'INV-COF', 'kg',    5.000,  1.000, 2200, 'Himalayan Arabica Traders'),
('Milk',         'INV-MLK', 'liter', 20.000, 5.000, 110,  'DDC Dairy'),
('Sugar',        'INV-SUG', 'kg',    10.000, 2.000, 120,  'Bhatbhateni Wholesale'),
('Tea Leaves',   'INV-TEA', 'kg',    2.000,  0.500, 900,  'Ilam Tea Estate'),
('Flour',        'INV-FLR', 'kg',    15.000, 3.000, 80,   'Bhatbhateni Wholesale'),
('Chicken',      'INV-CHK', 'kg',    8.000,  2.000, 550,  'Fresh Meat Suppliers'),
('Cheese',       'INV-CHS', 'kg',    3.000,  1.000, 1200, 'Nepal Dairy Co.'),
('Bread',        'INV-BRD', 'pcs',   40.000, 10.000, 12,  'Kathmandu Bakery'),
('Potatoes',     'INV-POT', 'kg',    12.000, 3.000, 60,   'Kalimati Market'),
('Chocolate',    'INV-CHO', 'kg',    2.000,  0.500, 1500, 'Bhatbhateni Wholesale');

-- Opening stock movement for every inventory item
INSERT INTO stock_movements (inventory_item_id, type, quantity, previous_quantity, new_quantity, reference_type, reason, created_by)
SELECT id, 'INITIAL_STOCK', current_quantity, 0, current_quantity, 'INVENTORY', 'Opening stock', 1 FROM inventory_items;

-- Recipes (quantities are per ONE serving)
INSERT INTO recipes (menu_item_id) SELECT id FROM menu_items;

INSERT INTO recipe_items (recipe_id, inventory_item_id, quantity, unit)
SELECT r.id, i.id, x.qty, x.unit
FROM (
    SELECT 'COF-ESP' sku, 'INV-COF' inv, 18 qty, 'g' unit
    UNION ALL SELECT 'COF-CAP','INV-COF',18,'g'   UNION ALL SELECT 'COF-CAP','INV-MLK',150,'ml' UNION ALL SELECT 'COF-CAP','INV-SUG',5,'g'
    UNION ALL SELECT 'COF-LAT','INV-COF',18,'g'   UNION ALL SELECT 'COF-LAT','INV-MLK',200,'ml' UNION ALL SELECT 'COF-LAT','INV-SUG',5,'g'
    UNION ALL SELECT 'COF-AME','INV-COF',18,'g'
    UNION ALL SELECT 'COF-MOC','INV-COF',18,'g'   UNION ALL SELECT 'COF-MOC','INV-MLK',150,'ml' UNION ALL SELECT 'COF-MOC','INV-CHO',20,'g' UNION ALL SELECT 'COF-MOC','INV-SUG',5,'g'
    UNION ALL SELECT 'TEA-MAS','INV-TEA',5,'g'    UNION ALL SELECT 'TEA-MAS','INV-MLK',100,'ml' UNION ALL SELECT 'TEA-MAS','INV-SUG',10,'g'
    UNION ALL SELECT 'TEA-MLK','INV-TEA',4,'g'    UNION ALL SELECT 'TEA-MLK','INV-MLK',100,'ml' UNION ALL SELECT 'TEA-MLK','INV-SUG',10,'g'
    UNION ALL SELECT 'TEA-LEM','INV-TEA',3,'g'    UNION ALL SELECT 'TEA-LEM','INV-SUG',10,'g'
    UNION ALL SELECT 'CLD-ICE','INV-COF',18,'g'   UNION ALL SELECT 'CLD-ICE','INV-SUG',10,'g'
    UNION ALL SELECT 'CLD-CCF','INV-COF',18,'g'   UNION ALL SELECT 'CLD-CCF','INV-MLK',200,'ml' UNION ALL SELECT 'CLD-CCF','INV-SUG',15,'g'
    UNION ALL SELECT 'BRK-CSW','INV-BRD',2,'pcs'  UNION ALL SELECT 'BRK-CSW','INV-CHK',100,'g'  UNION ALL SELECT 'BRK-CSW','INV-CHS',20,'g'
    UNION ALL SELECT 'BRK-CLB','INV-BRD',3,'pcs'  UNION ALL SELECT 'BRK-CLB','INV-CHK',80,'g'   UNION ALL SELECT 'BRK-CLB','INV-CHS',30,'g'
    UNION ALL SELECT 'SNK-FRY','INV-POT',250,'g'
    UNION ALL SELECT 'SNK-CMO','INV-FLR',100,'g'  UNION ALL SELECT 'SNK-CMO','INV-CHK',120,'g'
    UNION ALL SELECT 'SNK-VMO','INV-FLR',100,'g'
    UNION ALL SELECT 'MCS-PST','INV-FLR',120,'g'  UNION ALL SELECT 'MCS-PST','INV-CHS',40,'g'   UNION ALL SELECT 'MCS-PST','INV-MLK',50,'ml'
    UNION ALL SELECT 'MCS-PZA','INV-FLR',200,'g'  UNION ALL SELECT 'MCS-PZA','INV-CHS',120,'g'  UNION ALL SELECT 'MCS-PZA','INV-CHK',80,'g'
    UNION ALL SELECT 'DES-CAK','INV-FLR',60,'g'   UNION ALL SELECT 'DES-CAK','INV-CHO',40,'g'   UNION ALL SELECT 'DES-CAK','INV-SUG',30,'g' UNION ALL SELECT 'DES-CAK','INV-MLK',50,'ml'
    UNION ALL SELECT 'DES-BRW','INV-FLR',40,'g'   UNION ALL SELECT 'DES-BRW','INV-CHO',50,'g'   UNION ALL SELECT 'DES-BRW','INV-SUG',25,'g'
) x
JOIN menu_items m ON m.sku = x.sku
JOIN recipes r ON r.menu_item_id = m.id
JOIN inventory_items i ON i.sku = x.inv;

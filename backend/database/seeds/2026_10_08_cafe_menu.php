<?php
declare(strict_types=1);

/**
 * One-time data seed: the cafe's real menu (momo, noodles, laphing, chatpate, drinks, hookah).
 * Run by install.php exactly once per database (tracked in `seed_runs`).
 * Existing categories are reused by name; items whose name or SKU already exists are skipped.
 * Images live in database/seed_images/menu and are copied to public/uploads/menu by install.php.
 */
return function (PDO $pdo): void {
    $menu = [
        ['Momo', 'Steamed, fried or jhol dumplings', [
            ['Veg Steamed Momo',     'MOMO-VEG-STM', 100, 'momo-steamed'],
            ['Veg Fried Momo',       'MOMO-VEG-FRY', 120, 'momo-fried'],
            ['Veg Jhol Momo',        'MOMO-VEG-JHL', 120, 'momo-jhol'],
            ['Buff Steamed Momo',    'MOMO-BUF-STM', 120, 'momo-steamed'],
            ['Buff Fried Momo',      'MOMO-BUF-FRY', 150, 'momo-fried'],
            ['Buff Jhol Momo',       'MOMO-BUF-JHL', 150, 'momo-jhol'],
            ['Chicken Steamed Momo', 'MOMO-CHK-STM', 130, 'momo-steamed'],
            ['Chicken Fried Momo',   'MOMO-CHK-FRY', 160, 'momo-fried'],
            ['Chicken Jhol Momo',    'MOMO-CHK-JHL', 160, 'momo-jhol'],
        ]],
        ['Noodles', 'Keema, spicy and 2PM/Current noodles', [
            ['Veg Keema Noodles (Full)',     'NDL-KEE-VEG-F', 150, 'keema-noodles'],
            ['Veg Keema Noodles (Half)',     'NDL-KEE-VEG-H', 120, 'keema-noodles'],
            ['Egg Keema Noodles (Full)',     'NDL-KEE-EGG-F', 170, 'keema-noodles'],
            ['Egg Keema Noodles (Half)',     'NDL-KEE-EGG-H', 140, 'keema-noodles'],
            ['Buff Keema Noodles (Full)',    'NDL-KEE-BUF-F', 180, 'keema-noodles'],
            ['Buff Keema Noodles (Half)',    'NDL-KEE-BUF-H', 150, 'keema-noodles'],
            ['Chicken Keema Noodles (Full)', 'NDL-KEE-CHK-F', 190, 'keema-noodles'],
            ['Chicken Keema Noodles (Half)', 'NDL-KEE-CHK-H', 160, 'keema-noodles'],
            ['Keema Noodles Mix',            'NDL-KEE-MIX',   220, 'keema-noodles-mix'],
            ['Veg Spicy Noodles',            'NDL-SPC-VEG',   160, 'spicy-noodles'],
            ['Egg Spicy Noodles',            'NDL-SPC-EGG',   180, 'spicy-noodles'],
            ['Buff Spicy Noodles',           'NDL-SPC-BUF',   190, 'spicy-noodles'],
            ['Chicken Spicy Noodles',        'NDL-SPC-CHK',   200, 'spicy-noodles'],
            ['Veg 2PM/Current',              'NDL-2PM-VEG',    70, 'instant-noodles'],
            ['Egg 2PM/Current',              'NDL-2PM-EGG',    90, 'instant-noodles'],
            ['Buff 2PM/Current',             'NDL-2PM-BUF',   110, 'instant-noodles'],
            ['Chicken 2PM/Current',          'NDL-2PM-CHK',   120, 'instant-noodles'],
        ]],
        ['Laphing', 'Cold spicy mung bean noodles', [
            ['Plain Laphing',   'LAP-PLN', 50, 'laphing'],
            ['Wai Wai Laphing', 'LAP-WAI', 60, 'laphing-wai-wai'],
            ['Chips Laphing',   'LAP-CHP', 70, 'laphing-wai-wai'],
            ['Mix Laphing',     'LAP-MIX', 90, 'laphing-mix'],
        ]],
        ['Snacks & Chatpate', 'Chatpate, sadheko and pani puri', [
            ['Chatpate',         'SNC-CHT',     50, 'chatpate'],
            ['Chips Chatpate',   'SNC-CHP-CHT', 70, 'chips-chatpate'],
            ['Wai Wai Sadheko',  'SNC-WAI-SDK', 50, 'wai-wai-sadheko'],
            ['Laphing Chatpate', 'SNC-LAP-CHT', 90, 'laphing-mix'],
            ['Pani Puri',        'SNC-PNP',     50, 'pani-puri'],
        ]],
        ['Hot Drinks', 'Tea, coffee and hot lemon', [
            ['Milk Tea',             'HOT-MLK-TEA', 25, 'milk-tea'],
            ['Milk Coffee',          'HOT-MLK-COF', 70, 'milk-coffee'],
            ['Black Coffee',         'HOT-BLK-COF', 60, 'black-coffee'],
            ['Black Tea',            'HOT-BLK-TEA', 20, 'black-tea'],
            ['Masala Tea',           'HOT-MSL-TEA', 40, 'masala-tea'],
            ['Green Tea',            'HOT-GRN-TEA', 50, 'green-tea'],
            ['Hot Lemon',            'HOT-LEM',     50, 'hot-lemon'],
            ['Hot Lemon with Honey', 'HOT-LEM-HNY', 90, 'hot-lemon-honey'],
        ]],
        ['Cold Drinks', 'Lemonades, iced tea, cold coffee and sodas', [
            ['Lemon Soda',        'CLD-LEM-SDA',  90, 'lemon-soda'],
            ['Fresh Lemonade',    'CLD-FRS-LMD',  70, 'fresh-lemonade'],
            ['Mint Lemonade',     'CLD-MNT-LMD',  80, 'mint-lemonade'],
            ['Peach Iced Tea',    'CLD-PCH-ICT', 150, 'peach-iced-tea'],
            ['Cold Coffee',       'CLD-COF',     100, 'cold-coffee'],
            ['Coke/Fanta/Sprite', 'CLD-SFT',      70, 'soft-drinks'],
        ]],
        ['Extras', 'Hookah', [
            ['Cloud Hookah',        'EXT-HKH-CLD', 350, 'cloud-hookah'],
            ['Hookah All Flavours', 'EXT-HKH-ALL', 500, 'hookah'],
        ]],
    ];

    $sort = (int) $pdo->query('SELECT COALESCE(MAX(sort_order), 0) FROM categories')->fetchColumn();
    $addCategory = $pdo->prepare('INSERT INTO categories (name, description, sort_order) VALUES (?, ?, ?)');
    $findCategory = $pdo->prepare('SELECT id FROM categories WHERE name = ?');
    $exists = $pdo->prepare('SELECT 1 FROM menu_items WHERE sku = ? OR (name = ? AND is_active = 1) LIMIT 1');
    $addItem = $pdo->prepare('INSERT INTO menu_items (category_id, name, sku, image, selling_price) VALUES (?, ?, ?, ?, ?)');

    $added = 0;
    foreach ($menu as [$category, $description, $items]) {
        $findCategory->execute([$category]);
        $categoryId = $findCategory->fetchColumn();
        if ($categoryId === false) {
            $addCategory->execute([$category, $description, ++$sort]);
            $categoryId = $pdo->lastInsertId();
        }
        foreach ($items as [$name, $sku, $price, $image]) {
            $exists->execute([$sku, $name]);
            if ($exists->fetchColumn()) {
                continue;
            }
            $addItem->execute([$categoryId, $name, $sku, "/uploads/menu/{$image}.jpg", $price]);
            $added++;
        }
    }
    echo "    + {$added} menu item(s)\n";
};

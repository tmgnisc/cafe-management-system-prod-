<?php
declare(strict_types=1);

/** A recipe = list of inventory ingredients consumed per ONE serving of a menu item. */
final class Recipe
{
    public static function forMenuItem(int $menuItemId): array
    {
        $recipe = Database::fetch('SELECT * FROM recipes WHERE menu_item_id = ?', [$menuItemId]);
        $items = $recipe ? self::items((int) $recipe['id']) : [];
        return [
            'id'           => $recipe ? (int) $recipe['id'] : null,
            'menu_item_id' => $menuItemId,
            'items'        => $items,
            'updated_at'   => $recipe['updated_at'] ?? null,
        ];
    }

    public static function items(int $recipeId): array
    {
        return cast_rows(
            Database::fetchAll(
                'SELECT ri.id, ri.inventory_item_id, ri.quantity, ri.unit,
                        i.name AS inventory_item_name, i.sku AS inventory_item_sku, i.unit AS inventory_unit,
                        i.current_quantity AS inventory_current_quantity, i.cost_per_unit
                 FROM recipe_items ri JOIN inventory_items i ON i.id = ri.inventory_item_id
                 WHERE ri.recipe_id = ? ORDER BY i.name',
                [$recipeId]
            ),
            ['id', 'inventory_item_id'],
            ['quantity', 'inventory_current_quantity', 'cost_per_unit']
        );
    }

    /** All recipes with their ingredients, keyed for listing pages. */
    public static function all(): array
    {
        $rows = Database::fetchAll(
            'SELECT r.id AS recipe_id, m.id AS menu_item_id, m.name AS menu_item_name, m.sku AS menu_item_sku,
                    m.track_inventory, c.name AS category_name,
                    ri.inventory_item_id, ri.quantity, ri.unit, i.name AS inventory_item_name
             FROM menu_items m
             JOIN categories c ON c.id = m.category_id
             LEFT JOIN recipes r ON r.menu_item_id = m.id
             LEFT JOIN recipe_items ri ON ri.recipe_id = r.id
             LEFT JOIN inventory_items i ON i.id = ri.inventory_item_id
             WHERE m.is_active = 1
             ORDER BY c.sort_order, m.name, i.name'
        );
        $out = [];
        foreach ($rows as $r) {
            $id = (int) $r['menu_item_id'];
            $out[$id] ??= [
                'menu_item_id'    => $id,
                'menu_item_name'  => $r['menu_item_name'],
                'menu_item_sku'   => $r['menu_item_sku'],
                'category_name'   => $r['category_name'],
                'track_inventory' => (bool) $r['track_inventory'],
                'recipe_id'       => $r['recipe_id'] !== null ? (int) $r['recipe_id'] : null,
                'items'           => [],
            ];
            if ($r['inventory_item_id'] !== null) {
                $out[$id]['items'][] = [
                    'inventory_item_id'   => (int) $r['inventory_item_id'],
                    'inventory_item_name' => $r['inventory_item_name'],
                    'quantity'            => (float) $r['quantity'],
                    'unit'                => $r['unit'],
                ];
            }
        }
        return array_values($out);
    }

    /** Replace a menu item's recipe atomically. */
    public static function replace(int $menuItemId, array $items): void
    {
        Database::transaction(function () use ($menuItemId, $items) {
            $recipeId = Database::value('SELECT id FROM recipes WHERE menu_item_id = ? FOR UPDATE', [$menuItemId]);
            if ($recipeId === null) {
                $recipeId = Database::insert('INSERT INTO recipes (menu_item_id) VALUES (?)', [$menuItemId]);
            } else {
                Database::execute('UPDATE recipes SET updated_at = NOW() WHERE id = ?', [$recipeId]);
            }
            Database::execute('DELETE FROM recipe_items WHERE recipe_id = ?', [$recipeId]);
            foreach ($items as $it) {
                Database::insert(
                    'INSERT INTO recipe_items (recipe_id, inventory_item_id, quantity, unit) VALUES (?, ?, ?, ?)',
                    [$recipeId, $it['inventory_item_id'], $it['quantity'], $it['unit']]
                );
            }
        });
    }
}

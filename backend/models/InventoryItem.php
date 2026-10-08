<?php
declare(strict_types=1);

final class InventoryItem
{
    public const UNITS = ['kg', 'g', 'liter', 'ml', 'pcs', 'packet', 'bottle', 'box'];

    /** Stock status is always calculated, never stored. */
    private const STATUS_SQL = "CASE
            WHEN i.current_quantity <= 0 THEN 'OUT_OF_STOCK'
            WHEN i.current_quantity <= i.minimum_quantity THEN 'LOW_STOCK'
            ELSE 'IN_STOCK' END";

    public static function find(int $id): ?array
    {
        return self::cast(Database::fetch('SELECT i.*, ' . self::STATUS_SQL . ' AS stock_status FROM inventory_items i WHERE i.id = ?', [$id]));
    }

    public static function findForUpdate(int $id): ?array
    {
        return Database::fetch('SELECT * FROM inventory_items WHERE id = ? FOR UPDATE', [$id]);
    }

    public static function paginate(array $f, int $page, int $perPage, int $offset): array
    {
        $where = ['1=1'];
        $params = [];
        if (empty($f['include_inactive'])) {
            $where[] = 'i.is_active = 1';
        }
        if (!empty($f['search'])) {
            $where[] = '(i.name LIKE ? OR i.sku LIKE ? OR i.supplier LIKE ?)';
            $like = '%' . $f['search'] . '%';
            array_push($params, $like, $like, $like);
        }
        if (!empty($f['status'])) {
            $where[] = self::STATUS_SQL . ' = ?';
            $params[] = $f['status'];
        }
        $w = implode(' AND ', $where);
        $total = (int) Database::value("SELECT COUNT(*) FROM inventory_items i WHERE {$w}", $params);
        $rows = Database::fetchAll(
            'SELECT i.*, ' . self::STATUS_SQL . " AS stock_status FROM inventory_items i WHERE {$w}
             ORDER BY FIELD(" . self::STATUS_SQL . ", 'OUT_OF_STOCK','LOW_STOCK','IN_STOCK'), i.name
             LIMIT {$perPage} OFFSET {$offset}",
            $params
        );
        return paginated(array_map([self::class, 'cast'], $rows), $total, $page, $perPage);
    }

    public static function lowStock(int $limit = 50): array
    {
        $rows = Database::fetchAll(
            'SELECT i.*, ' . self::STATUS_SQL . " AS stock_status FROM inventory_items i
             WHERE i.is_active = 1 AND i.current_quantity <= i.minimum_quantity
             ORDER BY (i.current_quantity / NULLIF(i.minimum_quantity, 0)), i.name LIMIT {$limit}"
        );
        return array_map([self::class, 'cast'], $rows);
    }

    public static function countLowStock(): int
    {
        return (int) Database::value('SELECT COUNT(*) FROM inventory_items WHERE is_active = 1 AND current_quantity <= minimum_quantity');
    }

    public static function options(): array
    {
        return cast_rows(
            Database::fetchAll('SELECT id, name, sku, unit, current_quantity, cost_per_unit FROM inventory_items WHERE is_active = 1 ORDER BY name'),
            ['id'],
            ['current_quantity', 'cost_per_unit']
        );
    }

    public static function skuExists(string $sku, ?int $exceptId = null): bool
    {
        return (bool) Database::value('SELECT 1 FROM inventory_items WHERE sku = ? AND id <> ?', [$sku, $exceptId ?? 0]);
    }

    public static function create(array $d): int
    {
        return Database::insert(
            'INSERT INTO inventory_items (name, sku, unit, current_quantity, minimum_quantity, cost_per_unit, supplier, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
            [$d['name'], $d['sku'], $d['unit'], $d['current_quantity'] ?? 0, $d['minimum_quantity'] ?? 0, $d['cost_per_unit'] ?? 0, $d['supplier'] ?? null]
        );
    }

    /** Updates descriptive fields. Quantity is ONLY changed via InventoryService (stock movements). */
    public static function update(int $id, array $d): void
    {
        $fields = [];
        $params = [];
        foreach (['name', 'sku', 'unit', 'minimum_quantity', 'cost_per_unit', 'supplier', 'is_active'] as $col) {
            if (array_key_exists($col, $d)) {
                $fields[] = "{$col} = ?";
                $params[] = is_bool($d[$col]) ? (int) $d[$col] : $d[$col];
            }
        }
        if ($fields) {
            $params[] = $id;
            Database::execute('UPDATE inventory_items SET ' . implode(', ', $fields) . ' WHERE id = ?', $params);
        }
    }

    public static function setQuantity(int $id, float $qty): void
    {
        Database::execute('UPDATE inventory_items SET current_quantity = ? WHERE id = ?', [round($qty, 3), $id]);
    }

    public static function isUsedInRecipes(int $id): bool
    {
        return (bool) Database::value('SELECT 1 FROM recipe_items WHERE inventory_item_id = ? LIMIT 1', [$id]);
    }

    public static function cast(?array $row): ?array
    {
        return cast_row($row, ['id'], ['current_quantity', 'minimum_quantity', 'cost_per_unit'], ['is_active']);
    }
}

<?php
declare(strict_types=1);

final class StockMovement
{
    public const TYPES = ['INITIAL_STOCK', 'PURCHASE', 'SALE', 'ADJUSTMENT', 'WASTE', 'RETURN'];

    public static function create(array $d): int
    {
        return Database::insert(
            'INSERT INTO stock_movements
                (inventory_item_id, type, quantity, previous_quantity, new_quantity, reference_type, reference_id, reason, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $d['inventory_item_id'], $d['type'], round($d['quantity'], 3), round($d['previous_quantity'], 3),
                round($d['new_quantity'], 3), $d['reference_type'] ?? null, $d['reference_id'] ?? null,
                $d['reason'] ?? null, $d['created_by'] ?? null,
            ]
        );
    }

    public static function existsForOrder(int $orderId): bool
    {
        return (bool) Database::value(
            "SELECT 1 FROM stock_movements WHERE reference_type = 'ORDER' AND reference_id = ? AND type = 'SALE' LIMIT 1",
            [$orderId]
        );
    }

    public static function forOrder(int $orderId): array
    {
        return self::castAll(Database::fetchAll(
            "SELECT sm.*, i.name AS inventory_item_name, i.unit, u.name AS created_by_name
             FROM stock_movements sm
             JOIN inventory_items i ON i.id = sm.inventory_item_id
             LEFT JOIN users u ON u.id = sm.created_by
             WHERE sm.reference_type = 'ORDER' AND sm.reference_id = ? ORDER BY sm.id",
            [$orderId]
        ));
    }

    public static function paginate(array $f, int $page, int $perPage, int $offset): array
    {
        $where = ['1=1'];
        $params = [];
        if (!empty($f['inventory_item_id'])) {
            $where[] = 'sm.inventory_item_id = ?';
            $params[] = (int) $f['inventory_item_id'];
        }
        if (!empty($f['type'])) {
            $where[] = 'sm.type = ?';
            $params[] = $f['type'];
        }
        if (!empty($f['from'])) {
            $where[] = 'sm.created_at >= ?';
            $params[] = $f['from'] . ' 00:00:00';
        }
        if (!empty($f['to'])) {
            $where[] = 'sm.created_at <= ?';
            $params[] = $f['to'] . ' 23:59:59';
        }
        $w = implode(' AND ', $where);
        $total = (int) Database::value("SELECT COUNT(*) FROM stock_movements sm WHERE {$w}", $params);
        $rows = Database::fetchAll(
            "SELECT sm.*, i.name AS inventory_item_name, i.unit, u.name AS created_by_name,
                    CASE WHEN sm.reference_type = 'ORDER' THEN o.order_number ELSE NULL END AS reference_label
             FROM stock_movements sm
             JOIN inventory_items i ON i.id = sm.inventory_item_id
             LEFT JOIN users u ON u.id = sm.created_by
             LEFT JOIN orders o ON sm.reference_type = 'ORDER' AND o.id = sm.reference_id
             WHERE {$w} ORDER BY sm.id DESC LIMIT {$perPage} OFFSET {$offset}",
            $params
        );
        return paginated(self::castAll($rows), $total, $page, $perPage);
    }

    private static function castAll(array $rows): array
    {
        return cast_rows($rows, ['id', 'inventory_item_id', 'reference_id', 'created_by'], ['quantity', 'previous_quantity', 'new_quantity']);
    }
}

<?php
declare(strict_types=1);

/** Restaurant tables (stored in `cafe_tables`; TABLES is reserved in MySQL). */
final class CafeTable
{
    public const STATUSES = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'INACTIVE'];

    /** Select tables together with their current open order (if any). */
    private const SELECT = "
        SELECT t.*,
               o.id AS current_order_id, o.order_number AS current_order_number,
               o.status AS current_order_status, o.grand_total AS current_order_total,
               o.created_at AS current_order_started_at,
               (SELECT COALESCE(SUM(oi.quantity),0) FROM order_items oi WHERE oi.order_id = o.id) AS current_order_item_count
        FROM cafe_tables t
        LEFT JOIN orders o ON o.id = (
            SELECT o2.id FROM orders o2
            WHERE o2.table_id = t.id AND o2.status NOT IN ('COMPLETED','CANCELLED')
            ORDER BY o2.id DESC LIMIT 1
        )";

    public static function find(int $id): ?array
    {
        return self::cast(Database::fetch(self::SELECT . ' WHERE t.id = ?', [$id]));
    }

    public static function findForUpdate(int $id): ?array
    {
        return Database::fetch('SELECT * FROM cafe_tables WHERE id = ? FOR UPDATE', [$id]);
    }

    public static function all(array $filters = []): array
    {
        $where = ['1=1'];
        $params = [];
        if (empty($filters['include_inactive'])) {
            $where[] = 't.is_active = 1';
        }
        if (!empty($filters['status'])) {
            $where[] = 't.status = ?';
            $params[] = $filters['status'];
        }
        if (!empty($filters['section'])) {
            $where[] = 't.section = ?';
            $params[] = $filters['section'];
        }
        if (!empty($filters['search'])) {
            $where[] = '(t.name LIKE ? OR t.table_number LIKE ? OR t.section LIKE ?)';
            $like = '%' . $filters['search'] . '%';
            array_push($params, $like, $like, $like);
        }
        $rows = Database::fetchAll(
            self::SELECT . ' WHERE ' . implode(' AND ', $where) . ' ORDER BY t.is_active DESC, LPAD(t.table_number, 10, "0")',
            $params
        );
        return array_map([self::class, 'cast'], $rows);
    }

    public static function numberExists(string $number, ?int $exceptId = null): bool
    {
        return (bool) Database::value('SELECT 1 FROM cafe_tables WHERE table_number = ? AND id <> ?', [$number, $exceptId ?? 0]);
    }

    public static function create(array $d): int
    {
        return Database::insert(
            'INSERT INTO cafe_tables (table_number, name, capacity, section, status, is_active) VALUES (?, ?, ?, ?, ?, 1)',
            [$d['table_number'], $d['name'], $d['capacity'], $d['section'], $d['status'] ?? 'AVAILABLE']
        );
    }

    public static function update(int $id, array $d): void
    {
        $fields = [];
        $params = [];
        foreach (['table_number', 'name', 'capacity', 'section', 'status', 'is_active'] as $col) {
            if (array_key_exists($col, $d)) {
                $fields[] = "{$col} = ?";
                $params[] = is_bool($d[$col]) ? (int) $d[$col] : $d[$col];
            }
        }
        if ($fields) {
            $params[] = $id;
            Database::execute('UPDATE cafe_tables SET ' . implode(', ', $fields) . ' WHERE id = ?', $params);
        }
    }

    public static function setStatus(int $id, string $status): void
    {
        Database::execute('UPDATE cafe_tables SET status = ? WHERE id = ?', [$status, $id]);
    }

    public static function hasOrders(int $id): bool
    {
        return (bool) Database::value('SELECT 1 FROM orders WHERE table_id = ? LIMIT 1', [$id]);
    }

    public static function openOrderId(int $tableId, ?int $exceptOrderId = null): ?int
    {
        $id = Database::value(
            "SELECT id FROM orders WHERE table_id = ? AND status NOT IN ('COMPLETED','CANCELLED') AND id <> ? ORDER BY id DESC LIMIT 1",
            [$tableId, $exceptOrderId ?? 0]
        );
        return $id === null ? null : (int) $id;
    }

    public static function delete(int $id): void
    {
        Database::execute('DELETE FROM cafe_tables WHERE id = ?', [$id]);
    }

    public static function cast(?array $row): ?array
    {
        return cast_row(
            $row,
            ['id', 'capacity', 'current_order_id', 'current_order_item_count'],
            ['current_order_total'],
            ['is_active']
        );
    }
}

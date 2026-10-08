<?php
declare(strict_types=1);

final class Order
{
    public const STATUSES = ['DRAFT', 'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED'];
    public const OPEN_STATUSES = ['DRAFT', 'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED'];
    public const KITCHEN_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED'];

    private const SELECT = '
        SELECT o.*, t.table_number, t.name AS table_name,
               cu.name AS created_by_name, co.name AS completed_by_name,
               ca.name AS cancelled_by_name, du.name AS discount_applied_by_name
        FROM orders o
        JOIN cafe_tables t ON t.id = o.table_id
        JOIN users cu ON cu.id = o.created_by
        LEFT JOIN users co ON co.id = o.completed_by
        LEFT JOIN users ca ON ca.id = o.cancelled_by
        LEFT JOIN users du ON du.id = o.discount_applied_by';

    public static function find(int $id): ?array
    {
        return self::cast(Database::fetch(self::SELECT . ' WHERE o.id = ?', [$id]));
    }

    /** Row-lock the order for the rest of the current transaction. */
    public static function findForUpdate(int $id): ?array
    {
        return Database::fetch('SELECT * FROM orders WHERE id = ? FOR UPDATE', [$id]);
    }

    public static function paginate(array $f, int $page, int $perPage, int $offset): array
    {
        $where = ['1=1'];
        $params = [];
        if (!empty($f['status'])) {
            $statuses = array_values(array_intersect(explode(',', (string) $f['status']), self::STATUSES));
            if ($statuses) {
                $where[] = 'o.status IN (' . implode(',', array_fill(0, count($statuses), '?')) . ')';
                array_push($params, ...$statuses);
            }
        }
        if (!empty($f['open'])) {
            $where[] = "o.status NOT IN ('COMPLETED','CANCELLED')";
        }
        if (!empty($f['table_id'])) {
            $where[] = 'o.table_id = ?';
            $params[] = (int) $f['table_id'];
        }
        if (!empty($f['created_by'])) {
            $where[] = 'o.created_by = ?';
            $params[] = (int) $f['created_by'];
        }
        if (!empty($f['payment_method'])) {
            $where[] = 'p.method = ?';
            $params[] = $f['payment_method'];
        }
        if (!empty($f['search'])) {
            $where[] = '(o.order_number LIKE ? OR t.name LIKE ? OR cu.name LIKE ?)';
            $like = '%' . $f['search'] . '%';
            array_push($params, $like, $like, $like);
        }
        if (!empty($f['from'])) {
            $where[] = 'o.created_at >= ?';
            $params[] = $f['from'] . ' 00:00:00';
        }
        if (!empty($f['to'])) {
            $where[] = 'o.created_at <= ?';
            $params[] = $f['to'] . ' 23:59:59';
        }
        $w = implode(' AND ', $where);
        $from = 'FROM orders o
                 JOIN cafe_tables t ON t.id = o.table_id
                 JOIN users cu ON cu.id = o.created_by
                 LEFT JOIN payments p ON p.order_id = o.id';
        $total = (int) Database::value("SELECT COUNT(*) {$from} WHERE {$w}", $params);
        $rows = Database::fetchAll(
            "SELECT o.id, o.order_number, o.table_id, t.table_number, t.name AS table_name, o.status, o.payment_status,
                    o.subtotal, o.discount_amount, o.tax_amount, o.service_charge_amount, o.grand_total,
                    o.created_by, cu.name AS created_by_name, o.created_at, o.completed_at, o.cancelled_at,
                    p.method AS payment_method,
                    (SELECT COALESCE(SUM(oi.quantity),0) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
             {$from} WHERE {$w} ORDER BY o.id DESC LIMIT {$perPage} OFFSET {$offset}",
            $params
        );
        return paginated(array_map([self::class, 'cast'], $rows), $total, $page, $perPage);
    }

    /** Daily sequence → ORD-YYYYMMDD-001. Must be called inside a transaction. */
    public static function nextOrderNumber(): string
    {
        $today = date('Y-m-d');
        Database::execute(
            'INSERT INTO order_sequences (seq_date, last_number) VALUES (?, 1)
             ON DUPLICATE KEY UPDATE last_number = last_number + 1',
            [$today]
        );
        $n = (int) Database::value('SELECT last_number FROM order_sequences WHERE seq_date = ?', [$today]);
        return sprintf('ORD-%s-%03d', date('Ymd'), $n);
    }

    public static function create(array $d): int
    {
        return Database::insert(
            'INSERT INTO orders (order_number, table_id, status, notes, created_by, sent_at) VALUES (?, ?, ?, ?, ?, ?)',
            [$d['order_number'], $d['table_id'], $d['status'], $d['notes'] ?? null, $d['created_by'], $d['sent_at'] ?? null]
        );
    }

    public static function update(int $id, array $d): void
    {
        $fields = [];
        $params = [];
        foreach ($d as $col => $val) {
            $fields[] = "{$col} = ?";
            $params[] = $val;
        }
        if ($fields) {
            $params[] = $id;
            Database::execute('UPDATE orders SET ' . implode(', ', $fields) . ' WHERE id = ?', $params);
        }
    }

    public static function cast(?array $row): ?array
    {
        return cast_row(
            $row,
            ['id', 'table_id', 'created_by', 'completed_by', 'cancelled_by', 'discount_applied_by', 'item_count'],
            ['subtotal', 'discount_value', 'discount_amount', 'tax_rate', 'tax_amount', 'service_charge_rate', 'service_charge_amount', 'grand_total']
        );
    }
}

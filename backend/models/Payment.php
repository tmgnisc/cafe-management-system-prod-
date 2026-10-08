<?php
declare(strict_types=1);

final class Payment
{
    public const METHODS = ['CASH', 'CARD', 'ESEWA', 'KHALTI', 'BANK_TRANSFER', 'OTHER'];

    public static function forOrder(int $orderId): ?array
    {
        return self::cast(Database::fetch(
            'SELECT p.*, u.name AS received_by_name FROM payments p JOIN users u ON u.id = p.received_by WHERE p.order_id = ?',
            [$orderId]
        ));
    }

    public static function existsForOrder(int $orderId): bool
    {
        return (bool) Database::value('SELECT 1 FROM payments WHERE order_id = ? FOR UPDATE', [$orderId]);
    }

    public static function create(array $d): int
    {
        return Database::insert(
            'INSERT INTO payments (order_id, amount, tendered_amount, change_amount, method, status, reference, received_by, paid_at)
             VALUES (?, ?, ?, ?, ?, \'PAID\', ?, ?, NOW())',
            [$d['order_id'], $d['amount'], $d['tendered_amount'], $d['change_amount'], $d['method'], $d['reference'] ?? null, $d['received_by']]
        );
    }

    public static function cast(?array $row): ?array
    {
        return cast_row($row, ['id', 'order_id', 'received_by'], ['amount', 'tendered_amount', 'change_amount']);
    }
}

<?php
declare(strict_types=1);

/**
 * Order lines. item_name_snapshot / unit_price / cost_price_snapshot are captured
 * when the line is created and never re-read from menu_items afterwards.
 */
final class OrderItem
{
    public static function forOrder(int $orderId): array
    {
        return cast_rows(
            Database::fetchAll(
                'SELECT id, order_id, menu_item_id, item_name_snapshot, category_snapshot, unit_price, quantity,
                        line_total, notes, sent_at, created_at
                 FROM order_items WHERE order_id = ? ORDER BY id',
                [$orderId]
            ),
            ['id', 'order_id', 'menu_item_id', 'quantity'],
            ['unit_price', 'line_total']
        );
    }

    public static function create(int $orderId, array $menuItem, int $quantity, ?string $notes, ?string $sentAt): int
    {
        $price = to_paisa($menuItem['selling_price']);
        return Database::insert(
            'INSERT INTO order_items
                (order_id, menu_item_id, item_name_snapshot, category_snapshot, unit_price, cost_price_snapshot, quantity, line_total, notes, sent_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $orderId, $menuItem['id'], $menuItem['name'], $menuItem['category_name'] ?? null,
                from_paisa($price), $menuItem['cost_price'] ?? 0, $quantity, from_paisa($price * $quantity), $notes, $sentAt,
            ]
        );
    }

    /** Quantity / note change keeps the snapshotted unit price. */
    public static function updateLine(int $id, int $quantity, ?string $notes): void
    {
        Database::execute(
            'UPDATE order_items SET quantity = ?, notes = ?, line_total = ROUND(unit_price * ?, 2) WHERE id = ?',
            [$quantity, $notes, $quantity, $id]
        );
    }

    public static function delete(int $id): void
    {
        Database::execute('DELETE FROM order_items WHERE id = ?', [$id]);
    }

    public static function markSent(int $orderId): int
    {
        return Database::execute('UPDATE order_items SET sent_at = NOW() WHERE order_id = ? AND sent_at IS NULL', [$orderId]);
    }
}

<?php
declare(strict_types=1);

/**
 * Every change to inventory_items.current_quantity goes through this service and
 * produces a stock_movements row inside the same transaction.
 */
final class InventoryService
{
    /** Unit families for conversion: base unit factor. */
    private const CONVERSIONS = [
        'g' => ['mass', 1], 'kg' => ['mass', 1000],
        'ml' => ['volume', 1], 'liter' => ['volume', 1000],
    ];

    public static function unitsCompatible(string $from, string $to): bool
    {
        if ($from === $to) {
            return true;
        }
        return isset(self::CONVERSIONS[$from], self::CONVERSIONS[$to])
            && self::CONVERSIONS[$from][0] === self::CONVERSIONS[$to][0];
    }

    /** Convert a quantity between compatible units (e.g. 18 g → 0.018 kg). */
    public static function convert(float $qty, string $from, string $to): float
    {
        if ($from === $to) {
            return $qty;
        }
        if (!self::unitsCompatible($from, $to)) {
            throw HttpException::validation(['unit' => ["Cannot convert {$from} to {$to}."]]);
        }
        return $qty * self::CONVERSIONS[$from][1] / self::CONVERSIONS[$to][1];
    }

    public static function create(array $user, array $data): int
    {
        return Database::transaction(function () use ($user, $data) {
            $initial = round((float) ($data['current_quantity'] ?? 0), 3);
            $id = InventoryItem::create(array_merge($data, ['current_quantity' => $initial]));
            if ($initial != 0.0) {
                StockMovement::create([
                    'inventory_item_id' => $id,
                    'type'              => 'INITIAL_STOCK',
                    'quantity'          => $initial,
                    'previous_quantity' => 0,
                    'new_quantity'      => $initial,
                    'reference_type'    => 'INVENTORY',
                    'reason'            => 'Opening stock',
                    'created_by'        => $user['id'],
                ]);
            }
            AuditLog::record($user['id'], 'INVENTORY_CREATED', "Created inventory item {$data['name']} ({$initial} {$data['unit']})", 'inventory_item', $id, null, $data);
            return $id;
        });
    }

    /**
     * Manual stock change.
     *   PURCHASE / RETURN : +quantity
     *   WASTE             : -quantity
     *   ADJUSTMENT        : signed quantity (+/-)
     */
    public static function adjust(array $user, int $itemId, string $type, float $quantity, ?string $reason): array
    {
        return Database::transaction(function () use ($user, $itemId, $type, $quantity, $reason) {
            $item = InventoryItem::findForUpdate($itemId);
            if (!$item) {
                throw HttpException::notFound('Inventory item not found');
            }
            $delta = match ($type) {
                'PURCHASE', 'RETURN' => abs($quantity),
                'WASTE'              => -abs($quantity),
                'ADJUSTMENT'         => $quantity,
                default              => throw HttpException::validation(['type' => ['Invalid movement type.']]),
            };
            if (abs($delta) < 0.0005) {
                throw HttpException::validation(['quantity' => ['The quantity must not be zero.']]);
            }
            $previous = (float) $item['current_quantity'];
            $new = round($previous + $delta, 3);
            if ($new < 0) {
                throw HttpException::validation(['quantity' => [sprintf('Stock cannot go below zero (current: %s %s).', rtrim(rtrim(number_format($previous, 3, '.', ''), '0'), '.'), $item['unit'])]]);
            }

            InventoryItem::setQuantity($itemId, $new);
            $movementId = StockMovement::create([
                'inventory_item_id' => $itemId,
                'type'              => $type,
                'quantity'          => $delta,
                'previous_quantity' => $previous,
                'new_quantity'      => $new,
                'reference_type'    => 'MANUAL',
                'reason'            => $reason,
                'created_by'        => $user['id'],
            ]);
            AuditLog::record($user['id'], 'INVENTORY_ADJUSTED',
                sprintf('%s of %s%s %s on %s%s', $type, $delta > 0 ? '+' : '', rtrim(rtrim(number_format($delta, 3, '.', ''), '0'), '.'), $item['unit'], $item['name'], $reason ? " — {$reason}" : ''),
                'inventory_item', $itemId, ['current_quantity' => $previous], ['current_quantity' => $new, 'movement_id' => $movementId]);

            return ['previous_quantity' => $previous, 'new_quantity' => $new, 'movement_id' => $movementId];
        });
    }

    /**
     * Deduct recipe ingredients for a completed order. Idempotent:
     * if SALE movements already exist for the order (or the order is flagged), nothing happens.
     * MUST be called inside the payment transaction with the order row locked.
     *
     * @return array list of deductions performed
     */
    public static function deductForOrder(int $orderId, int $userId): array
    {
        if (!Database::pdo()->inTransaction()) {
            throw new LogicException('deductForOrder must run inside a transaction');
        }
        $order = Database::fetch('SELECT id, order_number, inventory_deducted_at FROM orders WHERE id = ? FOR UPDATE', [$orderId]);
        if ($order['inventory_deducted_at'] !== null || StockMovement::existsForOrder($orderId)) {
            return [];
        }

        // Required quantity per inventory item, converted into the inventory item's own unit.
        $rows = Database::fetchAll(
            'SELECT oi.quantity AS sold_qty, ri.inventory_item_id, ri.quantity AS recipe_qty, ri.unit AS recipe_unit,
                    i.unit AS inventory_unit
             FROM order_items oi
             JOIN menu_items m ON m.id = oi.menu_item_id AND m.track_inventory = 1
             JOIN recipes r ON r.menu_item_id = m.id
             JOIN recipe_items ri ON ri.recipe_id = r.id
             JOIN inventory_items i ON i.id = ri.inventory_item_id
             WHERE oi.order_id = ?',
            [$orderId]
        );
        $required = [];
        foreach ($rows as $r) {
            $qty = self::convert((float) $r['recipe_qty'], $r['recipe_unit'], $r['inventory_unit']) * (int) $r['sold_qty'];
            $id = (int) $r['inventory_item_id'];
            $required[$id] = ($required[$id] ?? 0) + $qty;
        }
        ksort($required); // consistent lock order prevents deadlocks

        $allowNegative = (bool) Setting::get('allow_negative_stock');
        $deductions = [];
        foreach ($required as $itemId => $qty) {
            $qty = round($qty, 3);
            if ($qty <= 0) {
                continue;
            }
            $item = InventoryItem::findForUpdate($itemId);
            $previous = (float) $item['current_quantity'];
            $new = round($previous - $qty, 3);
            if ($new < 0 && !$allowNegative) {
                throw HttpException::conflict("Insufficient stock of {$item['name']}: need {$qty} {$item['unit']}, have {$previous} {$item['unit']}");
            }
            InventoryItem::setQuantity($itemId, $new);
            StockMovement::create([
                'inventory_item_id' => $itemId,
                'type'              => 'SALE',
                'quantity'          => -$qty,
                'previous_quantity' => $previous,
                'new_quantity'      => $new,
                'reference_type'    => 'ORDER',
                'reference_id'      => $orderId,
                'reason'            => "Sale — order {$order['order_number']}",
                'created_by'        => $userId,
            ]);
            $deductions[] = ['inventory_item_id' => $itemId, 'name' => $item['name'], 'quantity' => $qty, 'unit' => $item['unit'], 'new_quantity' => $new];
        }

        Order::update($orderId, ['inventory_deducted_at' => date('Y-m-d H:i:s')]);
        return $deductions;
    }
}

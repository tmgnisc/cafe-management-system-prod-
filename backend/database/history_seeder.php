<?php
declare(strict_types=1);

/**
 * Generates realistic order history by driving the REAL services
 * (OrderService / PaymentService / InventoryService), then back-dating
 * the timestamps. Totals, payments, stock movements and audit logs are
 * therefore exactly what the live system would have produced.
 */
function seed_history(int $days = 21): void
{
    mt_srand(20261008);
    $admin = User::find(1);
    $staff = User::find(2);
    $tables = array_map(fn ($t) => (int) $t['id'], CafeTable::all());
    $menu = Database::fetchAll('SELECT id, selling_price, category_id FROM menu_items WHERE is_active = 1');
    // Popularity weights: coffees and momo sell more.
    $weights = [];
    foreach ($menu as $m) {
        $weights[(int) $m['id']] = in_array((int) $m['category_id'], [1, 5], true) ? 4 : ((int) $m['category_id'] === 2 ? 3 : 1);
    }
    $methods = ['CASH' => 50, 'ESEWA' => 20, 'KHALTI' => 12, 'CARD' => 15, 'BANK_TRANSFER' => 3];

    $pick = function (array $w) {
        $r = mt_rand(1, array_sum($w));
        foreach ($w as $k => $v) {
            if (($r -= $v) <= 0) {
                return $k;
            }
        }
        return array_key_first($w);
    };

    $now = new DateTimeImmutable();
    $count = 0;
    for ($d = $days; $d >= 0; $d--) {
        $day = $now->modify("-{$d} days")->setTime(0, 0);
        $isToday = $d === 0;
        $weekend = in_array((int) $day->format('w'), [5, 6], true); // Fri/Sat busier
        $orders = $isToday ? 6 : mt_rand($weekend ? 16 : 9, $weekend ? 26 : 17);

        restock_if_low($admin, $day->setTime(7, 30));

        $times = [];
        for ($i = 0; $i < $orders; $i++) {
            $times[] = $day->setTime(mt_rand(8, 20), mt_rand(0, 59), mt_rand(0, 59));
        }
        sort($times);
        $seq = 0;

        foreach ($times as $created) {
            if ($created >= $now->modify('-20 minutes')) {
                continue;
            }
            $user = mt_rand(1, 10) <= 7 ? $staff : $admin;
            $lines = [];
            $n = mt_rand(1, 4);
            for ($k = 0; $k < $n; $k++) {
                $lines[] = ['menu_item_id' => $pick($weights), 'quantity' => mt_rand(1, 10) <= 7 ? 1 : 2, 'notes' => null];
            }
            $table = $tables[array_rand($tables)];
            try {
                $order = OrderService::create($user, ['table_id' => $table, 'items' => $lines, 'send' => true]);
            } catch (HttpException $e) {
                continue; // table busy — skip
            }
            $id = $order['id'];

            if (mt_rand(1, 100) <= 12) {
                OrderService::applyDiscount($admin, $id, ['discount_type' => 'PERCENTAGE', 'discount_value' => [5, 10, 15][mt_rand(0, 2)]]);
            }
            $cancel = mt_rand(1, 100) <= 4;
            if ($cancel) {
                OrderService::cancel($user, $id, ['reason' => 'Customer left before ordering was finalised']);
            } else {
                OrderService::updateStatus($user, $id, ['status' => 'SERVED']);
                $method = $pick($methods);
                $total = Database::value('SELECT grand_total FROM orders WHERE id = ?', [$id]);
                $tendered = $method === 'CASH' ? ceil(((float) $total) / 100) * 100 : (float) $total;
                PaymentService::settle($user, $id, ['method' => $method, 'amount' => $tendered, 'reference' => $method === 'CASH' ? null : 'TXN' . mt_rand(100000, 999999)]);
            }

            // Back-date everything this order produced.
            $seq++;
            $number = sprintf('ORD-%s-%03d', $created->format('Ymd'), $seq);
            $sent = $created->modify('+1 minute')->format('Y-m-d H:i:s');
            $served = $created->modify('+' . mt_rand(10, 20) . ' minutes')->format('Y-m-d H:i:s');
            $closed = $created->modify('+' . mt_rand(25, 70) . ' minutes');
            if ($closed > $now) {
                $closed = $now->modify('-1 minute');
            }
            $closedS = $closed->format('Y-m-d H:i:s');
            $createdS = $created->format('Y-m-d H:i:s');
            Database::execute(
                'UPDATE orders SET order_number = ?, created_at = ?, updated_at = ?, sent_at = ?,
                        served_at = IF(served_at IS NULL, NULL, ?), completed_at = IF(completed_at IS NULL, NULL, ?),
                        cancelled_at = IF(cancelled_at IS NULL, NULL, ?), inventory_deducted_at = IF(inventory_deducted_at IS NULL, NULL, ?)
                 WHERE id = ?',
                [$number, $createdS, $closedS, $sent, $served, $closedS, $closedS, $closedS, $id]
            );
            Database::execute('UPDATE order_items SET created_at = ?, updated_at = ?, sent_at = ? WHERE order_id = ?', [$createdS, $createdS, $sent, $id]);
            Database::execute('UPDATE payments SET paid_at = ?, created_at = ? WHERE order_id = ?', [$closedS, $closedS, $id]);
            Database::execute("UPDATE stock_movements SET created_at = ? WHERE reference_type = 'ORDER' AND reference_id = ?", [$closedS, $id]);
            Database::execute("UPDATE audit_logs SET created_at = ? WHERE entity_type = 'order' AND entity_id = ?", [$createdS, $id]);
            Database::execute(
                "UPDATE audit_logs SET description = REPLACE(description, ?, ?), new_values = REPLACE(new_values, ?, ?)
                 WHERE entity_type = 'order' AND entity_id = ?",
                [$order['order_number'], $number, $order['order_number'], $number, $id]
            );
            Database::execute("UPDATE stock_movements SET reason = ? WHERE reference_type = 'ORDER' AND reference_id = ?", ["Sale — order {$number}", $id]);
            $count++;
        }
        // Continue the real daily sequence after the back-dated numbers.
        Database::execute(
            'INSERT INTO order_sequences (seq_date, last_number) VALUES (?, ?) ON DUPLICATE KEY UPDATE last_number = VALUES(last_number)',
            [$day->format('Y-m-d'), $seq]
        );
    }

    // Two open tables right now so the POS has something live to show.
    $open = [
        [3, [['menu_item_id' => 2, 'quantity' => 2, 'notes' => 'Less sugar'], ['menu_item_id' => 11, 'quantity' => 1, 'notes' => null]]],
        [5, [['menu_item_id' => 14, 'quantity' => 2, 'notes' => 'Extra achar'], ['menu_item_id' => 6, 'quantity' => 2, 'notes' => null], ['menu_item_id' => 13, 'quantity' => 1, 'notes' => null]]],
    ];
    foreach ($open as [$tableId, $items]) {
        try {
            OrderService::create($staff, ['table_id' => $tableId, 'items' => $items, 'send' => true]);
        } catch (HttpException $e) {
        }
    }
    echo "  ✓ generated {$count} historical orders\n";
}

/** Receive a supplier delivery when an ingredient drops near its minimum. */
function restock_if_low(array $admin, DateTimeImmutable $at): void
{
    $items = Database::fetchAll('SELECT * FROM inventory_items WHERE is_active = 1 AND current_quantity < minimum_quantity * 2');
    foreach ($items as $i) {
        $target = (float) $i['minimum_quantity'] * 5;
        $qty = round($target - (float) $i['current_quantity'], 3);
        if ($qty <= 0) {
            continue;
        }
        $r = InventoryService::adjust($admin, (int) $i['id'], 'PURCHASE', $qty, 'Supplier delivery — ' . ($i['supplier'] ?: 'local market'));
        $ts = $at->format('Y-m-d H:i:s');
        Database::execute('UPDATE stock_movements SET created_at = ? WHERE id = ?', [$ts, $r['movement_id']]);
        Database::execute("UPDATE audit_logs SET created_at = ? WHERE action = 'INVENTORY_ADJUSTED' AND entity_id = ? ORDER BY id DESC LIMIT 1", [$ts, $i['id']]);
    }
}

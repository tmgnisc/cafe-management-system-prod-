<?php
declare(strict_types=1);

/**
 * Order lifecycle: create → (update items) → send → kitchen statuses → discount → payment (PaymentService) / cancel.
 */
final class OrderService
{
    public static function create(array $user, array $input): array
    {
        $data = Validator::validate($input, [
            'table_id' => 'required|integer',
            'notes'    => 'nullable|string|max:500',
            'items'    => 'required|array|min:1|max:100',
            'send'     => 'sometimes|boolean',
        ]);
        $lines = self::validateLines($data['items']);
        $send = $data['send'] ?? true;

        $orderId = Database::transaction(function () use ($user, $data, $lines, $send) {
            $table = CafeTable::findForUpdate($data['table_id']);
            if (!$table) {
                throw HttpException::validation(['table_id' => ['The selected table does not exist.']]);
            }
            if (!$table['is_active'] || $table['status'] === 'INACTIVE') {
                throw HttpException::validation(['table_id' => ['This table is inactive.']]);
            }
            $openId = CafeTable::openOrderId((int) $table['id']);
            if ($openId !== null) {
                throw HttpException::conflict("{$table['name']} already has an open order", ['order_id' => $openId]);
            }

            $menu = self::loadSellableMenuItems($lines);
            $now = date('Y-m-d H:i:s');
            $number = Order::nextOrderNumber();
            $orderId = Order::create([
                'order_number' => $number,
                'table_id'     => (int) $table['id'],
                'status'       => $send ? 'PENDING' : 'DRAFT',
                'notes'        => $data['notes'] ?? null,
                'created_by'   => $user['id'],
                'sent_at'      => $send ? $now : null,
            ]);
            foreach ($lines as $l) {
                OrderItem::create($orderId, $menu[$l['menu_item_id']], $l['quantity'], $l['notes'], $send ? $now : null);
            }
            $bill = BillingService::recalculate($orderId);
            CafeTable::setStatus((int) $table['id'], 'OCCUPIED');

            AuditLog::record($user['id'], 'ORDER_CREATED', "Created order {$number} for {$table['name']}", 'order', $orderId, null, [
                'table'       => $table['name'],
                'status'      => $send ? 'PENDING' : 'DRAFT',
                'items'       => array_map(fn ($l) => ['item' => $menu[$l['menu_item_id']]['name'], 'qty' => $l['quantity']], $lines),
                'grand_total' => $bill['grand_total'],
            ]);
            return $orderId;
        });

        return self::detail($orderId);
    }

    /**
     * Replace the order's line list. Lines with an `id` are kept (quantity/notes may change,
     * price never changes); lines without an `id` are added at the CURRENT menu price;
     * existing lines missing from the payload are removed.
     */
    public static function update(array $user, int $orderId, array $input): array
    {
        $data = Validator::validate($input, [
            'notes' => 'sometimes|nullable|string|max:500',
            'items' => 'sometimes|required|array|min:1|max:100',
        ]);
        if (!array_key_exists('items', $data) && !array_key_exists('notes', $data)) {
            throw HttpException::validation(['items' => ['Nothing to update.']]);
        }

        Database::transaction(function () use ($user, $orderId, $data) {
            $order = self::lockEditable($orderId);
            $changes = ['added' => [], 'removed' => [], 'changed' => []];

            if (array_key_exists('items', $data)) {
                $lines = self::validateLines($data['items'], true);
                $existing = [];
                foreach (OrderItem::forOrder($orderId) as $row) {
                    $existing[$row['id']] = $row;
                }

                $keep = [];
                $new = [];
                foreach ($lines as $i => $l) {
                    if ($l['id'] !== null) {
                        if (!isset($existing[$l['id']])) {
                            throw HttpException::validation(["items.{$i}.id" => ['This line does not belong to the order.']]);
                        }
                        $keep[$l['id']] = $l;
                    } else {
                        $new[$i] = $l;
                    }
                }

                foreach ($existing as $id => $row) {
                    if (!isset($keep[$id])) {
                        OrderItem::delete($id);
                        $changes['removed'][] = ['item' => $row['item_name_snapshot'], 'qty' => $row['quantity']];
                    } elseif ($keep[$id]['quantity'] !== $row['quantity'] || $keep[$id]['notes'] !== $row['notes']) {
                        OrderItem::updateLine($id, $keep[$id]['quantity'], $keep[$id]['notes']);
                        $changes['changed'][] = ['item' => $row['item_name_snapshot'], 'from' => $row['quantity'], 'to' => $keep[$id]['quantity']];
                    }
                }

                if ($new) {
                    $menu = self::loadSellableMenuItems($new);
                    foreach ($new as $l) {
                        OrderItem::create($orderId, $menu[$l['menu_item_id']], $l['quantity'], $l['notes'], null);
                        $changes['added'][] = ['item' => $menu[$l['menu_item_id']]['name'], 'qty' => $l['quantity']];
                    }
                }
            }

            if (array_key_exists('notes', $data)) {
                Order::update($orderId, ['notes' => $data['notes']]);
            }

            BillingService::recalculate($orderId);
            self::revalidateDiscount($orderId);

            $changes = array_filter($changes);
            if ($changes) {
                AuditLog::record($user['id'], 'ORDER_UPDATED', "Updated items on order {$order['order_number']}", 'order', $orderId, null, $changes);
            }
        });

        return self::detail($orderId);
    }

    /** Send new (unsent) lines to the kitchen. DRAFT → PENDING. */
    public static function send(array $user, int $orderId): array
    {
        Database::transaction(function () use ($user, $orderId) {
            $order = self::lockEditable($orderId);
            $sent = OrderItem::markSent($orderId);
            if ($sent === 0 && $order['status'] !== 'DRAFT') {
                throw HttpException::validation(['items' => ['There are no new items to send.']]);
            }
            $update = [];
            if (in_array($order['status'], ['DRAFT', 'READY', 'SERVED'], true)) {
                $update['status'] = 'PENDING';
            }
            if ($order['sent_at'] === null) {
                $update['sent_at'] = date('Y-m-d H:i:s');
            }
            Order::update($orderId, $update);
            AuditLog::record($user['id'], 'ORDER_SENT', "Sent {$sent} new line(s) of order {$order['order_number']} to the kitchen", 'order', $orderId);
        });
        return self::detail($orderId);
    }

    public static function updateStatus(array $user, int $orderId, array $input): array
    {
        $data = Validator::validate($input, ['status' => 'required|in:' . implode(',', Order::KITCHEN_STATUSES)]);
        Database::transaction(function () use ($user, $orderId, $data) {
            $order = self::lockEditable($orderId);
            if ($order['status'] === 'DRAFT') {
                throw HttpException::conflict('Send the order before changing its status');
            }
            if ($order['status'] === $data['status']) {
                return;
            }
            $update = ['status' => $data['status']];
            if ($data['status'] === 'SERVED') {
                $update['served_at'] = date('Y-m-d H:i:s');
            }
            Order::update($orderId, $update);
            AuditLog::record($user['id'], 'ORDER_STATUS_CHANGED', "Order {$order['order_number']}: {$order['status']} → {$data['status']}", 'order', $orderId, ['status' => $order['status']], ['status' => $data['status']]);
        });
        return self::detail($orderId);
    }

    public static function applyDiscount(array $user, int $orderId, array $input): array
    {
        $data = Validator::validate($input, [
            'discount_type'  => 'nullable|in:PERCENTAGE,FIXED',
            'discount_value' => 'nullable|numeric|min:0',
        ]);

        Database::transaction(function () use ($user, $orderId, $data) {
            $order = self::lockEditable($orderId);
            BillingService::recalculate($orderId);
            $subtotal = to_paisa(Database::value('SELECT subtotal FROM orders WHERE id = ?', [$orderId]));

            if (empty($data['discount_type'])) {
                Order::update($orderId, ['discount_type' => null, 'discount_value' => 0, 'discount_applied_by' => null]);
                BillingService::recalculate($orderId);
                if ($order['discount_type'] !== null) {
                    AuditLog::record($user['id'], 'DISCOUNT_REMOVED', "Removed discount from order {$order['order_number']}", 'order', $orderId,
                        ['discount_type' => $order['discount_type'], 'discount_value' => (float) $order['discount_value']]);
                }
                return;
            }
            if (!isset($data['discount_value'])) {
                throw HttpException::validation(['discount_value' => ['The discount value is required.']]);
            }
            if ($subtotal <= 0) {
                throw HttpException::validation(['discount_value' => ['Add items before applying a discount.']]);
            }

            BillingService::assertDiscountAllowed($user, $subtotal, $data['discount_type'], (float) $data['discount_value']);
            Order::update($orderId, [
                'discount_type'       => $data['discount_type'],
                'discount_value'      => round((float) $data['discount_value'], 2),
                'discount_applied_by' => $user['id'],
            ]);
            $bill = BillingService::recalculate($orderId);

            $label = $data['discount_type'] === 'PERCENTAGE' ? "{$data['discount_value']}%" : 'Rs. ' . number_format((float) $data['discount_value'], 2);
            AuditLog::record($user['id'], 'DISCOUNT_APPLIED', "Applied {$label} discount (Rs. " . number_format($bill['discount_amount'], 2) . ") to order {$order['order_number']}", 'order', $orderId,
                ['discount_type' => $order['discount_type'], 'discount_value' => (float) $order['discount_value'], 'discount_amount' => (float) $order['discount_amount']],
                ['discount_type' => $data['discount_type'], 'discount_value' => (float) $data['discount_value'], 'discount_amount' => $bill['discount_amount']]);
        });

        return self::detail($orderId);
    }

    public static function cancel(array $user, int $orderId, array $input): array
    {
        $data = Validator::validate($input, ['reason' => 'required|string|min:3|max:255']);

        Database::transaction(function () use ($user, $orderId, $data) {
            $order = Order::findForUpdate($orderId);
            if (!$order) {
                throw HttpException::notFound('Order not found');
            }
            if ($order['status'] === 'COMPLETED' || $order['payment_status'] === 'PAID') {
                throw HttpException::conflict('Completed orders cannot be cancelled');
            }
            if ($order['status'] === 'CANCELLED') {
                throw HttpException::conflict('This order is already cancelled');
            }
            Order::update($orderId, [
                'status'        => 'CANCELLED',
                'cancelled_by'  => $user['id'],
                'cancelled_at'  => date('Y-m-d H:i:s'),
                'cancel_reason' => $data['reason'],
            ]);
            self::releaseTable((int) $order['table_id'], $orderId, 'AVAILABLE');
            AuditLog::record($user['id'], 'ORDER_CANCELLED', "Cancelled order {$order['order_number']}: {$data['reason']}", 'order', $orderId,
                ['status' => $order['status'], 'grand_total' => (float) $order['grand_total']], ['status' => 'CANCELLED', 'reason' => $data['reason']]);
        });

        return self::detail($orderId);
    }

    /** Full order payload: header, lines, payment, stock movements and edit flags. */
    public static function detail(int $orderId): array
    {
        $order = Order::find($orderId);
        if (!$order) {
            throw HttpException::notFound('Order not found');
        }
        $order['items'] = OrderItem::forOrder($orderId);
        $order['payment'] = Payment::forOrder($orderId);
        $order['stock_movements'] = $order['status'] === 'COMPLETED' ? StockMovement::forOrder($orderId) : [];
        $order['unsent_item_count'] = count(array_filter($order['items'], fn ($i) => $i['sent_at'] === null));
        $order['is_editable'] = in_array($order['status'], Order::OPEN_STATUSES, true) && $order['payment_status'] !== 'PAID';
        return $order;
    }

    /** Lock an order row and make sure it may still be modified. */
    public static function lockEditable(int $orderId): array
    {
        $order = Order::findForUpdate($orderId);
        if (!$order) {
            throw HttpException::notFound('Order not found');
        }
        if ($order['status'] === 'COMPLETED' || $order['payment_status'] === 'PAID') {
            throw HttpException::conflict('This order is completed and can no longer be modified');
        }
        if ($order['status'] === 'CANCELLED') {
            throw HttpException::conflict('This order has been cancelled and can no longer be modified');
        }
        return $order;
    }

    /** Set the table's status unless another open order still uses it. */
    public static function releaseTable(int $tableId, int $exceptOrderId, string $status): void
    {
        CafeTable::findForUpdate($tableId);
        if (CafeTable::openOrderId($tableId, $exceptOrderId) === null) {
            CafeTable::setStatus($tableId, $status);
        }
    }

    /** @return array<int, array{id:?int, menu_item_id:int, quantity:int, notes:?string}> */
    private static function validateLines(array $items, bool $allowIds = false): array
    {
        $lines = [];
        foreach (array_values($items) as $i => $item) {
            if (!is_array($item)) {
                throw HttpException::validation(["items.{$i}" => ['Each item must be an object.']]);
            }
            $rules = [
                'menu_item_id' => 'required|integer',
                'quantity'     => 'required|integer|min:1|max:999',
                'notes'        => 'nullable|string|max:255',
            ];
            if ($allowIds) {
                $rules['id'] = 'nullable|integer';
            }
            $v = Validator::validate($item, $rules, "items.{$i}.");
            $lines[$i] = [
                'id'           => $v['id'] ?? null,
                'menu_item_id' => $v['menu_item_id'],
                'quantity'     => $v['quantity'],
                'notes'        => ($v['notes'] ?? '') !== '' ? $v['notes'] : null,
            ];
        }
        return $lines;
    }

    /** Load and verify menu items for NEW order lines (must exist and be sellable). */
    private static function loadSellableMenuItems(array $lines): array
    {
        $menu = MenuItem::findMany(array_unique(array_column($lines, 'menu_item_id')));
        $errors = [];
        foreach ($lines as $i => $l) {
            $m = $menu[$l['menu_item_id']] ?? null;
            if (!$m || !$m['is_active']) {
                $errors["items.{$i}.menu_item_id"] = ['This menu item does not exist.'];
            } elseif (!$m['is_available'] || !$m['category_active']) {
                $errors["items.{$i}.menu_item_id"] = ["{$m['name']} is currently unavailable."];
            }
        }
        if ($errors) {
            throw HttpException::validation($errors);
        }
        return $menu;
    }

    /**
     * After lines change, a FIXED discount may now exceed the subtotal or the staff limit.
     * Re-check against the role of whoever applied it.
     */
    private static function revalidateDiscount(int $orderId): void
    {
        $o = Database::fetch('SELECT discount_type, discount_value, discount_applied_by, subtotal FROM orders WHERE id = ?', [$orderId]);
        if ($o['discount_type'] === null) {
            return;
        }
        $applier = $o['discount_applied_by'] ? User::find((int) $o['discount_applied_by']) : null;
        try {
            BillingService::assertDiscountAllowed($applier ?? ['role' => 'STAFF'], to_paisa($o['subtotal']), $o['discount_type'], (float) $o['discount_value']);
        } catch (HttpException $e) {
            throw HttpException::validation(['discount_value' => ['The existing discount is no longer valid for the new subtotal. Remove or adjust the discount first.']]);
        }
    }
}

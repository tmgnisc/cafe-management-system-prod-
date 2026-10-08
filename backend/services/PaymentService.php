<?php
declare(strict_types=1);

/**
 * Settles an order in ONE database transaction:
 *
 *   1. lock the order row (SELECT … FOR UPDATE)
 *   2. reject if already completed / paid / cancelled
 *   3. recalculate the final amount (server is authoritative)
 *   4. validate the tendered amount
 *   5. insert the payment (UNIQUE(order_id) is a second duplicate guard)
 *   6. deduct recipe inventory + create SALE stock movements (idempotent)
 *   7. mark the order COMPLETED / PAID
 *   8. release the table
 *   9. write the audit log
 *  → COMMIT, or ROLLBACK on any failure.
 */
final class PaymentService
{
    public static function settle(array $user, int $orderId, array $input): array
    {
        $data = Validator::validate($input, [
            'method'         => 'required|in:' . implode(',', Payment::METHODS),
            'amount'         => 'nullable|numeric|min:0',
            'reference'      => 'nullable|string|max:100',
            'expected_total' => 'nullable|numeric|min:0',
        ]);

        $result = Database::transaction(function () use ($user, $orderId, $data) {
            $order = Order::findForUpdate($orderId);
            if (!$order) {
                throw HttpException::notFound('Order not found');
            }
            if ($order['status'] === 'COMPLETED' || $order['payment_status'] === 'PAID' || Payment::existsForOrder($orderId)) {
                throw HttpException::conflict('This order has already been paid');
            }
            if ($order['status'] === 'CANCELLED') {
                throw HttpException::conflict('A cancelled order cannot be paid');
            }
            $lineCount = (int) Database::value('SELECT COUNT(*) FROM order_items WHERE order_id = ?', [$orderId]);
            if ($lineCount === 0) {
                throw HttpException::validation(['order' => ['The order has no items.']]);
            }

            $bill = BillingService::recalculate($orderId);
            $total = to_paisa($bill['grand_total']);

            if (isset($data['expected_total']) && to_paisa($data['expected_total']) !== $total) {
                throw HttpException::conflict('The bill total has changed. Please review the bill and try again', ['grand_total' => $bill['grand_total']]);
            }

            $tendered = isset($data['amount']) ? to_paisa($data['amount']) : $total;
            if ($data['method'] === 'CASH') {
                if ($tendered < $total) {
                    throw HttpException::validation(['amount' => [sprintf('Cash received (Rs. %s) is less than the bill total (Rs. %s).', number_format(from_paisa($tendered), 2), number_format(from_paisa($total), 2))]]);
                }
            } elseif ($tendered !== $total) {
                throw HttpException::validation(['amount' => [sprintf('%s payments must equal the bill total of Rs. %s.', $data['method'], number_format(from_paisa($total), 2))]]);
            }

            $paymentId = Payment::create([
                'order_id'        => $orderId,
                'amount'          => from_paisa($total),
                'tendered_amount' => from_paisa($tendered),
                'change_amount'   => from_paisa($tendered - $total),
                'method'          => $data['method'],
                'reference'       => $data['reference'] ?? null,
                'received_by'     => $user['id'],
            ]);

            $deductions = InventoryService::deductForOrder($orderId, (int) $user['id']);

            $now = date('Y-m-d H:i:s');
            Order::update($orderId, [
                'status'         => 'COMPLETED',
                'payment_status' => 'PAID',
                'completed_by'   => $user['id'],
                'completed_at'   => $now,
                'served_at'      => $order['served_at'] ?? $now,
            ]);

            $afterStatus = Setting::get('table_status_after_payment') === 'CLEANING' ? 'CLEANING' : 'AVAILABLE';
            OrderService::releaseTable((int) $order['table_id'], $orderId, $afterStatus);

            AuditLog::record($user['id'], 'PAYMENT_COMPLETED',
                sprintf('Received Rs. %s by %s for order %s', number_format(from_paisa($total), 2), $data['method'], $order['order_number']),
                'order', $orderId, null, [
                    'payment_id'  => $paymentId,
                    'method'      => $data['method'],
                    'amount'      => from_paisa($total),
                    'tendered'    => from_paisa($tendered),
                    'change'      => from_paisa($tendered - $total),
                    'deductions'  => $deductions,
                ]);

            return ['change' => from_paisa($tendered - $total)];
        });

        $order = OrderService::detail($orderId);
        $order['change_amount'] = $result['change'];
        return $order;
    }
}

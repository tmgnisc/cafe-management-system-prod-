<?php
declare(strict_types=1);

final class PaymentController
{
    /**
     * POST /api/orders/{id}/payment   (alias: POST /api/orders/{id}/complete)
     * { method, amount?, reference?, expected_total? }
     * Records the payment, deducts inventory and completes the order atomically.
     */
    public function store(Request $request, int $id): void
    {
        $order = PaymentService::settle($request->user, $id, $request->body);
        Response::success($order, 'Payment completed successfully');
    }

    /** GET /api/orders/{id}/payment */
    public function show(Request $request, int $id): void
    {
        $payment = Payment::forOrder($id);
        if (!$payment) {
            throw HttpException::notFound('No payment recorded for this order');
        }
        Response::success($payment);
    }
}

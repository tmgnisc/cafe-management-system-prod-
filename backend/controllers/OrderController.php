<?php
declare(strict_types=1);

final class OrderController
{
    /** GET /api/orders */
    public function index(Request $request): void
    {
        [$page, $perPage, $offset] = $request->pagination();
        $filters = [
            'status'         => $request->query('status'),
            'open'           => filter_var($request->query('open'), FILTER_VALIDATE_BOOLEAN),
            'table_id'       => $request->query('table_id'),
            'search'         => $request->query('search'),
            'payment_method' => $request->query('payment_method'),
            'from'           => $request->query('from'),
            'to'             => $request->query('to'),
            'created_by'     => $request->query('created_by'),
        ];
        foreach (['from', 'to'] as $k) {
            if (!empty($filters[$k])) {
                Validator::validate([$k => $filters[$k]], [$k => 'date']);
            }
        }
        Response::success(Order::paginate($filters, $page, $perPage, $offset));
    }

    /** GET /api/orders/{id} */
    public function show(Request $request, int $id): void
    {
        Response::success(OrderService::detail($id));
    }

    /** POST /api/orders */
    public function store(Request $request): void
    {
        $order = OrderService::create($request->user, $request->body);
        Response::created($order, $order['status'] === 'DRAFT' ? 'Order saved' : 'Order created and sent to the kitchen');
    }

    /** PUT /api/orders/{id} — replace lines / notes */
    public function update(Request $request, int $id): void
    {
        Response::success(OrderService::update($request->user, $id, $request->body), 'Order updated successfully');
    }

    /** POST /api/orders/{id}/send */
    public function send(Request $request, int $id): void
    {
        Response::success(OrderService::send($request->user, $id), 'Order sent to the kitchen');
    }

    /** POST /api/orders/{id}/status */
    public function status(Request $request, int $id): void
    {
        Response::success(OrderService::updateStatus($request->user, $id, $request->body), 'Order status updated');
    }

    /** POST /api/orders/{id}/discount */
    public function discount(Request $request, int $id): void
    {
        $order = OrderService::applyDiscount($request->user, $id, $request->body);
        Response::success($order, $order['discount_type'] ? 'Discount applied' : 'Discount removed');
    }

    /** POST /api/orders/{id}/cancel */
    public function cancel(Request $request, int $id): void
    {
        Response::success(OrderService::cancel($request->user, $id, $request->body), 'Order cancelled');
    }

    /** GET /api/orders/{id}/receipt — order + cafe details for printing */
    public function receipt(Request $request, int $id): void
    {
        $order = OrderService::detail($id);
        $s = Setting::all();
        Response::success([
            'order' => $order,
            'cafe'  => [
                'name'            => $s['cafe_name'],
                'address'         => $s['address'],
                'phone'           => $s['phone'],
                'email'           => $s['email'],
                'logo'            => $s['logo'],
                'pan_number'      => $s['pan_number'],
                'currency_symbol' => $s['currency_symbol'],
                'tax_label'       => $s['tax_label'],
                'receipt_footer'  => $s['receipt_footer'],
            ],
        ]);
    }
}

<?php
declare(strict_types=1);

/**
 * Sales reporting. Revenue is recognised on COMPLETED orders by completed_at.
 *   Gross sales = SUM(subtotal)        (before discount)
 *   Net sales   = gross - discount
 *   Collected   = SUM(grand_total)     (net + service charge + tax)
 */
final class ReportService
{
    public const PRESETS = ['today', 'yesterday', 'week', 'month', 'custom'];

    /** @return array{preset:string, from:string, to:string} */
    public static function resolveRange(array $q): array
    {
        $preset = in_array($q['preset'] ?? '', self::PRESETS, true) ? $q['preset'] : 'today';
        $today = new DateTimeImmutable('today');

        switch ($preset) {
            case 'yesterday':
                $from = $to = $today->modify('-1 day');
                break;
            case 'week': // Nepal week starts on Sunday
                $from = $today->modify('-' . (int) $today->format('w') . ' days');
                $to = $today;
                break;
            case 'month':
                $from = $today->modify('first day of this month');
                $to = $today;
                break;
            case 'custom':
                $v = Validator::validate($q, ['from' => 'required|date', 'to' => 'required|date']);
                $from = new DateTimeImmutable($v['from']);
                $to = new DateTimeImmutable($v['to']);
                if ($from > $to) {
                    throw HttpException::validation(['from' => ['The start date must be before the end date.']]);
                }
                if ($from->diff($to)->days > 366) {
                    throw HttpException::validation(['to' => ['The range may not exceed one year.']]);
                }
                break;
            default:
                $from = $to = $today;
        }
        return ['preset' => $preset, 'from' => $from->format('Y-m-d'), 'to' => $to->format('Y-m-d')];
    }

    private static function bounds(string $from, string $to): array
    {
        return [$from . ' 00:00:00', $to . ' 23:59:59'];
    }

    public static function summary(string $from, string $to): array
    {
        $r = Database::fetch(
            "SELECT COUNT(*) AS orders,
                    COALESCE(SUM(subtotal),0) AS gross_sales,
                    COALESCE(SUM(discount_amount),0) AS discount,
                    COALESCE(SUM(service_charge_amount),0) AS service_charge,
                    COALESCE(SUM(tax_amount),0) AS tax,
                    COALESCE(SUM(grand_total),0) AS total_collected,
                    COALESCE(SUM((SELECT SUM(oi.cost_price_snapshot * oi.quantity) FROM order_items oi WHERE oi.order_id = o.id)),0) AS cost_of_goods
             FROM orders o WHERE o.status = 'COMPLETED' AND o.completed_at BETWEEN ? AND ?",
            self::bounds($from, $to)
        );
        $cancelled = (int) Database::value(
            "SELECT COUNT(*) FROM orders WHERE status = 'CANCELLED' AND cancelled_at BETWEEN ? AND ?",
            self::bounds($from, $to)
        );
        $orders = (int) $r['orders'];
        $gross = (float) $r['gross_sales'];
        $discount = (float) $r['discount'];
        $net = round($gross - $discount, 2);
        $items = (int) Database::value(
            "SELECT COALESCE(SUM(oi.quantity),0) FROM order_items oi JOIN orders o ON o.id = oi.order_id
             WHERE o.status = 'COMPLETED' AND o.completed_at BETWEEN ? AND ?",
            self::bounds($from, $to)
        );
        return [
            'orders'              => $orders,
            'items_sold'          => $items,
            'cancelled_orders'    => $cancelled,
            'gross_sales'         => round($gross, 2),
            'discount'            => round($discount, 2),
            'net_sales'           => $net,
            'service_charge'      => round((float) $r['service_charge'], 2),
            'tax'                 => round((float) $r['tax'], 2),
            'total_collected'     => round((float) $r['total_collected'], 2),
            'cost_of_goods'       => round((float) $r['cost_of_goods'], 2),
            'gross_profit'        => round($net - (float) $r['cost_of_goods'], 2),
            'average_order_value' => $orders > 0 ? round((float) $r['total_collected'] / $orders, 2) : 0.0,
        ];
    }

    public static function paymentBreakdown(string $from, string $to): array
    {
        $rows = Database::fetchAll(
            "SELECT p.method, COUNT(*) AS count, SUM(p.amount) AS amount
             FROM payments p JOIN orders o ON o.id = p.order_id
             WHERE p.status = 'PAID' AND o.status = 'COMPLETED' AND p.paid_at BETWEEN ? AND ?
             GROUP BY p.method",
            self::bounds($from, $to)
        );
        $by = [];
        foreach ($rows as $r) {
            $by[$r['method']] = ['count' => (int) $r['count'], 'amount' => round((float) $r['amount'], 2)];
        }
        $out = [];
        foreach (Payment::METHODS as $m) {
            $out[] = ['method' => $m, 'count' => $by[$m]['count'] ?? 0, 'amount' => $by[$m]['amount'] ?? 0.0];
        }
        return $out;
    }

    public static function topItems(string $from, string $to, int $limit = 10): array
    {
        return cast_rows(Database::fetchAll(
            "SELECT oi.menu_item_id, oi.item_name_snapshot AS name, oi.category_snapshot AS category,
                    SUM(oi.quantity) AS quantity, SUM(oi.line_total) AS revenue
             FROM order_items oi JOIN orders o ON o.id = oi.order_id
             WHERE o.status = 'COMPLETED' AND o.completed_at BETWEEN ? AND ?
             GROUP BY oi.menu_item_id, oi.item_name_snapshot, oi.category_snapshot
             ORDER BY quantity DESC, revenue DESC LIMIT " . max(1, min(100, $limit)),
            self::bounds($from, $to)
        ), ['menu_item_id', 'quantity'], ['revenue']);
    }

    public static function topCategories(string $from, string $to, int $limit = 10): array
    {
        return cast_rows(Database::fetchAll(
            "SELECT COALESCE(oi.category_snapshot, 'Uncategorised') AS name,
                    SUM(oi.quantity) AS quantity, SUM(oi.line_total) AS revenue
             FROM order_items oi JOIN orders o ON o.id = oi.order_id
             WHERE o.status = 'COMPLETED' AND o.completed_at BETWEEN ? AND ?
             GROUP BY name ORDER BY revenue DESC LIMIT " . max(1, min(100, $limit)),
            self::bounds($from, $to)
        ), ['quantity'], ['revenue']);
    }

    public static function staffPerformance(string $from, string $to): array
    {
        return cast_rows(Database::fetchAll(
            "SELECT u.id AS user_id, u.name, u.role,
                    COUNT(o.id) AS orders,
                    COALESCE(SUM(o.grand_total),0) AS sales,
                    COALESCE(SUM(o.discount_amount),0) AS discounts,
                    COALESCE(AVG(o.grand_total),0) AS average_order_value
             FROM orders o JOIN users u ON u.id = o.created_by
             WHERE o.status = 'COMPLETED' AND o.completed_at BETWEEN ? AND ?
             GROUP BY u.id, u.name, u.role ORDER BY sales DESC",
            self::bounds($from, $to)
        ), ['user_id', 'orders'], ['sales', 'discounts', 'average_order_value']);
    }

    public static function tablePerformance(string $from, string $to): array
    {
        return cast_rows(Database::fetchAll(
            "SELECT t.id AS table_id, t.name, t.section, t.capacity,
                    COUNT(o.id) AS orders,
                    COALESCE(SUM(o.grand_total),0) AS sales,
                    COALESCE(AVG(o.grand_total),0) AS average_order_value,
                    COALESCE(AVG(TIMESTAMPDIFF(MINUTE, o.created_at, o.completed_at)),0) AS average_minutes
             FROM orders o JOIN cafe_tables t ON t.id = o.table_id
             WHERE o.status = 'COMPLETED' AND o.completed_at BETWEEN ? AND ?
             GROUP BY t.id, t.name, t.section, t.capacity ORDER BY sales DESC",
            self::bounds($from, $to)
        ), ['table_id', 'capacity', 'orders'], ['sales', 'average_order_value', 'average_minutes']);
    }

    /** Hourly series for a single day, daily series otherwise. Gaps are zero-filled. */
    public static function series(string $from, string $to, bool $forceDaily = false): array
    {
        if ($from === $to && !$forceDaily) {
            $rows = Database::fetchAll(
                "SELECT HOUR(completed_at) AS bucket, COUNT(*) AS orders, SUM(grand_total) AS sales
                 FROM orders WHERE status = 'COMPLETED' AND completed_at BETWEEN ? AND ? GROUP BY bucket",
                self::bounds($from, $to)
            );
            $map = array_column($rows, null, 'bucket');
            $out = [];
            for ($h = 0; $h < 24; $h++) {
                $out[] = [
                    'key'    => sprintf('%02d:00', $h),
                    'label'  => date('g A', mktime($h, 0, 0)),
                    'orders' => (int) ($map[$h]['orders'] ?? 0),
                    'sales'  => round((float) ($map[$h]['sales'] ?? 0), 2),
                ];
            }
            return ['granularity' => 'hour', 'points' => $out];
        }

        $rows = Database::fetchAll(
            "SELECT DATE(completed_at) AS bucket, COUNT(*) AS orders, SUM(grand_total) AS sales
             FROM orders WHERE status = 'COMPLETED' AND completed_at BETWEEN ? AND ? GROUP BY bucket",
            self::bounds($from, $to)
        );
        $map = array_column($rows, null, 'bucket');
        $out = [];
        $period = new DatePeriod(new DateTimeImmutable($from), new DateInterval('P1D'), (new DateTimeImmutable($to))->modify('+1 day'));
        foreach ($period as $d) {
            $k = $d->format('Y-m-d');
            $out[] = [
                'key'    => $k,
                'label'  => $d->format('M j'),
                'orders' => (int) ($map[$k]['orders'] ?? 0),
                'sales'  => round((float) ($map[$k]['sales'] ?? 0), 2),
            ];
        }
        return ['granularity' => 'day', 'points' => $out];
    }

    public static function sales(array $q): array
    {
        $range = self::resolveRange($q);
        [$from, $to] = [$range['from'], $range['to']];
        return [
            'range'              => $range,
            'summary'            => self::summary($from, $to),
            'payment_methods'    => self::paymentBreakdown($from, $to),
            'top_items'          => self::topItems($from, $to, 10),
            'top_categories'     => self::topCategories($from, $to, 10),
            'staff_performance'  => self::staffPerformance($from, $to),
            'table_performance'  => self::tablePerformance($from, $to),
            'series'             => self::series($from, $to),
        ];
    }

    public static function dashboard(): array
    {
        $today = date('Y-m-d');
        $yesterday = date('Y-m-d', strtotime('-1 day'));
        $weekStart = date('Y-m-d', strtotime('-' . date('w') . ' days'));
        $monthStart = date('Y-m-01');

        $tables = Database::fetchAll("SELECT status, COUNT(*) AS c FROM cafe_tables WHERE is_active = 1 GROUP BY status");
        $tableCounts = array_fill_keys(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING'], 0);
        foreach ($tables as $t) {
            if (isset($tableCounts[$t['status']])) {
                $tableCounts[$t['status']] = (int) $t['c'];
            }
        }
        $openOrders = Database::fetch(
            "SELECT COUNT(*) AS c, COALESCE(SUM(grand_total),0) AS v FROM orders WHERE status NOT IN ('COMPLETED','CANCELLED')"
        );

        $recent = Order::paginate([], 1, 8, 0)['items'];

        return [
            'today'           => self::summary($today, $today),
            'yesterday'       => self::summary($yesterday, $yesterday),
            'tables'          => [
                'total'     => array_sum($tableCounts),
                'available' => $tableCounts['AVAILABLE'],
                'occupied'  => $tableCounts['OCCUPIED'],
                'reserved'  => $tableCounts['RESERVED'],
                'cleaning'  => $tableCounts['CLEANING'],
            ],
            'open_orders'     => ['count' => (int) $openOrders['c'], 'value' => round((float) $openOrders['v'], 2)],
            'low_stock_count' => InventoryItem::countLowStock(),
            'low_stock_items' => InventoryItem::lowStock(8),
            'sales_today'     => self::series($today, $today),
            'sales_week'      => self::series($weekStart, $today, true),
            'sales_month'     => self::series($monthStart, $today, true),
            'month_summary'   => self::summary($monthStart, $today),
            'top_items'       => self::topItems($monthStart, $today, 5),
            'top_categories'  => self::topCategories($monthStart, $today, 7),
            'payment_methods' => self::paymentBreakdown($monthStart, $today),
            'recent_orders'   => $recent,
        ];
    }
}

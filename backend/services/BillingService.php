<?php
declare(strict_types=1);

/**
 * The single, authoritative place where bill totals are calculated.
 *
 *   subtotal
 * - discount
 * + service charge   (on subtotal - discount)
 * + tax              (on subtotal - discount [+ service charge, if tax_on_service_charge])
 * = grand total
 *
 * All arithmetic is done in integer paisa (1 Rs = 100 paisa).
 */
final class BillingService
{
    public static function calculate(
        int $subtotalPaisa,
        ?string $discountType,
        float $discountValue,
        float $taxRate,
        float $serviceChargeRate,
        bool $taxOnServiceCharge
    ): array {
        $discount = match ($discountType) {
            'PERCENTAGE' => (int) round($subtotalPaisa * $discountValue / 100),
            'FIXED'      => to_paisa($discountValue),
            default      => 0,
        };
        $discount = max(0, min($discount, $subtotalPaisa));

        $afterDiscount = $subtotalPaisa - $discount;
        $serviceCharge = (int) round($afterDiscount * $serviceChargeRate / 100);
        $taxBase = $afterDiscount + ($taxOnServiceCharge ? $serviceCharge : 0);
        $tax = (int) round($taxBase * $taxRate / 100);
        $grand = $afterDiscount + $serviceCharge + $tax;

        return [
            'subtotal'              => from_paisa($subtotalPaisa),
            'discount_amount'       => from_paisa($discount),
            'taxable_amount'        => from_paisa($taxBase),
            'service_charge_rate'   => $serviceChargeRate,
            'service_charge_amount' => from_paisa($serviceCharge),
            'tax_rate'              => $taxRate,
            'tax_amount'            => from_paisa($tax),
            'grand_total'           => from_paisa($grand),
        ];
    }

    /**
     * Validate a discount request against the subtotal and the user's permissions.
     * Returns the discount amount in paisa.
     */
    public static function assertDiscountAllowed(array $user, int $subtotalPaisa, string $type, float $value): int
    {
        if ($value <= 0) {
            throw HttpException::validation(['discount_value' => ['The discount must be greater than zero.']]);
        }
        if ($type === 'PERCENTAGE' && $value > 100) {
            throw HttpException::validation(['discount_value' => ['A percentage discount cannot exceed 100%.']]);
        }
        $amount = $type === 'PERCENTAGE' ? (int) round($subtotalPaisa * $value / 100) : to_paisa($value);
        if ($amount > $subtotalPaisa) {
            throw HttpException::validation(['discount_value' => ['The discount cannot be greater than the subtotal.']]);
        }

        if ($user['role'] !== 'SUPERADMIN') {
            $settings = Setting::all();
            if (!$settings['staff_discount_enabled']) {
                throw HttpException::forbidden('Staff are not permitted to apply discounts');
            }
            $max = (float) $settings['max_staff_discount_percent'];
            $effective = $subtotalPaisa > 0 ? $amount / $subtotalPaisa * 100 : 0;
            if ($effective - $max > 0.0001) {
                throw HttpException::forbidden(sprintf('Staff discounts are limited to %s%% of the subtotal', rtrim(rtrim(number_format($max, 2), '0'), '.')));
            }
        }
        return $amount;
    }

    /**
     * Recompute and persist an open order's totals from its lines.
     * Tax / service-charge rates are refreshed from settings while the order is open,
     * then frozen once the order is completed.
     */
    public static function recalculate(int $orderId): array
    {
        $order = Database::fetch('SELECT * FROM orders WHERE id = ?', [$orderId]);
        $subtotal = (int) Database::value(
            'SELECT COALESCE(SUM(ROUND(unit_price * 100) * quantity), 0) FROM order_items WHERE order_id = ?',
            [$orderId]
        );
        $s = Setting::all();
        $bill = self::calculate(
            $subtotal,
            $order['discount_type'],
            (float) $order['discount_value'],
            (float) $s['tax_rate'],
            (float) $s['service_charge_rate'],
            (bool) $s['tax_on_service_charge']
        );
        Order::update($orderId, [
            'subtotal'              => $bill['subtotal'],
            'discount_amount'       => $bill['discount_amount'],
            'tax_rate'              => $bill['tax_rate'],
            'tax_amount'            => $bill['tax_amount'],
            'service_charge_rate'   => $bill['service_charge_rate'],
            'service_charge_amount' => $bill['service_charge_amount'],
            'grand_total'           => $bill['grand_total'],
        ]);
        return $bill;
    }
}

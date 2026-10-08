<?php
declare(strict_types=1);

/** Key/value settings with typed accessors. */
final class Setting
{
    /** key => type (string|float|int|bool) and defaults */
    public const SCHEMA = [
        'cafe_name'                  => ['string', "Isha's Cozy Cafe"],
        'address'                    => ['string', ''],
        'phone'                      => ['string', ''],
        'email'                      => ['string', ''],
        'logo'                       => ['string', ''],
        'pan_number'                 => ['string', ''],
        'currency'                   => ['string', 'NPR'],
        'currency_symbol'            => ['string', 'Rs.'],
        'tax_label'                  => ['string', 'VAT'],
        'tax_rate'                   => ['float', 0.0],
        'service_charge_rate'        => ['float', 0.0],
        'tax_on_service_charge'      => ['bool', true],
        'staff_discount_enabled'     => ['bool', true],
        'max_staff_discount_percent' => ['float', 15.0],
        'allow_negative_stock'       => ['bool', true],
        'table_status_after_payment' => ['string', 'AVAILABLE'],
        'receipt_footer'             => ['string', 'Thank you for visiting!'],
    ];

    private static ?array $cache = null;

    public static function all(): array
    {
        if (self::$cache !== null) {
            return self::$cache;
        }
        $raw = [];
        foreach (Database::fetchAll('SELECT setting_key, setting_value FROM settings') as $r) {
            $raw[$r['setting_key']] = $r['setting_value'];
        }
        $out = [];
        foreach (self::SCHEMA as $key => [$type, $default]) {
            $v = $raw[$key] ?? null;
            $out[$key] = $v === null ? $default : match ($type) {
                'float' => (float) $v,
                'int'   => (int) $v,
                'bool'  => $v === '1' || strtolower($v) === 'true',
                default => (string) $v,
            };
        }
        return self::$cache = $out;
    }

    public static function get(string $key): mixed
    {
        return self::all()[$key] ?? null;
    }

    public static function setMany(array $values): void
    {
        Database::transaction(function () use ($values) {
            foreach ($values as $key => $value) {
                if (!array_key_exists($key, self::SCHEMA)) {
                    continue;
                }
                $stored = is_bool($value) ? ($value ? '1' : '0') : (string) $value;
                Database::execute(
                    'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
                     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
                    [$key, $stored]
                );
            }
        });
        self::$cache = null;
    }
}

<?php
declare(strict_types=1);

final class SettingsController
{
    /** GET /api/settings — readable by all authenticated users (POS needs tax/discount rules). */
    public function index(Request $request): void
    {
        Response::success(Setting::all());
    }

    /** PUT /api/settings (admin) */
    public function update(Request $request): void
    {
        $data = Validator::validate($request->body, [
            'cafe_name'                  => 'sometimes|required|string|max:100',
            'address'                    => 'sometimes|nullable|string|max:255',
            'phone'                      => 'sometimes|nullable|string|max:50',
            'email'                      => 'sometimes|nullable|email|max:150',
            'logo'                       => 'sometimes|nullable|string|max:500',
            'pan_number'                 => 'sometimes|nullable|string|max:30',
            'currency'                   => 'sometimes|required|string|max:10',
            'currency_symbol'            => 'sometimes|required|string|max:10',
            'tax_label'                  => 'sometimes|required|string|max:20',
            'tax_rate'                   => 'sometimes|required|numeric|min:0|max:100',
            'service_charge_rate'        => 'sometimes|required|numeric|min:0|max:100',
            'tax_on_service_charge'      => 'sometimes|required|boolean',
            'staff_discount_enabled'     => 'sometimes|required|boolean',
            'max_staff_discount_percent' => 'sometimes|required|numeric|min:0|max:100',
            'allow_negative_stock'       => 'sometimes|required|boolean',
            'table_status_after_payment' => 'sometimes|required|in:AVAILABLE,CLEANING',
            'receipt_footer'             => 'sometimes|nullable|string|max:255',
        ]);
        if (!empty($data['logo']) && !preg_match('#^(https?://|/uploads/)#', $data['logo'])) {
            throw HttpException::validation(['logo' => ['The logo must be an uploaded file or an http(s) URL.']]);
        }
        $before = Setting::all();
        $data = array_map(fn ($v) => $v ?? '', $data);
        Setting::setMany($data);
        $after = Setting::all();

        $changed = array_filter(array_keys($data), fn ($k) => $before[$k] !== $after[$k]);
        if ($changed) {
            AuditLog::record($request->userId(), 'SETTINGS_UPDATED', 'Updated settings: ' . implode(', ', $changed), 'settings', null,
                array_intersect_key($before, array_flip($changed)), array_intersect_key($after, array_flip($changed)));
        }
        Response::success($after, 'Settings saved successfully');
    }
}

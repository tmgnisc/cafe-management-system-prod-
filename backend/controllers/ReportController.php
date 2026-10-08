<?php
declare(strict_types=1);

/** SUPERADMIN only. */
final class ReportController
{
    /** GET /api/reports/dashboard */
    public function dashboard(Request $request): void
    {
        Response::success(ReportService::dashboard());
    }

    /** GET /api/reports/sales?preset=today|yesterday|week|month|custom&from=&to= */
    public function sales(Request $request): void
    {
        Response::success(ReportService::sales($request->query));
    }

    /** GET /api/reports/top-items?preset=…&limit=10 */
    public function topItems(Request $request): void
    {
        $range = ReportService::resolveRange($request->query);
        $limit = (int) ($request->query('limit') ?? 10);
        Response::success([
            'range' => $range,
            'items' => ReportService::topItems($range['from'], $range['to'], $limit),
        ]);
    }
}

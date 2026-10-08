<?php
declare(strict_types=1);

final class HealthController
{
    /** GET /api/health — liveness + DB connectivity (no sensitive details). */
    public function index(Request $request): void
    {
        $db = true;
        try {
            Database::value('SELECT 1');
        } catch (Throwable) {
            $db = false;
        }
        Response::json([
            'success' => $db,
            'message' => $db ? 'OK' : 'Database unavailable',
            'data'    => ['database' => $db ? 'up' : 'down', 'time' => date('c')],
        ], $db ? 200 : 503);
    }
}

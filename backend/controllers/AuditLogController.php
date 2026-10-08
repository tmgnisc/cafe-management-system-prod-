<?php
declare(strict_types=1);

/** SUPERADMIN only. */
final class AuditLogController
{
    public function index(Request $request): void
    {
        [$page, $perPage, $offset] = $request->pagination(25);
        foreach (['from', 'to'] as $k) {
            if ($request->query($k)) {
                Validator::validate([$k => $request->query($k)], [$k => 'date']);
            }
        }
        $result = AuditLog::paginate([
            'user_id'     => $request->query('user_id'),
            'action'      => $request->query('action'),
            'entity_type' => $request->query('entity_type'),
            'search'      => $request->query('search'),
            'from'        => $request->query('from'),
            'to'          => $request->query('to'),
        ], $page, $perPage, $offset);
        $result['actions'] = AuditLog::actions();
        Response::success($result);
    }
}

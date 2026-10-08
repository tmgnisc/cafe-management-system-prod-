<?php
declare(strict_types=1);

final class AuditLog
{
    /** Keys whose values are never written to the audit log. */
    private const REDACT = ['password', 'password_confirmation', 'current_password', 'new_password', 'csrf_token'];

    public static function record(
        ?int $userId,
        string $action,
        string $description,
        ?string $entityType = null,
        ?int $entityId = null,
        ?array $oldValues = null,
        ?array $newValues = null
    ): void {
        Database::insert(
            'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description, old_values, new_values, ip_address, user_agent)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $userId, $action, $entityType, $entityId, mb_substr($description, 0, 500),
                $oldValues !== null ? json_encode(self::redact($oldValues), JSON_UNESCAPED_UNICODE) : null,
                $newValues !== null ? json_encode(self::redact($newValues), JSON_UNESCAPED_UNICODE) : null,
                PHP_SAPI === 'cli' ? null : client_ip(),
                isset($_SERVER['HTTP_USER_AGENT']) ? substr($_SERVER['HTTP_USER_AGENT'], 0, 255) : null,
            ]
        );
    }

    private static function redact(array $values): array
    {
        foreach ($values as $k => $v) {
            if (in_array(strtolower((string) $k), self::REDACT, true) || str_contains(strtolower((string) $k), 'password')) {
                unset($values[$k]);
            } elseif (is_array($v)) {
                $values[$k] = self::redact($v);
            }
        }
        return $values;
    }

    public static function paginate(array $f, int $page, int $perPage, int $offset): array
    {
        $where = ['1=1'];
        $params = [];
        if (!empty($f['user_id'])) {
            $where[] = 'a.user_id = ?';
            $params[] = (int) $f['user_id'];
        }
        if (!empty($f['action'])) {
            $where[] = 'a.action = ?';
            $params[] = $f['action'];
        }
        if (!empty($f['entity_type'])) {
            $where[] = 'a.entity_type = ?';
            $params[] = $f['entity_type'];
        }
        if (!empty($f['search'])) {
            $where[] = '(a.description LIKE ? OR u.name LIKE ?)';
            $like = '%' . $f['search'] . '%';
            array_push($params, $like, $like);
        }
        if (!empty($f['from'])) {
            $where[] = 'a.created_at >= ?';
            $params[] = $f['from'] . ' 00:00:00';
        }
        if (!empty($f['to'])) {
            $where[] = 'a.created_at <= ?';
            $params[] = $f['to'] . ' 23:59:59';
        }
        $w = implode(' AND ', $where);
        $total = (int) Database::value("SELECT COUNT(*) FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id WHERE {$w}", $params);
        $rows = Database::fetchAll(
            "SELECT a.*, u.name AS user_name, u.role AS user_role
             FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
             WHERE {$w} ORDER BY a.id DESC LIMIT {$perPage} OFFSET {$offset}",
            $params
        );
        foreach ($rows as &$r) {
            $r = cast_row($r, ['id', 'user_id', 'entity_id']);
            $r['old_values'] = $r['old_values'] !== null ? json_decode($r['old_values'], true) : null;
            $r['new_values'] = $r['new_values'] !== null ? json_decode($r['new_values'], true) : null;
        }
        return paginated($rows, $total, $page, $perPage);
    }

    public static function actions(): array
    {
        return array_column(Database::fetchAll('SELECT DISTINCT action FROM audit_logs ORDER BY action'), 'action');
    }
}

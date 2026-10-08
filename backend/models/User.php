<?php
declare(strict_types=1);

final class User
{
    /** Columns safe to expose — never includes the password hash. */
    private const PUBLIC_COLUMNS = 'id, name, email, phone, role, status, last_login, created_at, updated_at';

    public static function find(int $id): ?array
    {
        return self::cast(Database::fetch('SELECT ' . self::PUBLIC_COLUMNS . ' FROM users WHERE id = ?', [$id]));
    }

    public static function findActive(int $id): ?array
    {
        return self::cast(Database::fetch('SELECT ' . self::PUBLIC_COLUMNS . " FROM users WHERE id = ? AND status = 'ACTIVE'", [$id]));
    }

    /** Includes the password hash — for authentication only. */
    public static function findByEmailWithPassword(string $email): ?array
    {
        return Database::fetch('SELECT * FROM users WHERE email = ?', [strtolower($email)]);
    }

    public static function emailExists(string $email, ?int $exceptId = null): bool
    {
        return (bool) Database::value(
            'SELECT 1 FROM users WHERE email = ? AND id <> ?',
            [strtolower($email), $exceptId ?? 0]
        );
    }

    public static function paginate(array $filters, int $page, int $perPage, int $offset): array
    {
        $where = ['1=1'];
        $params = [];
        if (!empty($filters['search'])) {
            $where[] = '(name LIKE ? OR email LIKE ? OR phone LIKE ?)';
            $like = '%' . $filters['search'] . '%';
            array_push($params, $like, $like, $like);
        }
        if (!empty($filters['role'])) {
            $where[] = 'role = ?';
            $params[] = $filters['role'];
        }
        if (!empty($filters['status'])) {
            $where[] = 'status = ?';
            $params[] = $filters['status'];
        }
        $w = implode(' AND ', $where);
        $total = (int) Database::value("SELECT COUNT(*) FROM users WHERE {$w}", $params);
        $rows = Database::fetchAll(
            'SELECT ' . self::PUBLIC_COLUMNS . " FROM users WHERE {$w} ORDER BY role, name LIMIT {$perPage} OFFSET {$offset}",
            $params
        );
        return paginated(array_map([self::class, 'cast'], $rows), $total, $page, $perPage);
    }

    public static function create(array $d): int
    {
        return Database::insert(
            'INSERT INTO users (name, email, phone, password, role, status) VALUES (?, ?, ?, ?, ?, ?)',
            [$d['name'], strtolower($d['email']), $d['phone'] ?? null, password_hash($d['password'], PASSWORD_DEFAULT), $d['role'], $d['status'] ?? 'ACTIVE']
        );
    }

    public static function update(int $id, array $d): void
    {
        $fields = [];
        $params = [];
        foreach (['name', 'email', 'phone', 'role', 'status'] as $col) {
            if (array_key_exists($col, $d)) {
                $fields[] = "{$col} = ?";
                $params[] = $col === 'email' ? strtolower($d[$col]) : $d[$col];
            }
        }
        if (!empty($d['password'])) {
            $fields[] = 'password = ?';
            $params[] = password_hash($d['password'], PASSWORD_DEFAULT);
        }
        if (!$fields) {
            return;
        }
        $params[] = $id;
        Database::execute('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?', $params);
    }

    public static function setPassword(int $id, string $password): void
    {
        Database::execute('UPDATE users SET password = ? WHERE id = ?', [password_hash($password, PASSWORD_DEFAULT), $id]);
    }

    public static function touchLogin(int $id): void
    {
        Database::execute('UPDATE users SET last_login = NOW() WHERE id = ?', [$id]);
    }

    public static function countActiveAdmins(?int $exceptId = null): int
    {
        return (int) Database::value(
            "SELECT COUNT(*) FROM users WHERE role = 'SUPERADMIN' AND status = 'ACTIVE' AND id <> ?",
            [$exceptId ?? 0]
        );
    }

    public static function hasHistory(int $id): bool
    {
        return (bool) Database::value(
            'SELECT (EXISTS(SELECT 1 FROM orders WHERE created_by = ? OR completed_by = ? OR cancelled_by = ? OR discount_applied_by = ?)
                  OR EXISTS(SELECT 1 FROM payments WHERE received_by = ?)
                  OR EXISTS(SELECT 1 FROM stock_movements WHERE created_by = ?))',
            [$id, $id, $id, $id, $id, $id]
        );
    }

    public static function delete(int $id): void
    {
        Database::execute('DELETE FROM users WHERE id = ?', [$id]);
    }

    public static function cast(?array $row): ?array
    {
        return cast_row($row, ['id']);
    }
}

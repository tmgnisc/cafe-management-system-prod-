<?php
declare(strict_types=1);

final class Category
{
    public static function all(bool $includeInactive = false, ?string $search = null): array
    {
        $where = $includeInactive ? '1=1' : 'c.is_active = 1';
        $params = [];
        if ($search) {
            $where .= ' AND c.name LIKE ?';
            $params[] = '%' . $search . '%';
        }
        $rows = Database::fetchAll(
            "SELECT c.*, (SELECT COUNT(*) FROM menu_items m WHERE m.category_id = c.id AND m.is_active = 1) AS item_count
             FROM categories c WHERE {$where} ORDER BY c.sort_order, c.name",
            $params
        );
        return array_map([self::class, 'cast'], $rows);
    }

    public static function find(int $id): ?array
    {
        return self::cast(Database::fetch(
            'SELECT c.*, (SELECT COUNT(*) FROM menu_items m WHERE m.category_id = c.id AND m.is_active = 1) AS item_count
             FROM categories c WHERE c.id = ?',
            [$id]
        ));
    }

    public static function nameExists(string $name, ?int $exceptId = null): bool
    {
        return (bool) Database::value('SELECT 1 FROM categories WHERE name = ? AND id <> ?', [$name, $exceptId ?? 0]);
    }

    public static function create(array $d): int
    {
        return Database::insert(
            'INSERT INTO categories (name, description, sort_order, is_active) VALUES (?, ?, ?, ?)',
            [$d['name'], $d['description'] ?? null, $d['sort_order'] ?? 0, (int) ($d['is_active'] ?? true)]
        );
    }

    public static function update(int $id, array $d): void
    {
        $fields = [];
        $params = [];
        foreach (['name', 'description', 'sort_order', 'is_active'] as $col) {
            if (array_key_exists($col, $d)) {
                $fields[] = "{$col} = ?";
                $params[] = is_bool($d[$col]) ? (int) $d[$col] : $d[$col];
            }
        }
        if ($fields) {
            $params[] = $id;
            Database::execute('UPDATE categories SET ' . implode(', ', $fields) . ' WHERE id = ?', $params);
        }
    }

    public static function hasMenuItems(int $id): bool
    {
        return (bool) Database::value('SELECT 1 FROM menu_items WHERE category_id = ? LIMIT 1', [$id]);
    }

    public static function delete(int $id): void
    {
        Database::execute('DELETE FROM categories WHERE id = ?', [$id]);
    }

    public static function cast(?array $row): ?array
    {
        return cast_row($row, ['id', 'sort_order', 'item_count'], [], ['is_active']);
    }
}

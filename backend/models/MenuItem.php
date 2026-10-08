<?php
declare(strict_types=1);

final class MenuItem
{
    private const SELECT = '
        SELECT m.*, c.name AS category_name,
               (SELECT COUNT(*) FROM recipes r JOIN recipe_items ri ON ri.recipe_id = r.id WHERE r.menu_item_id = m.id) AS recipe_item_count
        FROM menu_items m
        JOIN categories c ON c.id = m.category_id';

    public static function find(int $id): ?array
    {
        return self::cast(Database::fetch(self::SELECT . ' WHERE m.id = ?', [$id]));
    }

    public static function paginate(array $f, int $page, int $perPage, int $offset): array
    {
        $where = ['1=1'];
        $params = [];
        if (empty($f['include_archived'])) {
            $where[] = 'm.is_active = 1';
        }
        if (!empty($f['category_id'])) {
            $where[] = 'm.category_id = ?';
            $params[] = (int) $f['category_id'];
        }
        if (isset($f['available']) && $f['available'] !== '') {
            $where[] = 'm.is_available = ?';
            $params[] = filter_var($f['available'], FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
        }
        if (!empty($f['pos'])) {
            // POS view: only sellable items in active categories
            $where[] = 'm.is_available = 1 AND c.is_active = 1';
        }
        if (!empty($f['search'])) {
            $where[] = '(m.name LIKE ? OR m.sku LIKE ?)';
            $like = '%' . $f['search'] . '%';
            array_push($params, $like, $like);
        }
        $w = implode(' AND ', $where);
        $total = (int) Database::value("SELECT COUNT(*) FROM menu_items m JOIN categories c ON c.id = m.category_id WHERE {$w}", $params);
        $rows = Database::fetchAll(self::SELECT . " WHERE {$w} ORDER BY c.sort_order, c.name, m.name LIMIT {$perPage} OFFSET {$offset}", $params);
        return paginated(array_map([self::class, 'cast'], $rows), $total, $page, $perPage);
    }

    /** Lock and load the menu items referenced by an order (for snapshotting). */
    public static function findMany(array $ids): array
    {
        if (!$ids) {
            return [];
        }
        $ph = implode(',', array_fill(0, count($ids), '?'));
        $rows = Database::fetchAll(
            "SELECT m.*, c.name AS category_name, c.is_active AS category_active
             FROM menu_items m JOIN categories c ON c.id = m.category_id WHERE m.id IN ({$ph})",
            array_values($ids)
        );
        $map = [];
        foreach ($rows as $r) {
            $map[(int) $r['id']] = $r;
        }
        return $map;
    }

    public static function skuExists(string $sku, ?int $exceptId = null): bool
    {
        return (bool) Database::value('SELECT 1 FROM menu_items WHERE sku = ? AND id <> ?', [$sku, $exceptId ?? 0]);
    }

    public static function create(array $d): int
    {
        return Database::insert(
            'INSERT INTO menu_items (category_id, name, sku, description, image, selling_price, cost_price, is_available, track_inventory)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $d['category_id'], $d['name'], $d['sku'], $d['description'] ?? null, $d['image'] ?? null,
                $d['selling_price'], $d['cost_price'] ?? 0, (int) ($d['is_available'] ?? true), (int) ($d['track_inventory'] ?? false),
            ]
        );
    }

    public static function update(int $id, array $d): void
    {
        $fields = [];
        $params = [];
        foreach (['category_id', 'name', 'sku', 'description', 'image', 'selling_price', 'cost_price', 'is_available', 'track_inventory', 'is_active'] as $col) {
            if (array_key_exists($col, $d)) {
                $fields[] = "{$col} = ?";
                $params[] = is_bool($d[$col]) ? (int) $d[$col] : $d[$col];
            }
        }
        if ($fields) {
            $params[] = $id;
            Database::execute('UPDATE menu_items SET ' . implode(', ', $fields) . ' WHERE id = ?', $params);
        }
    }

    public static function hasOrders(int $id): bool
    {
        return (bool) Database::value('SELECT 1 FROM order_items WHERE menu_item_id = ? LIMIT 1', [$id]);
    }

    public static function delete(int $id): void
    {
        Database::execute('DELETE FROM menu_items WHERE id = ?', [$id]);
    }

    public static function cast(?array $row): ?array
    {
        return cast_row(
            $row,
            ['id', 'category_id', 'recipe_item_count'],
            ['selling_price', 'cost_price'],
            ['is_available', 'track_inventory', 'is_active']
        );
    }
}

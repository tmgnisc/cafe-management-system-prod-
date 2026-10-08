<?php
declare(strict_types=1);

final class MenuItemController
{
    /** GET /api/menu — staff see only active items; ?pos=1 limits to sellable items */
    public function index(Request $request): void
    {
        [$page, $perPage, $offset] = $request->pagination(50, 500);
        Response::success(MenuItem::paginate([
            'search'           => $request->query('search'),
            'category_id'      => $request->query('category_id'),
            'available'        => $request->query('available'),
            'pos'              => filter_var($request->query('pos'), FILTER_VALIDATE_BOOLEAN),
            'include_archived' => $request->isAdmin() && filter_var($request->query('include_archived'), FILTER_VALIDATE_BOOLEAN),
        ], $page, $perPage, $offset));
    }

    public function show(Request $request, int $id): void
    {
        $item = $this->findOrFail($id);
        $item['recipe'] = Recipe::forMenuItem($id);
        Response::success($item);
    }

    public function store(Request $request): void
    {
        $data = $this->validate($request->body);
        $this->assertCategory($data['category_id']);
        if (MenuItem::skuExists($data['sku'])) {
            throw HttpException::validation(['sku' => ['This SKU is already in use.']]);
        }
        $id = MenuItem::create($data);
        AuditLog::record($request->userId(), 'MENU_ITEM_CREATED', sprintf('Created menu item %s at Rs. %s', $data['name'], number_format($data['selling_price'], 2)), 'menu_item', $id, null, $data);
        Response::created(MenuItem::find($id), 'Menu item created successfully');
    }

    public function update(Request $request, int $id): void
    {
        $before = $this->findOrFail($id);
        $data = $this->validate($request->body, true);
        if (isset($data['category_id'])) {
            $this->assertCategory($data['category_id']);
        }
        if (isset($data['sku']) && MenuItem::skuExists($data['sku'], $id)) {
            throw HttpException::validation(['sku' => ['This SKU is already in use.']]);
        }
        MenuItem::update($id, $data);
        $after = MenuItem::find($id);

        if (isset($data['selling_price']) && abs($data['selling_price'] - $before['selling_price']) > 0.001) {
            AuditLog::record($request->userId(), 'MENU_PRICE_CHANGED',
                sprintf('Changed price of %s from Rs. %s to Rs. %s', $after['name'], number_format($before['selling_price'], 2), number_format($after['selling_price'], 2)),
                'menu_item', $id, ['selling_price' => $before['selling_price']], ['selling_price' => $after['selling_price']]);
        }
        $other = array_diff_key($data, ['selling_price' => 1]);
        if ($other) {
            AuditLog::record($request->userId(), 'MENU_ITEM_UPDATED', "Updated menu item {$after['name']}", 'menu_item', $id, array_intersect_key($before, $other), $other);
        }
        Response::success($after, 'Menu item updated successfully');
    }

    /** Items that appear in orders are archived (is_active = 0), never deleted. */
    public function destroy(Request $request, int $id): void
    {
        $item = $this->findOrFail($id);
        if (MenuItem::hasOrders($id)) {
            MenuItem::update($id, ['is_active' => 0, 'is_available' => 0]);
            AuditLog::record($request->userId(), 'MENU_ITEM_ARCHIVED', "Archived menu item {$item['name']}", 'menu_item', $id);
            Response::success(MenuItem::find($id), 'Menu item has order history and was archived instead of deleted');
            return;
        }
        MenuItem::delete($id);
        AuditLog::record($request->userId(), 'MENU_ITEM_DELETED', "Deleted menu item {$item['name']}", 'menu_item', $id, $item);
        Response::success(null, 'Menu item deleted');
    }

    /** GET /api/menu/{id}/recipe */
    public function recipe(Request $request, int $id): void
    {
        $this->findOrFail($id);
        Response::success(Recipe::forMenuItem($id));
    }

    /** PUT /api/menu/{id}/recipe  { items: [{inventory_item_id, quantity, unit}] } */
    public function saveRecipe(Request $request, int $id): void
    {
        $item = $this->findOrFail($id);
        $data = Validator::validate($request->body, ['track_inventory' => 'sometimes|boolean']);
        $items = $request->body['items'] ?? null;
        if (!is_array($items)) {
            throw HttpException::validation(['items' => ['The items field must be a list.']]);
        }

        $clean = [];
        $seen = [];
        foreach (array_values($items) as $i => $row) {
            $v = Validator::validate(is_array($row) ? $row : [], [
                'inventory_item_id' => 'required|integer',
                'quantity'          => 'required|numeric|min:0.001|max:100000',
                'unit'              => 'required|in:' . implode(',', InventoryItem::UNITS),
            ], "items.{$i}.");
            $inv = InventoryItem::find($v['inventory_item_id']);
            if (!$inv || !$inv['is_active']) {
                throw HttpException::validation(["items.{$i}.inventory_item_id" => ['This inventory item does not exist.']]);
            }
            if (isset($seen[$v['inventory_item_id']])) {
                throw HttpException::validation(["items.{$i}.inventory_item_id" => ["{$inv['name']} is listed twice."]]);
            }
            if (!InventoryService::unitsCompatible($v['unit'], $inv['unit'])) {
                throw HttpException::validation(["items.{$i}.unit" => ["{$inv['name']} is tracked in {$inv['unit']}; {$v['unit']} cannot be converted."]]);
            }
            $seen[$v['inventory_item_id']] = true;
            $clean[] = $v + ['name' => $inv['name']];
        }

        $before = Recipe::forMenuItem($id);
        Recipe::replace($id, $clean);
        if (isset($data['track_inventory'])) {
            MenuItem::update($id, ['track_inventory' => $data['track_inventory']]);
        } elseif ($clean && !$item['track_inventory']) {
            MenuItem::update($id, ['track_inventory' => true]);
        }
        AuditLog::record($request->userId(), 'RECIPE_UPDATED', "Updated recipe for {$item['name']} (" . count($clean) . ' ingredients)', 'menu_item', $id,
            ['items' => array_map(fn ($r) => "{$r['quantity']} {$r['unit']} {$r['inventory_item_name']}", $before['items'])],
            ['items' => array_map(fn ($r) => "{$r['quantity']} {$r['unit']} {$r['name']}", $clean)]);

        $out = Recipe::forMenuItem($id);
        $out['menu_item'] = MenuItem::find($id);
        Response::success($out, 'Recipe saved successfully');
    }

    /** GET /api/recipes — every active menu item with its ingredients */
    public function recipes(Request $request): void
    {
        Response::success(Recipe::all());
    }

    private function assertCategory(int $categoryId): void
    {
        if (!Category::find($categoryId)) {
            throw HttpException::validation(['category_id' => ['The selected category does not exist.']]);
        }
    }

    private function validate(array $body, bool $partial = false): array
    {
        $s = $partial ? 'sometimes|' : '';
        $data = Validator::validate($body, [
            'category_id'     => $s . 'required|integer',
            'name'            => $s . 'required|string|min:2|max:120',
            'sku'             => $s . 'required|string|max:40|regex:/^[A-Za-z0-9_-]+$/',
            'description'     => 'sometimes|nullable|string|max:500',
            'image'           => 'sometimes|nullable|string|max:500',
            'selling_price'   => $s . 'required|numeric|min:0|max:1000000',
            'cost_price'      => 'sometimes|nullable|numeric|min:0|max:1000000',
            'is_available'    => 'sometimes|boolean',
            'track_inventory' => 'sometimes|boolean',
            'is_active'       => 'sometimes|boolean',
        ]);
        if (isset($data['sku'])) {
            $data['sku'] = strtoupper($data['sku']);
        }
        if (array_key_exists('cost_price', $data) && $data['cost_price'] === null) {
            $data['cost_price'] = 0;
        }
        if (isset($data['selling_price'])) {
            $data['selling_price'] = round($data['selling_price'], 2);
        }
        if (!empty($data['image']) && !preg_match('#^(https?://|/uploads/)#', $data['image'])) {
            throw HttpException::validation(['image' => ['The image must be an uploaded file or an http(s) URL.']]);
        }
        return $data;
    }

    private function findOrFail(int $id): array
    {
        $m = MenuItem::find($id);
        if (!$m) {
            throw HttpException::notFound('Menu item not found');
        }
        return $m;
    }
}

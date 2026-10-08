<?php
declare(strict_types=1);

/** SUPERADMIN only. */
final class InventoryController
{
    public function index(Request $request): void
    {
        [$page, $perPage, $offset] = $request->pagination();
        $status = $request->query('status');
        if ($status && !in_array($status, ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'], true)) {
            throw HttpException::validation(['status' => ['Invalid stock status.']]);
        }
        Response::success(InventoryItem::paginate([
            'search'           => $request->query('search'),
            'status'           => $status,
            'include_inactive' => filter_var($request->query('include_inactive'), FILTER_VALIDATE_BOOLEAN),
        ], $page, $perPage, $offset));
    }

    /** GET /api/inventory/options — lightweight list for recipe pickers */
    public function options(Request $request): void
    {
        Response::success(InventoryItem::options());
    }

    public function show(Request $request, int $id): void
    {
        Response::success($this->findOrFail($id));
    }

    public function store(Request $request): void
    {
        $data = $this->validate($request->body);
        if (InventoryItem::skuExists($data['sku'])) {
            throw HttpException::validation(['sku' => ['This SKU is already in use.']]);
        }
        $id = InventoryService::create($request->user, $data);
        Response::created(InventoryItem::find($id), 'Inventory item created successfully');
    }

    /** Descriptive fields only. Quantity changes must use /adjust so they are recorded as movements. */
    public function update(Request $request, int $id): void
    {
        $before = $this->findOrFail($id);
        if (array_key_exists('current_quantity', $request->body)) {
            throw HttpException::validation(['current_quantity' => ['Use a stock adjustment to change the quantity.']]);
        }
        $data = $this->validate($request->body, true);
        if (isset($data['sku']) && InventoryItem::skuExists($data['sku'], $id)) {
            throw HttpException::validation(['sku' => ['This SKU is already in use.']]);
        }
        if (isset($data['unit']) && $data['unit'] !== $before['unit']) {
            if (abs($before['current_quantity']) > 0.0005 || InventoryItem::isUsedInRecipes($id)) {
                throw HttpException::validation(['unit' => ['The unit can only be changed while the item has zero stock and is not used in recipes.']]);
            }
        }
        InventoryItem::update($id, $data);
        AuditLog::record($request->userId(), 'INVENTORY_UPDATED', "Updated inventory item {$before['name']}", 'inventory_item', $id, array_intersect_key($before, $data), $data);
        Response::success(InventoryItem::find($id), 'Inventory item updated successfully');
    }

    /** DELETE /api/inventory/{id} — inventory is never hard-deleted (movement history). */
    public function destroy(Request $request, int $id): void
    {
        $item = $this->findOrFail($id);
        if (InventoryItem::isUsedInRecipes($id)) {
            throw HttpException::conflict("{$item['name']} is used in recipes. Remove it from those recipes first");
        }
        InventoryItem::update($id, ['is_active' => 0]);
        AuditLog::record($request->userId(), 'INVENTORY_DEACTIVATED', "Deactivated inventory item {$item['name']}", 'inventory_item', $id);
        Response::success(InventoryItem::find($id), 'Inventory item deactivated');
    }

    /** POST /api/inventory/{id}/adjust { type, quantity, reason } */
    public function adjust(Request $request, int $id): void
    {
        $data = Validator::validate($request->body, [
            'type'     => 'required|in:PURCHASE,ADJUSTMENT,WASTE,RETURN',
            'quantity' => 'required|numeric|min:-1000000|max:1000000',
            'reason'   => 'nullable|string|max:255',
        ]);
        if ($data['type'] !== 'ADJUSTMENT' && $data['quantity'] <= 0) {
            throw HttpException::validation(['quantity' => ['The quantity must be greater than zero.']]);
        }
        if (in_array($data['type'], ['ADJUSTMENT', 'WASTE'], true) && empty($data['reason'])) {
            throw HttpException::validation(['reason' => ['A reason is required for adjustments and waste.']]);
        }
        $result = InventoryService::adjust($request->user, $id, $data['type'], (float) $data['quantity'], $data['reason'] ?? null);
        Response::success(InventoryItem::find($id) + ['movement' => $result], 'Stock updated successfully');
    }

    /** GET /api/inventory/{id}/movements */
    public function movements(Request $request, int $id): void
    {
        $this->findOrFail($id);
        [$page, $perPage, $offset] = $request->pagination();
        Response::success(StockMovement::paginate([
            'inventory_item_id' => $id,
            'type'              => $request->query('type'),
        ], $page, $perPage, $offset));
    }

    /** GET /api/inventory/movements — all items */
    public function allMovements(Request $request): void
    {
        [$page, $perPage, $offset] = $request->pagination();
        $type = $request->query('type');
        if ($type && !in_array($type, StockMovement::TYPES, true)) {
            throw HttpException::validation(['type' => ['Invalid movement type.']]);
        }
        Response::success(StockMovement::paginate([
            'inventory_item_id' => $request->query('inventory_item_id'),
            'type'              => $type,
            'from'              => $request->query('from'),
            'to'                => $request->query('to'),
        ], $page, $perPage, $offset));
    }

    private function validate(array $body, bool $partial = false): array
    {
        $s = $partial ? 'sometimes|' : '';
        $data = Validator::validate($body, [
            'name'             => $s . 'required|string|min:2|max:120',
            'sku'              => $s . 'required|string|max:40|regex:/^[A-Za-z0-9_-]+$/',
            'unit'             => $s . 'required|in:' . implode(',', InventoryItem::UNITS),
            'current_quantity' => $partial ? 'sometimes|numeric' : 'sometimes|numeric|min:0|max:10000000',
            'minimum_quantity' => 'sometimes|numeric|min:0|max:10000000',
            'cost_per_unit'    => 'sometimes|numeric|min:0|max:10000000',
            'supplier'         => 'sometimes|nullable|string|max:150',
            'is_active'        => 'sometimes|boolean',
        ]);
        if (isset($data['sku'])) {
            $data['sku'] = strtoupper($data['sku']);
        }
        return $data;
    }

    private function findOrFail(int $id): array
    {
        $i = InventoryItem::find($id);
        if (!$i) {
            throw HttpException::notFound('Inventory item not found');
        }
        return $i;
    }
}

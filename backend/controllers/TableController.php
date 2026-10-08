<?php
declare(strict_types=1);

final class TableController
{
    /** GET /api/tables (all authenticated users) */
    public function index(Request $request): void
    {
        $status = $request->query('status');
        if ($status !== null && $status !== '' && !in_array($status, CafeTable::STATUSES, true)) {
            throw HttpException::validation(['status' => ['Invalid status filter.']]);
        }
        Response::success(CafeTable::all([
            'status'           => $status,
            'section'          => $request->query('section'),
            'search'           => $request->query('search'),
            'include_inactive' => $request->isAdmin() && filter_var($request->query('include_inactive'), FILTER_VALIDATE_BOOLEAN),
        ]));
    }

    public function show(Request $request, int $id): void
    {
        Response::success($this->findOrFail($id));
    }

    /** POST /api/tables (admin) */
    public function store(Request $request): void
    {
        $data = $this->validate($request->body);
        if (CafeTable::numberExists($data['table_number'])) {
            throw HttpException::validation(['table_number' => ['This table number already exists.']]);
        }
        $data['name'] = $data['name'] ?? 'Table ' . $data['table_number'];
        $id = CafeTable::create($data);
        AuditLog::record($request->userId(), 'TABLE_CREATED', "Created {$data['name']} ({$data['capacity']} seats, {$data['section']})", 'table', $id, null, $data);
        Response::created(CafeTable::find($id), 'Table created successfully');
    }

    /** PUT /api/tables/{id} (admin) */
    public function update(Request $request, int $id): void
    {
        $before = $this->findOrFail($id);
        $data = $this->validate($request->body, true);
        if (isset($data['table_number']) && CafeTable::numberExists($data['table_number'], $id)) {
            throw HttpException::validation(['table_number' => ['This table number already exists.']]);
        }
        if (isset($data['status']) && $data['status'] !== $before['status']) {
            $this->assertStatusChangeAllowed($before, $data['status']);
        }
        if (array_key_exists('is_active', $data)) {
            if (!$data['is_active'] && $before['current_order_id']) {
                throw HttpException::conflict('Close the open order before deactivating this table');
            }
            $data['status'] = $data['is_active'] ? (($data['status'] ?? $before['status']) === 'INACTIVE' ? 'AVAILABLE' : ($data['status'] ?? $before['status'])) : 'INACTIVE';
        }
        CafeTable::update($id, $data);
        $after = CafeTable::find($id);
        $action = (isset($data['is_active']) && !$data['is_active'] && $before['is_active']) ? 'TABLE_DEACTIVATED' : 'TABLE_UPDATED';
        AuditLog::record($request->userId(), $action, ($action === 'TABLE_DEACTIVATED' ? 'Deactivated ' : 'Updated ') . $after['name'], 'table', $id, array_intersect_key($before, $data), $data);
        Response::success($after, 'Table updated successfully');
    }

    /** POST /api/tables/{id}/status — staff can mark tables reserved / cleaning / available */
    public function setStatus(Request $request, int $id): void
    {
        $data = Validator::validate($request->body, ['status' => 'required|in:AVAILABLE,RESERVED,CLEANING']);
        Database::transaction(function () use ($request, $id, $data) {
            $table = CafeTable::findForUpdate($id);
            if (!$table) {
                throw HttpException::notFound('Table not found');
            }
            if (!$table['is_active']) {
                throw HttpException::conflict('This table is inactive');
            }
            $this->assertStatusChangeAllowed(CafeTable::find($id), $data['status']);
            CafeTable::setStatus($id, $data['status']);
            AuditLog::record($request->userId(), 'TABLE_STATUS_CHANGED', "{$table['name']}: {$table['status']} → {$data['status']}", 'table', $id, ['status' => $table['status']], $data);
        });
        Response::success(CafeTable::find($id), 'Table status updated');
    }

    /** DELETE /api/tables/{id} — deactivates tables with history, deletes otherwise. */
    public function destroy(Request $request, int $id): void
    {
        $table = $this->findOrFail($id);
        if ($table['current_order_id']) {
            throw HttpException::conflict('Close the open order before removing this table');
        }
        if (CafeTable::hasOrders($id)) {
            CafeTable::update($id, ['is_active' => 0, 'status' => 'INACTIVE']);
            AuditLog::record($request->userId(), 'TABLE_DEACTIVATED', "Deactivated {$table['name']} (has order history)", 'table', $id, ['is_active' => true], ['is_active' => false]);
            Response::success(CafeTable::find($id), 'Table has order history and was deactivated instead of deleted');
            return;
        }
        CafeTable::delete($id);
        AuditLog::record($request->userId(), 'TABLE_DELETED', "Deleted {$table['name']}", 'table', $id, $table);
        Response::success(null, 'Table deleted');
    }

    private function assertStatusChangeAllowed(array $table, string $status): void
    {
        if ($table['current_order_id'] && $status !== 'OCCUPIED') {
            throw HttpException::conflict("{$table['name']} has an open order ({$table['current_order_number']})");
        }
        if (!$table['current_order_id'] && $status === 'OCCUPIED') {
            throw HttpException::conflict('A table becomes occupied automatically when an order is created');
        }
    }

    private function validate(array $body, bool $partial = false): array
    {
        $s = $partial ? 'sometimes|' : '';
        return Validator::validate($body, [
            'table_number' => $s . 'required|string|max:10|regex:/^[A-Za-z0-9-]+$/',
            'name'         => ($partial ? 'sometimes|' : '') . 'nullable|string|max:50',
            'capacity'     => $s . 'required|integer|min:1|max:50',
            'section'      => $s . 'required|string|max:50',
            'status'       => 'sometimes|in:AVAILABLE,RESERVED,CLEANING,OCCUPIED',
            'is_active'    => 'sometimes|boolean',
        ]);
    }

    private function findOrFail(int $id): array
    {
        $t = CafeTable::find($id);
        if (!$t) {
            throw HttpException::notFound('Table not found');
        }
        return $t;
    }
}

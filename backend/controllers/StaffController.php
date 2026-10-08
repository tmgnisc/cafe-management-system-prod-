<?php
declare(strict_types=1);

/** SUPERADMIN only — user / staff management. */
final class StaffController
{
    public function index(Request $request): void
    {
        [$page, $perPage, $offset] = $request->pagination();
        Response::success(User::paginate([
            'search' => $request->query('search'),
            'role'   => $request->query('role'),
            'status' => $request->query('status'),
        ], $page, $perPage, $offset));
    }

    public function show(Request $request, int $id): void
    {
        Response::success($this->findOrFail($id));
    }

    public function store(Request $request): void
    {
        $data = Validator::validate($request->body, [
            'name'     => 'required|string|min:2|max:100',
            'email'    => 'required|email|max:150',
            'phone'    => 'nullable|string|max:30',
            'password' => 'required|string|password|confirmed|max:255',
            'role'     => 'required|in:SUPERADMIN,STAFF',
            'status'   => 'sometimes|in:ACTIVE,INACTIVE',
        ]);
        if (User::emailExists($data['email'])) {
            throw HttpException::validation(['email' => ['This email is already registered.']]);
        }
        $id = User::create($data);
        AuditLog::record($request->userId(), 'STAFF_CREATED', "Created {$data['role']} account for {$data['name']} ({$data['email']})", 'user', $id, null, $data);
        Response::created(User::find($id), 'Staff member created successfully');
    }

    public function update(Request $request, int $id): void
    {
        $before = $this->findOrFail($id);
        $data = Validator::validate($request->body, [
            'name'   => 'sometimes|required|string|min:2|max:100',
            'email'  => 'sometimes|required|email|max:150',
            'phone'  => 'sometimes|nullable|string|max:30',
            'role'   => 'sometimes|required|in:SUPERADMIN,STAFF',
            'status' => 'sometimes|required|in:ACTIVE,INACTIVE',
        ]);
        if (isset($data['email']) && User::emailExists($data['email'], $id)) {
            throw HttpException::validation(['email' => ['This email is already registered.']]);
        }
        $this->guardLastAdmin($request, $before, $data);

        User::update($id, $data);
        $after = User::find($id);
        $old = array_intersect_key($before, $data);
        AuditLog::record($request->userId(), 'STAFF_UPDATED', "Updated account of {$after['name']}", 'user', $id, $old, $data);
        Response::success($after, 'Staff member updated successfully');
    }

    /** POST /api/staff/{id}/reset-password */
    public function resetPassword(Request $request, int $id): void
    {
        $user = $this->findOrFail($id);
        $data = Validator::validate($request->body, ['password' => 'required|string|password|confirmed|max:255']);
        User::setPassword($id, $data['password']);
        AuditLog::record($request->userId(), 'STAFF_PASSWORD_RESET', "Reset password of {$user['name']}", 'user', $id);
        Response::success(null, 'Password reset successfully');
    }

    /** DELETE /api/staff/{id} — deactivates users with history, deletes users without. */
    public function destroy(Request $request, int $id): void
    {
        $user = $this->findOrFail($id);
        if ($id === $request->userId()) {
            throw HttpException::conflict('You cannot delete your own account');
        }
        $this->guardLastAdmin($request, $user, ['status' => 'INACTIVE']);

        if (User::hasHistory($id)) {
            User::update($id, ['status' => 'INACTIVE']);
            AuditLog::record($request->userId(), 'STAFF_DEACTIVATED', "Deactivated {$user['name']} (has order history)", 'user', $id, ['status' => $user['status']], ['status' => 'INACTIVE']);
            Response::success(User::find($id), 'Staff member has history and was deactivated instead of deleted');
            return;
        }
        Database::execute('UPDATE audit_logs SET user_id = NULL WHERE user_id = ?', [$id]);
        User::delete($id);
        AuditLog::record($request->userId(), 'STAFF_DELETED', "Deleted account of {$user['name']} ({$user['email']})", 'user', $id, $user);
        Response::success(null, 'Staff member deleted');
    }

    private function findOrFail(int $id): array
    {
        $u = User::find($id);
        if (!$u) {
            throw HttpException::notFound('Staff member not found');
        }
        return $u;
    }

    /** Never allow the system to end up with zero active super admins. */
    private function guardLastAdmin(Request $request, array $before, array $data): void
    {
        $losesAdmin = $before['role'] === 'SUPERADMIN' && $before['status'] === 'ACTIVE'
            && ((isset($data['role']) && $data['role'] !== 'SUPERADMIN') || (isset($data['status']) && $data['status'] !== 'ACTIVE'));
        if ($losesAdmin && User::countActiveAdmins((int) $before['id']) === 0) {
            throw HttpException::conflict('At least one active super admin is required');
        }
        if ($losesAdmin && (int) $before['id'] === $request->userId()) {
            throw HttpException::conflict('You cannot deactivate or demote your own account');
        }
    }
}

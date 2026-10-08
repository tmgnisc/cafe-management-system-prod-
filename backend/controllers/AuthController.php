<?php
declare(strict_types=1);

final class AuthController
{
    /** POST /api/auth/login */
    public function login(Request $request): void
    {
        $data = Validator::validate($request->body, [
            'email'    => 'required|email|max:150',
            'password' => 'required|string|max:255',
        ]);

        // Brute-force protection: per-email and (looser) per-IP failure windows.
        $cfg = Config::get('auth');
        $window = [$cfg['lockout_minutes']];
        $emailFailures = (int) Database::value(
            'SELECT COUNT(*) FROM login_attempts WHERE email = ? AND attempted_at > (NOW() - INTERVAL ? MINUTE)',
            [$data['email'], ...$window]
        );
        $ipFailures = (int) Database::value(
            'SELECT COUNT(*) FROM login_attempts WHERE ip_address = ? AND attempted_at > (NOW() - INTERVAL ? MINUTE)',
            [$request->ip(), ...$window]
        );
        if ($emailFailures >= $cfg['max_login_attempts'] || $ipFailures >= $cfg['max_login_attempts'] * 4) {
            throw HttpException::tooMany("Too many failed login attempts. Try again in {$cfg['lockout_minutes']} minutes");
        }

        $user = User::findByEmailWithPassword($data['email']);
        // Always run password_verify to keep timing similar for unknown emails.
        $hash = $user['password'] ?? '$2y$10$usesomesillystringfore7hnbRJHxXVLeakoG8K30oukPsA.ztMG';
        $valid = password_verify($data['password'], $hash);

        if (!$user || !$valid) {
            Database::insert('INSERT INTO login_attempts (email, ip_address) VALUES (?, ?)', [$data['email'], $request->ip()]);
            throw new HttpException('Invalid email or password', 401);
        }
        if ($user['status'] !== 'ACTIVE') {
            throw HttpException::forbidden('Your account has been deactivated. Please contact the administrator');
        }

        if (password_needs_rehash($user['password'], PASSWORD_DEFAULT)) {
            User::setPassword((int) $user['id'], $data['password']);
        }
        Database::execute('DELETE FROM login_attempts WHERE email = ?', [$data['email']]);
        User::touchLogin((int) $user['id']);
        $csrf = Auth::login($user);
        AuditLog::record((int) $user['id'], 'LOGIN', "{$user['name']} logged in", 'user', (int) $user['id']);

        Response::success([
            'user'       => User::find((int) $user['id']),
            'csrf_token' => $csrf,
        ], 'Logged in successfully');
    }

    /** POST /api/auth/logout */
    public function logout(Request $request): void
    {
        $id = Auth::userId();
        if ($id !== null) {
            if (!Auth::verifyCsrf($request->header('X-CSRF-Token'))) {
                throw new HttpException('Invalid or missing CSRF token', 419);
            }
            AuditLog::record($id, 'LOGOUT', 'User logged out', 'user', $id);
        }
        Auth::destroy();
        Response::success(null, 'Logged out successfully');
    }

    /** GET /api/auth/me */
    public function me(Request $request): void
    {
        Response::success([
            'user'       => $request->user,
            'csrf_token' => Auth::csrfToken(),
        ]);
    }

    /** PUT /api/auth/password — change own password */
    public function changePassword(Request $request): void
    {
        $data = Validator::validate($request->body, [
            'current_password' => 'required|string',
            'password'         => 'required|string|password|confirmed|max:255',
        ]);
        $row = User::findByEmailWithPassword($request->user['email']);
        if (!password_verify($data['current_password'], $row['password'])) {
            throw HttpException::validation(['current_password' => ['The current password is incorrect.']]);
        }
        User::setPassword($request->userId(), $data['password']);
        AuditLog::record($request->userId(), 'PASSWORD_CHANGED', 'Changed own password', 'user', $request->userId());
        Response::success(null, 'Password changed successfully');
    }

    /** PUT /api/auth/profile — update own name / phone */
    public function updateProfile(Request $request): void
    {
        $data = Validator::validate($request->body, [
            'name'  => 'required|string|min:2|max:100',
            'phone' => 'nullable|string|max:30',
        ]);
        User::update($request->userId(), $data);
        AuditLog::record($request->userId(), 'PROFILE_UPDATED', 'Updated own profile', 'user', $request->userId(), null, $data);
        Response::success(User::find($request->userId()), 'Profile updated');
    }
}

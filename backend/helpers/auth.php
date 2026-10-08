<?php
declare(strict_types=1);

/**
 * Session-based authentication.
 *
 *  - Session id lives in an HttpOnly cookie (Secure in production, SameSite configurable).
 *  - The session id is regenerated on login (prevents fixation).
 *  - A per-session CSRF token must be echoed in the X-CSRF-Token header on every
 *    state-changing request (POST/PUT/PATCH/DELETE).
 *  - Idle sessions expire after SESSION_LIFETIME minutes.
 */
final class Auth
{
    /**
     * Sessions are started lazily: only when the browser already sent a session
     * cookie, or when $force is true (login). Anonymous requests (health checks,
     * bots) therefore never create session rows.
     */
    public static function startSession(bool $force = false): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }
        $c = Config::get('session');
        if (!$force && empty($_COOKIE[$c['name']])) {
            return;
        }
        if ($c['driver'] === 'database') {
            session_set_save_handler(new DbSessionHandler(), true);
        } else {
            if (!is_dir($c['save_path'])) {
                mkdir($c['save_path'], 0700, true);
            }
            session_save_path($c['save_path']);
        }
        session_name($c['name']);
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.gc_maxlifetime', (string) ($c['lifetime_minutes'] * 60));
        session_set_cookie_params([
            'lifetime' => 0,
            'path'     => '/',
            'domain'   => $c['domain'],
            'secure'   => $c['secure'],
            'httponly' => true,
            'samesite' => $c['samesite'],
        ]);
        session_start();

        // Idle timeout
        $now = time();
        if (isset($_SESSION['last_activity']) && $now - $_SESSION['last_activity'] > $c['lifetime_minutes'] * 60) {
            self::destroy();
            return;
        }
        $_SESSION['last_activity'] = $now;
    }

    public static function login(array $user): string
    {
        self::startSession(true);
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int) $user['id'];
        $_SESSION['role'] = $user['role'];
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        $_SESSION['logged_in_at'] = time();
        return $_SESSION['csrf_token'];
    }

    public static function userId(): ?int
    {
        return isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;
    }

    public static function csrfToken(): ?string
    {
        return $_SESSION['csrf_token'] ?? null;
    }

    public static function verifyCsrf(?string $token): bool
    {
        $expected = self::csrfToken();
        return $expected !== null && $token !== null && hash_equals($expected, $token);
    }

    public static function destroy(): void
    {
        $_SESSION = [];
        if (session_status() === PHP_SESSION_ACTIVE) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires'  => time() - 3600,
                'path'     => $p['path'],
                'domain'   => $p['domain'],
                'secure'   => $p['secure'],
                'httponly' => true,
                'samesite' => $p['samesite'] ?? 'Lax',
            ]);
            session_destroy();
        }
    }
}

/** Static access to the loaded config array using dot notation. */
final class Config
{
    private static array $items = [];

    public static function load(array $items): void
    {
        self::$items = $items;
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        $value = self::$items;
        foreach (explode('.', $key) as $segment) {
            if (!is_array($value) || !array_key_exists($segment, $value)) {
                return $default;
            }
            $value = $value[$segment];
        }
        return $value;
    }
}

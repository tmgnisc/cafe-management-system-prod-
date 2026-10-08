<?php
declare(strict_types=1);

/**
 * Application configuration. Every secret / environment-specific value is
 * read from backend/.env (or real environment variables) — never hardcoded.
 */

loadEnvFile(dirname(__DIR__) . '/.env');

function env(string $key, mixed $default = null): mixed
{
    $value = $_ENV[$key] ?? getenv($key);
    if ($value === false || $value === null) {
        return $default;
    }
    return match (strtolower((string) $value)) {
        'true' => true,
        'false' => false,
        'null' => null,
        default => $value,
    };
}

function loadEnvFile(string $path): void
{
    if (!is_file($path)) {
        return;
    }
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
            continue;
        }
        [$key, $value] = array_map('trim', explode('=', $line, 2));
        if (preg_match('/^(["\'])(.*)\1$/', $value, $m)) {
            $value = $m[2];
        } else {
            $value = trim((string) preg_replace('/\s+#.*$/', '', $value)); // strip inline comments
        }
        // Real environment variables win over the .env file.
        if (getenv($key) === false && !isset($_ENV[$key])) {
            $_ENV[$key] = $value;
            putenv("$key=$value");
        }
    }
}

$appEnv = (string) env('APP_ENV', 'development');

return [
    'app' => [
        'env'      => $appEnv,
        'debug'    => (bool) env('APP_DEBUG', $appEnv !== 'production'),
        'url'      => (string) env('APP_URL', 'http://localhost:8000'),
        'timezone' => (string) env('APP_TIMEZONE', 'Asia/Kathmandu'),
    ],
    // DB_* wins; Railway's MySQL plugin variables (MYSQLHOST, …) are used as fallbacks.
    'db' => [
        'host'     => (string) env('DB_HOST', env('MYSQLHOST', '127.0.0.1')),
        'port'     => (int) env('DB_PORT', env('MYSQLPORT', 3306)),
        'database' => (string) env('DB_DATABASE', env('MYSQLDATABASE', 'cafe')),
        'username' => (string) env('DB_USERNAME', env('MYSQLUSER', 'root')),
        'password' => (string) env('DB_PASSWORD', env('MYSQLPASSWORD', '')),
        'socket'   => (string) env('DB_SOCKET', ''),
    ],
    'cors' => [
        // Comma separated list of exact origins allowed to call the API with credentials.
        'allowed_origins' => array_values(array_filter(array_map(
            'trim',
            explode(',', (string) env('FRONTEND_URL', 'http://localhost:3000'))
        ))),
    ],
    'session' => [
        'name'             => (string) env('SESSION_NAME', 'ISHACAFE_SESSION'),
        'lifetime_minutes' => (int) env('SESSION_LIFETIME', 720),
        'secure'           => (bool) env('SESSION_SECURE_COOKIE', $appEnv === 'production'),
        'samesite'         => (string) env('SESSION_SAMESITE', 'Lax'),
        'domain'           => (string) env('SESSION_DOMAIN', ''),
        // database (default — survives redeploys, works with several instances) | files
        'driver'           => (string) env('SESSION_DRIVER', 'database'),
        'save_path'        => dirname(__DIR__) . '/storage/sessions',
    ],
    // Behind a reverse proxy (Railway, Vercel rewrites, nginx) REMOTE_ADDR is the proxy.
    // When true, the client IP is taken from the left-most X-Forwarded-For entry.
    'trust_proxy' => (bool) env('TRUST_PROXY', false),
    'auth' => [
        'max_login_attempts'   => (int) env('AUTH_MAX_LOGIN_ATTEMPTS', 5),
        'lockout_minutes'      => (int) env('AUTH_LOCKOUT_MINUTES', 15),
    ],
    'uploads' => [
        'path'      => dirname(__DIR__) . '/public/uploads',
        'url'       => rtrim((string) env('APP_URL', 'http://localhost:8000'), '/') . '/uploads',
        'max_bytes' => 2 * 1024 * 1024,
    ],
];

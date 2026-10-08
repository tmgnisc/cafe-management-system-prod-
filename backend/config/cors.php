<?php
declare(strict_types=1);

/**
 * CORS: only explicitly configured frontend origins may call the API, and
 * credentials (the session cookie) are only allowed for those origins.
 * A wildcard origin is never sent.
 */
final class Cors
{
    public static function handle(): void
    {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        $allowed = Config::get('cors.allowed_origins');

        if ($origin !== '' && in_array($origin, $allowed, true)) {
            header("Access-Control-Allow-Origin: {$origin}");
            header('Access-Control-Allow-Credentials: true');
            header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type, Accept, X-CSRF-Token, X-Requested-With');
            header('Access-Control-Max-Age: 600');
        }
        header('Vary: Origin');

        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
            http_response_code($origin !== '' && in_array($origin, $allowed, true) ? 204 : 403);
            exit;
        }
    }
}

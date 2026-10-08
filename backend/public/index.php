<?php
declare(strict_types=1);

/**
 * Front controller for the Isha's Cozy Cafe REST API.
 *
 * Dev:   php -S localhost:8000 -t backend/public backend/public/index.php
 * Prod:  Apache/Nginx document root = backend/public (see .htaccess)
 */

// Let the PHP built-in server serve real static files (uploaded images).
if (PHP_SAPI === 'cli-server') {
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    if ($path !== '/' && is_file(__DIR__ . $path) && !str_ends_with($path, '.php')) {
        return false;
    }
}

require dirname(__DIR__) . '/bootstrap.php';

ini_set('display_errors', '0');
error_reporting(E_ALL);
set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    if (!(error_reporting() & $severity)) {
        return false;
    }
    // Deprecations (e.g. on a newer PHP than the code was written for) are logged, not fatal.
    if ($severity === E_DEPRECATED || $severity === E_USER_DEPRECATED) {
        @file_put_contents(BASE_PATH . '/storage/logs/app.log', sprintf("[%s] Deprecated: %s in %s:%d\n", date('c'), $message, $file, $line), FILE_APPEND | LOCK_EX);
        return true;
    }
    throw new ErrorException($message, 0, $severity, $file, $line);
});

try {
    Cors::handle();
    Auth::startSession();
    $router = require BASE_PATH . '/routes/api.php';
    $router->dispatch(Request::capture());
} catch (HttpException $e) {
    Response::error($e->getMessage(), $e->status(), $e->errors());
} catch (PDOException $e) {
    $code = $e->errorInfo[1] ?? null;
    log_exception($e);
    if ($code === 1062) {
        Response::error('A record with the same unique value already exists', 409);
    } elseif ($code === 1451) {
        Response::error('This record is referenced by other data and cannot be removed', 409);
    } else {
        Response::error(debug_message($e, 'A database error occurred'), 500);
    }
} catch (Throwable $e) {
    log_exception($e);
    Response::error(debug_message($e, 'An unexpected server error occurred'), 500);
}

function log_exception(Throwable $e): void
{
    $line = sprintf("[%s] %s: %s in %s:%d\n%s\n", date('c'), get_class($e), $e->getMessage(), $e->getFile(), $e->getLine(), $e->getTraceAsString());
    @file_put_contents(BASE_PATH . '/storage/logs/app.log', $line, FILE_APPEND | LOCK_EX);
}

function debug_message(Throwable $e, string $fallback): string
{
    return Config::get('app.debug') ? $fallback . ': ' . $e->getMessage() : $fallback;
}

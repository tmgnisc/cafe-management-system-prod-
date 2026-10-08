<?php
declare(strict_types=1);

/**
 * Shared bootstrap for the HTTP front controller and CLI scripts.
 */

define('BASE_PATH', __DIR__);

require BASE_PATH . '/helpers/response.php';
require BASE_PATH . '/helpers/validation.php';
require BASE_PATH . '/helpers/auth.php';

Config::load(require BASE_PATH . '/config/config.php');

require BASE_PATH . '/config/database.php';
require BASE_PATH . '/config/cors.php';

date_default_timezone_set(Config::get('app.timezone'));

spl_autoload_register(static function (string $class): void {
    foreach (['controllers', 'models', 'services', 'middleware', 'helpers', 'routes'] as $dir) {
        $file = BASE_PATH . "/{$dir}/{$class}.php";
        if (is_file($file)) {
            require $file;
            return;
        }
    }
});

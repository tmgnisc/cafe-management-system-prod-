<?php
declare(strict_types=1);

/**
 * Database installer / migrator (CLI only).
 *
 *   php database/install.php                  # SAFE: create missing tables, default settings,
 *                                             #       and the SUPERADMIN if there are no users yet
 *   php database/install.php --fresh          # DROP everything, then install (empty cafe, superadmin only)
 *   php database/install.php --fresh --demo   # … plus demo tables/menu/inventory/recipes + a demo staff user
 *   php database/install.php --fresh --demo --with-history   # … plus ~3 weeks of order history
 *
 * The superadmin is created from ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD.
 * In development they default to admin@ishascozycafe.com / IshaAdmin@2026.
 * In production ADMIN_EMAIL and ADMIN_PASSWORD are required.
 *
 * --fresh refuses to run when APP_ENV=production unless --force is also given.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require dirname(__DIR__) . '/bootstrap.php';

$args = array_slice($argv, 1);
$fresh = in_array('--fresh', $args, true);
$demo = in_array('--demo', $args, true);
$withHistory = in_array('--with-history', $args, true);
$force = in_array('--force', $args, true);
$production = Config::get('app.env') === 'production';

if ($fresh && $production && !$force) {
    fwrite(STDERR, "Refusing to wipe a production database without --force\n");
    exit(1);
}
if (($demo || $withHistory) && !$fresh) {
    fwrite(STDERR, "--demo / --with-history require --fresh\n");
    exit(1);
}

$c = Config::get('db');
$dbName = $c['database'];
if (!preg_match('/^[A-Za-z0-9_]+$/', $dbName)) {
    fwrite(STDERR, "Invalid database name\n");
    exit(1);
}
$dsn = $c['socket'] !== ''
    ? "mysql:unix_socket={$c['socket']};charset=utf8mb4"
    : "mysql:host={$c['host']};port={$c['port']};charset=utf8mb4";

// The DB container may still be starting (Railway / Docker) — retry for ~30 s.
for ($attempt = 1; ; $attempt++) {
    try {
        $pdo = new PDO($dsn, $c['username'], $c['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        break;
    } catch (PDOException $e) {
        if ($attempt >= 15) {
            fwrite(STDERR, "Cannot connect to MySQL: {$e->getMessage()}\n");
            exit(1);
        }
        sleep(2);
    }
}
$pdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
$pdo->exec("USE `{$dbName}`");

$run = function (string $file) use ($pdo): void {
    $sql = file_get_contents(__DIR__ . '/' . $file);
    // The SQL files target `cafe`; redirect to the configured database (e.g. railway, cafe_test).
    $sql = preg_replace('/^\s*(CREATE DATABASE|USE)\b.*$/mi', '', $sql);
    $sql = preg_replace('/^\s*--.*$/m', '', $sql);
    foreach (preg_split('/;\s*(\n|$)/', $sql) as $stmt) {
        if (trim($stmt) !== '') {
            $pdo->exec($stmt);
        }
    }
    echo "  ✓ {$file}\n";
};

echo "Database `{$dbName}`" . ($fresh ? ' (fresh install)' : '') . "\n";

if ($fresh) {
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
    foreach ($pdo->query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"')->fetchAll(PDO::FETCH_COLUMN) as $table) {
        $pdo->exec('DROP TABLE `' . str_replace('`', '', $table) . '`');
    }
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
    echo "  ✓ dropped existing tables\n";
}

$run('schema.sql');
$run('seed_base.sql');

// ---------------------------------------------------------------- superadmin bootstrap
$userCount = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
if ($userCount === 0) {
    $email = strtolower(trim((string) env('ADMIN_EMAIL', $production ? '' : 'admin@ishascozycafe.com')));
    $password = (string) env('ADMIN_PASSWORD', $production ? '' : 'IshaAdmin@2026');
    $name = trim((string) env('ADMIN_NAME', 'Isha Sharma')) ?: 'Administrator';

    if ($email === '' || $password === '') {
        fwrite(STDERR, "  ! No users exist. Set ADMIN_EMAIL and ADMIN_PASSWORD, then run this again to create the superadmin.\n");
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        fwrite(STDERR, "  ! ADMIN_EMAIL is not a valid email address\n");
        exit(1);
    } elseif (strlen($password) < 8 || !preg_match('/[A-Za-z]/', $password) || !preg_match('/\d/', $password)) {
        fwrite(STDERR, "  ! ADMIN_PASSWORD must be at least 8 characters with letters and numbers\n");
        exit(1);
    } else {
        $stmt = $pdo->prepare("INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, 'SUPERADMIN', 'ACTIVE')");
        $stmt->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT)]);
        echo "  ✓ created superadmin {$email}\n";
    }
} else {
    echo "  · {$userCount} user(s) already exist — superadmin bootstrap skipped\n";
}

if ($demo) {
    $run('seed_demo.sql');
}
if ($withHistory) {
    require __DIR__ . '/history_seeder.php';
    seed_history();
}

echo "Done.\n";

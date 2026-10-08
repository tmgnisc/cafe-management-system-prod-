<?php
declare(strict_types=1);

/**
 * PDO connection holder + small transaction helper.
 */
final class Database
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo === null) {
            $c = Config::get('db');
            $dsn = $c['socket'] !== ''
                ? "mysql:unix_socket={$c['socket']};dbname={$c['database']};charset=utf8mb4"
                : "mysql:host={$c['host']};port={$c['port']};dbname={$c['database']};charset=utf8mb4";

            self::$pdo = new PDO($dsn, $c['username'], $c['password'], [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::ATTR_STRINGIFY_FETCHES  => false,
            ]);

            // Keep MySQL NOW()/CURRENT_TIMESTAMP aligned with the app timezone.
            $offset = (new DateTimeImmutable('now', new DateTimeZone(Config::get('app.timezone'))))->format('P');
            self::$pdo->exec("SET time_zone = '{$offset}'");
            self::$pdo->exec("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ENGINE_SUBSTITUTION'");
        }
        return self::$pdo;
    }

    /**
     * Run $callback inside a transaction. Commits on success, rolls back on any throwable.
     * Nested calls join the outer transaction.
     */
    public static function transaction(callable $callback): mixed
    {
        $pdo = self::pdo();
        if ($pdo->inTransaction()) {
            return $callback($pdo);
        }
        $pdo->beginTransaction();
        try {
            $result = $callback($pdo);
            $pdo->commit();
            return $result;
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    public static function fetch(string $sql, array $params = []): ?array
    {
        $stmt = self::pdo()->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    public static function fetchAll(string $sql, array $params = []): array
    {
        $stmt = self::pdo()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public static function value(string $sql, array $params = []): mixed
    {
        $stmt = self::pdo()->prepare($sql);
        $stmt->execute($params);
        $v = $stmt->fetchColumn();
        return $v === false ? null : $v;
    }

    public static function execute(string $sql, array $params = []): int
    {
        $stmt = self::pdo()->prepare($sql);
        $stmt->execute($params);
        return $stmt->rowCount();
    }

    public static function insert(string $sql, array $params = []): int
    {
        self::execute($sql, $params);
        return (int) self::pdo()->lastInsertId();
    }
}

<?php
declare(strict_types=1);

/**
 * Stores PHP sessions in the `sessions` table so logins survive container
 * restarts/redeploys and work across multiple API instances.
 * Implements validateId() so session.use_strict_mode rejects unknown IDs.
 */
final class DbSessionHandler implements SessionHandlerInterface, SessionUpdateTimestampHandlerInterface
{
    public function open(string $path, string $name): bool
    {
        return true;
    }

    public function close(): bool
    {
        return true;
    }

    public function read(string $id): string|false
    {
        $data = Database::value('SELECT data FROM sessions WHERE id = ?', [$id]);
        return $data === null ? '' : (string) $data;
    }

    public function write(string $id, string $data): bool
    {
        Database::execute(
            'INSERT INTO sessions (id, data, last_activity) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE data = VALUES(data), last_activity = VALUES(last_activity)',
            [$id, $data, time()]
        );
        return true;
    }

    public function destroy(string $id): bool
    {
        Database::execute('DELETE FROM sessions WHERE id = ?', [$id]);
        return true;
    }

    public function gc(int $max_lifetime): int|false
    {
        return Database::execute('DELETE FROM sessions WHERE last_activity < ?', [time() - $max_lifetime]);
    }

    public function validateId(string $id): bool
    {
        return (bool) Database::value('SELECT 1 FROM sessions WHERE id = ?', [$id]);
    }

    public function updateTimestamp(string $id, string $data): bool
    {
        Database::execute('UPDATE sessions SET last_activity = ? WHERE id = ?', [time(), $id]);
        return true;
    }
}

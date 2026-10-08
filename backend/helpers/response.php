<?php
declare(strict_types=1);

/**
 * Consistent JSON envelope:
 *   success: { success: true,  message, data }
 *   error:   { success: false, message, errors }
 */
final class Response
{
    public static function json(array $payload, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: no-store');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    }

    public static function success(mixed $data = null, string $message = 'OK', int $status = 200): void
    {
        self::json(['success' => true, 'message' => $message, 'data' => $data ?? new stdClass()], $status);
    }

    public static function created(mixed $data = null, string $message = 'Created successfully'): void
    {
        self::success($data, $message, 201);
    }

    public static function error(string $message, int $status = 400, array $errors = []): void
    {
        self::json([
            'success' => false,
            'message' => $message,
            'errors'  => $errors === [] ? new stdClass() : $errors,
        ], $status);
    }
}

/**
 * Throw anywhere in the request lifecycle; the front controller turns it into a JSON error.
 */
class HttpException extends RuntimeException
{
    public function __construct(string $message, private int $status = 400, private array $errors = [])
    {
        parent::__construct($message, $status);
    }

    public function status(): int
    {
        return $this->status;
    }

    public function errors(): array
    {
        return $this->errors;
    }

    public static function badRequest(string $m = 'Bad request', array $e = []): self { return new self($m, 400, $e); }
    public static function unauthorized(string $m = 'Unauthenticated'): self { return new self($m, 401); }
    public static function forbidden(string $m = 'You do not have permission to perform this action'): self { return new self($m, 403); }
    public static function notFound(string $m = 'Resource not found'): self { return new self($m, 404); }
    public static function conflict(string $m, array $e = []): self { return new self($m, 409, $e); }
    public static function validation(array $errors, string $m = 'The given data was invalid'): self { return new self($m, 422, $errors); }
    public static function tooMany(string $m): self { return new self($m, 429); }
}

/** Cast numeric DB columns for JSON output. */
function cast_row(?array $row, array $ints = [], array $floats = [], array $bools = []): ?array
{
    if ($row === null) {
        return null;
    }
    foreach ($ints as $k) {
        if (array_key_exists($k, $row) && $row[$k] !== null) $row[$k] = (int) $row[$k];
    }
    foreach ($floats as $k) {
        if (array_key_exists($k, $row) && $row[$k] !== null) $row[$k] = (float) $row[$k];
    }
    foreach ($bools as $k) {
        if (array_key_exists($k, $row) && $row[$k] !== null) $row[$k] = (bool) $row[$k];
    }
    return $row;
}

function cast_rows(array $rows, array $ints = [], array $floats = [], array $bools = []): array
{
    return array_map(fn ($r) => cast_row($r, $ints, $floats, $bools), $rows);
}

/** Money helpers — arithmetic happens in integer paisa to avoid float drift. */
function to_paisa(float|int|string|null $amount): int
{
    return (int) round(((float) ($amount ?? 0)) * 100);
}

function from_paisa(int $paisa): float
{
    return round($paisa / 100, 2);
}

/** Build a paginated payload. */
function paginated(array $items, int $total, int $page, int $perPage): array
{
    return [
        'items' => $items,
        'pagination' => [
            'page'        => $page,
            'per_page'    => $perPage,
            'total'       => $total,
            'total_pages' => max(1, (int) ceil($total / max(1, $perPage))),
        ],
    ];
}

/** Real client IP; honours X-Forwarded-For only when TRUST_PROXY=true. */
function client_ip(): string
{
    if (Config::get('trust_proxy') && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $first = trim(explode(',', (string) $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
        if (filter_var($first, FILTER_VALIDATE_IP)) {
            return $first;
        }
    }
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

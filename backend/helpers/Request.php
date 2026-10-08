<?php
declare(strict_types=1);

final class Request
{
    /** Authenticated user row (set by AuthMiddleware). */
    public ?array $user = null;

    public function __construct(
        public string $method,
        public string $path,
        public array $query,
        public array $body,
        public array $files,
        public array $headers,
    ) {
    }

    public static function capture(): self
    {
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

        // Support deployment in a sub-directory (e.g. /cafe/backend/public/api/...)
        $scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
        if ($scriptDir !== '' && str_starts_with($path, $scriptDir)) {
            $path = substr($path, strlen($scriptDir)) ?: '/';
        }
        $path = '/' . trim($path, '/');

        $headers = [];
        foreach ($_SERVER as $k => $v) {
            if (str_starts_with($k, 'HTTP_')) {
                $headers[strtolower(str_replace('_', '-', substr($k, 5)))] = $v;
            }
        }
        if (isset($_SERVER['CONTENT_TYPE'])) {
            $headers['content-type'] = $_SERVER['CONTENT_TYPE'];
        }

        $body = [];
        if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            $contentType = strtolower($headers['content-type'] ?? '');
            if (str_contains($contentType, 'application/json')) {
                $raw = file_get_contents('php://input') ?: '';
                if (trim($raw) !== '') {
                    $decoded = json_decode($raw, true);
                    if (!is_array($decoded)) {
                        throw HttpException::badRequest('Malformed JSON request body');
                    }
                    $body = $decoded;
                }
            } else {
                $body = $_POST;
            }
        }

        return new self($method, $path, $_GET, $body, $_FILES, $headers);
    }

    public function input(string $key, mixed $default = null): mixed
    {
        return $this->body[$key] ?? $default;
    }

    public function query(string $key, mixed $default = null): mixed
    {
        $v = $this->query[$key] ?? $default;
        return is_string($v) ? trim($v) : $v;
    }

    public function header(string $name): ?string
    {
        return $this->headers[strtolower($name)] ?? null;
    }

    public function ip(): string
    {
        return client_ip();
    }

    public function userAgent(): string
    {
        return substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255);
    }

    public function userId(): int
    {
        return (int) ($this->user['id'] ?? 0);
    }

    public function isAdmin(): bool
    {
        return ($this->user['role'] ?? null) === 'SUPERADMIN';
    }

    /** @return array{0:int,1:int,2:int} [page, perPage, offset] */
    public function pagination(int $defaultPerPage = 20, int $maxPerPage = 100): array
    {
        $page = max(1, (int) ($this->query['page'] ?? 1));
        $perPage = (int) ($this->query['per_page'] ?? $defaultPerPage);
        $perPage = min($maxPerPage, max(1, $perPage));
        return [$page, $perPage, ($page - 1) * $perPage];
    }
}

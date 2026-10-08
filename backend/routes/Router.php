<?php
declare(strict_types=1);

/**
 * Minimal REST router with middleware groups.
 *
 *   $r->group(['auth', 'role:SUPERADMIN'], function (Router $r) {
 *       $r->get('/api/staff', [StaffController::class, 'index']);
 *   });
 *
 * Path params: {id} matches digits; {slug} matches [A-Za-z0-9_-]+.
 */
final class Router
{
    private array $routes = [];
    private array $groupStack = [];

    public function get(string $path, array $handler): void { $this->add('GET', $path, $handler); }
    public function post(string $path, array $handler): void { $this->add('POST', $path, $handler); }
    public function put(string $path, array $handler): void { $this->add('PUT', $path, $handler); }
    public function patch(string $path, array $handler): void { $this->add('PATCH', $path, $handler); }
    public function delete(string $path, array $handler): void { $this->add('DELETE', $path, $handler); }

    public function group(array $middleware, callable $callback): void
    {
        $this->groupStack[] = $middleware;
        $callback($this);
        array_pop($this->groupStack);
    }

    private function add(string $method, string $path, array $handler): void
    {
        $regex = preg_replace(
            ['#\{id\}#', '#\{([a-z_]+)\}#'],
            ['(\d+)', '([A-Za-z0-9_-]+)'],
            rtrim($path, '/') ?: '/'
        );
        $this->routes[] = [
            'method'     => $method,
            'regex'      => '#^' . $regex . '$#',
            'handler'    => $handler,
            'middleware' => array_merge(...($this->groupStack ?: [[]])),
        ];
    }

    public function dispatch(Request $request): void
    {
        $allowed = [];
        foreach ($this->routes as $route) {
            if (!preg_match($route['regex'], $request->path, $m)) {
                continue;
            }
            if ($route['method'] !== $request->method) {
                $allowed[] = $route['method'];
                continue;
            }

            foreach ($route['middleware'] as $mw) {
                [$name, $param] = array_pad(explode(':', $mw, 2), 2, null);
                match ($name) {
                    'auth' => AuthMiddleware::handle($request),
                    'role' => RoleMiddleware::handle($request, explode(',', (string) $param)),
                    default => throw new LogicException("Unknown middleware {$name}"),
                };
            }

            [$class, $method] = $route['handler'];
            $params = array_map('intval', array_slice($m, 1));
            (new $class())->{$method}($request, ...$params);
            return;
        }

        if ($allowed) {
            header('Allow: ' . implode(', ', array_unique($allowed)));
            throw new HttpException('Method not allowed', 405);
        }
        throw HttpException::notFound('Endpoint not found');
    }
}

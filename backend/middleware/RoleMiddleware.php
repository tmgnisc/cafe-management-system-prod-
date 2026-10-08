<?php
declare(strict_types=1);

/**
 * Server-side role authorization. Must run after AuthMiddleware.
 */
final class RoleMiddleware
{
    /** @param string[] $roles */
    public static function handle(Request $request, array $roles): void
    {
        if ($request->user === null) {
            throw HttpException::unauthorized();
        }
        if (!in_array($request->user['role'], $roles, true)) {
            throw HttpException::forbidden('You do not have permission to access this resource');
        }
    }
}

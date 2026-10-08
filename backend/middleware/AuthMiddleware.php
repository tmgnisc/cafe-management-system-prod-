<?php
declare(strict_types=1);

/**
 * Requires a valid session whose user still exists and is ACTIVE.
 * The user row is re-read from the database on every request, so a
 * deactivated staff member or a changed role takes effect immediately.
 * Also enforces the CSRF header on state-changing requests.
 */
final class AuthMiddleware
{
    public static function handle(Request $request): void
    {
        $userId = Auth::userId();
        if ($userId === null) {
            throw HttpException::unauthorized('Please log in to continue');
        }

        $user = User::findActive($userId);
        if ($user === null) {
            Auth::destroy();
            throw HttpException::unauthorized('Your session is no longer valid. Please log in again');
        }

        if (in_array($request->method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)
            && !Auth::verifyCsrf($request->header('X-CSRF-Token'))) {
            throw new HttpException('Invalid or missing CSRF token. Refresh the page and try again', 419);
        }

        $request->user = $user;
    }
}

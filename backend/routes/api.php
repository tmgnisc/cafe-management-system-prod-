<?php
declare(strict_types=1);

/**
 * API routes. Authorization is enforced HERE (server side) for every endpoint:
 *   'auth'             → valid session + active user + CSRF on writes
 *   'role:SUPERADMIN'  → admin-only
 */

$r = new Router();

$r->get('/api/health', [HealthController::class, 'index']);

// ---------------------------------------------------------------- Auth
$r->post('/api/auth/login', [AuthController::class, 'login']);
$r->post('/api/auth/logout', [AuthController::class, 'logout']);

// ------------------------------------------------- Any authenticated user (STAFF + SUPERADMIN)
$r->group(['auth'], function (Router $r) {
    $r->get('/api/auth/me', [AuthController::class, 'me']);
    $r->put('/api/auth/password', [AuthController::class, 'changePassword']);
    $r->put('/api/auth/profile', [AuthController::class, 'updateProfile']);

    // POS reads
    $r->get('/api/tables', [TableController::class, 'index']);
    $r->get('/api/tables/{id}', [TableController::class, 'show']);
    $r->post('/api/tables/{id}/status', [TableController::class, 'setStatus']);
    $r->get('/api/categories', [CategoryController::class, 'index']);
    $r->get('/api/menu', [MenuItemController::class, 'index']);
    $r->get('/api/menu/{id}', [MenuItemController::class, 'show']);
    $r->get('/api/settings', [SettingsController::class, 'index']);

    // Orders, billing & payment
    $r->get('/api/orders', [OrderController::class, 'index']);
    $r->post('/api/orders', [OrderController::class, 'store']);
    $r->get('/api/orders/{id}', [OrderController::class, 'show']);
    $r->put('/api/orders/{id}', [OrderController::class, 'update']);
    $r->post('/api/orders/{id}/send', [OrderController::class, 'send']);
    $r->post('/api/orders/{id}/status', [OrderController::class, 'status']);
    $r->post('/api/orders/{id}/discount', [OrderController::class, 'discount']);
    $r->post('/api/orders/{id}/cancel', [OrderController::class, 'cancel']);
    $r->get('/api/orders/{id}/receipt', [OrderController::class, 'receipt']);
    $r->get('/api/orders/{id}/payment', [PaymentController::class, 'show']);
    $r->post('/api/orders/{id}/payment', [PaymentController::class, 'store']);
    $r->post('/api/orders/{id}/complete', [PaymentController::class, 'store']);
});

// ------------------------------------------------------------- SUPERADMIN only
$r->group(['auth', 'role:SUPERADMIN'], function (Router $r) {
    // Staff
    $r->get('/api/staff', [StaffController::class, 'index']);
    $r->post('/api/staff', [StaffController::class, 'store']);
    $r->get('/api/staff/{id}', [StaffController::class, 'show']);
    $r->put('/api/staff/{id}', [StaffController::class, 'update']);
    $r->delete('/api/staff/{id}', [StaffController::class, 'destroy']);
    $r->post('/api/staff/{id}/reset-password', [StaffController::class, 'resetPassword']);

    // Tables
    $r->post('/api/tables', [TableController::class, 'store']);
    $r->put('/api/tables/{id}', [TableController::class, 'update']);
    $r->delete('/api/tables/{id}', [TableController::class, 'destroy']);

    // Categories
    $r->get('/api/categories/{id}', [CategoryController::class, 'show']);
    $r->post('/api/categories', [CategoryController::class, 'store']);
    $r->put('/api/categories/{id}', [CategoryController::class, 'update']);
    $r->delete('/api/categories/{id}', [CategoryController::class, 'destroy']);

    // Menu & recipes
    $r->post('/api/menu', [MenuItemController::class, 'store']);
    $r->put('/api/menu/{id}', [MenuItemController::class, 'update']);
    $r->delete('/api/menu/{id}', [MenuItemController::class, 'destroy']);
    $r->get('/api/menu/{id}/recipe', [MenuItemController::class, 'recipe']);
    $r->put('/api/menu/{id}/recipe', [MenuItemController::class, 'saveRecipe']);
    $r->get('/api/recipes', [MenuItemController::class, 'recipes']);

    // Inventory
    $r->get('/api/inventory', [InventoryController::class, 'index']);
    $r->get('/api/inventory/options', [InventoryController::class, 'options']);
    $r->get('/api/inventory/movements', [InventoryController::class, 'allMovements']);
    $r->post('/api/inventory', [InventoryController::class, 'store']);
    $r->get('/api/inventory/{id}', [InventoryController::class, 'show']);
    $r->put('/api/inventory/{id}', [InventoryController::class, 'update']);
    $r->delete('/api/inventory/{id}', [InventoryController::class, 'destroy']);
    $r->post('/api/inventory/{id}/adjust', [InventoryController::class, 'adjust']);
    $r->get('/api/inventory/{id}/movements', [InventoryController::class, 'movements']);

    // Reports
    $r->get('/api/reports/dashboard', [ReportController::class, 'dashboard']);
    $r->get('/api/reports/sales', [ReportController::class, 'sales']);
    $r->get('/api/reports/top-items', [ReportController::class, 'topItems']);

    // Settings, audit, uploads
    $r->put('/api/settings', [SettingsController::class, 'update']);
    $r->get('/api/audit-logs', [AuditLogController::class, 'index']);
    $r->post('/api/uploads', [UploadController::class, 'store']);
});

return $r;

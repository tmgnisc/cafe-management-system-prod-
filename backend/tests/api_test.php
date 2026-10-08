<?php
declare(strict_types=1);

/**
 * End-to-end API test-suite (real HTTP, real MySQL).
 *
 *   ./backend/tests/run.sh          # installs a clean `cafe_test` DB, starts a server, runs this file
 *
 * or manually:
 *   DB_DATABASE=cafe_test php backend/database/install.php --base-only
 *   DB_DATABASE=cafe_test php -S 127.0.0.1:8001 -t backend/public backend/public/index.php
 *   API=http://127.0.0.1:8001 DB_DATABASE=cafe_test php backend/tests/api_test.php
 */

require dirname(__DIR__) . '/bootstrap.php';

$API = getenv('API') ?: 'http://127.0.0.1:8001';
const ORIGIN = 'http://localhost:3000';

final class Client
{
    private string $jar;
    public ?string $csrf = null;

    public function __construct(private string $base)
    {
        $this->jar = tempnam(sys_get_temp_dir(), 'cafe_jar_');
    }

    public function call(string $method, string $path, ?array $body = null, bool $withCsrf = true): array
    {
        $ch = curl_init($this->base . $path);
        $headers = ['Accept: application/json', 'Origin: ' . ORIGIN];
        if ($body !== null) {
            $headers[] = 'Content-Type: application/json';
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        }
        if ($withCsrf && $this->csrf) {
            $headers[] = 'X-CSRF-Token: ' . $this->csrf;
        }
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_COOKIEJAR      => $this->jar,
            CURLOPT_COOKIEFILE     => $this->jar,
            CURLOPT_HEADER         => true,
        ]);
        $raw = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $hsize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        curl_close($ch);
        $json = json_decode(substr($raw, $hsize), true);
        return ['status' => $status, 'headers' => substr($raw, 0, $hsize), 'json' => $json, 'data' => $json['data'] ?? null];
    }

    public function login(string $email, string $password): array
    {
        $r = $this->call('POST', '/api/auth/login', ['email' => $email, 'password' => $password]);
        $this->csrf = $r['data']['csrf_token'] ?? null;
        return $r;
    }
}

$pass = 0;
$fail = 0;
function check(string $name, bool $ok, string $detail = ''): void
{
    global $pass, $fail;
    if ($ok) {
        $pass++;
        echo "  \033[32m✓\033[0m {$name}\n";
    } else {
        $fail++;
        echo "  \033[31m✗ {$name}\033[0m" . ($detail ? "  — {$detail}" : '') . "\n";
    }
}
function expect(string $name, array $res, int $status): array
{
    check("{$name} → {$status}", $res['status'] === $status, "got {$res['status']}: " . json_encode($res['json']));
    return $res;
}
function section(string $t): void
{
    echo "\n\033[1m{$t}\033[0m\n";
}
function qty(string $name): float
{
    return (float) Database::value('SELECT current_quantity FROM inventory_items WHERE name = ? ORDER BY id DESC LIMIT 1', [$name]);
}

$admin = new Client($API);
$staff = new Client($API);
$anon = new Client($API);

// ---------------------------------------------------------------------------
section('Health, CORS & authentication');
expect('health', $anon->call('GET', '/api/health'), 200);
$r = $anon->call('GET', '/api/health');
check('CORS echoes allowed origin (no wildcard)', str_contains($r['headers'], 'Access-Control-Allow-Origin: ' . ORIGIN) && !str_contains($r['headers'], 'Allow-Origin: *'));
$ch = curl_init($API . '/api/health');
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HEADER => true, CURLOPT_HTTPHEADER => ['Origin: https://evil.example']]);
$h = curl_exec($ch);
check('CORS ignores unknown origin', !str_contains($h, 'Access-Control-Allow-Origin'));
expect('unauthenticated /me', $anon->call('GET', '/api/auth/me'), 401);
expect('unauthenticated orders', $anon->call('GET', '/api/orders'), 401);
expect('login validation', $anon->call('POST', '/api/auth/login', ['email' => 'not-an-email']), 422);
expect('wrong password', $anon->call('POST', '/api/auth/login', ['email' => 'admin@ishascozycafe.com', 'password' => 'nope12345']), 401);
$r = expect('admin login', $admin->login('admin@ishascozycafe.com', 'IshaAdmin@2026'), 200);
check('login returns user without password', ($r['data']['user']['role'] ?? '') === 'SUPERADMIN' && !isset($r['data']['user']['password']));
check('session cookie is HttpOnly + SameSite', (bool) preg_match('/Set-Cookie: ISHACAFE_SESSION=.*HttpOnly.*SameSite=Lax/i', $r['headers']));
expect('admin /me', $admin->call('GET', '/api/auth/me'), 200);
expect('write without CSRF token rejected', $admin->call('POST', '/api/tables', ['table_number' => '99', 'capacity' => 2, 'section' => 'Indoor'], false), 419);

// ---------------------------------------------------------------------------
section('§51 Acceptance test — admin setup (steps 1-7)');
$t = expect('2. create Table 01', $admin->call('POST', '/api/tables', ['table_number' => '01', 'name' => 'Table 01', 'capacity' => 2, 'section' => 'Indoor']), 201)['data'];
$tableId = $t['id'];
expect('duplicate table number', $admin->call('POST', '/api/tables', ['table_number' => '01', 'capacity' => 2, 'section' => 'Indoor']), 422);
$cat = expect('3. create Coffee category', $admin->call('POST', '/api/categories', ['name' => 'Coffee', 'sort_order' => 1]), 201)['data'];
$cap = expect('4. create Cappuccino Rs. 180', $admin->call('POST', '/api/menu', [
    'category_id' => $cat['id'], 'name' => 'Cappuccino', 'sku' => 'COF-CAP', 'selling_price' => 180, 'cost_price' => 60, 'track_inventory' => true,
]), 201)['data'];
expect('menu validation (negative price)', $admin->call('POST', '/api/menu', ['category_id' => $cat['id'], 'name' => 'X', 'sku' => 'X1', 'selling_price' => -5]), 422);
$beans = expect('5. create inventory Coffee Beans (1000 g)', $admin->call('POST', '/api/inventory', [
    'name' => 'Coffee Beans', 'sku' => 'INV-COF', 'unit' => 'g', 'current_quantity' => 1000, 'minimum_quantity' => 200, 'cost_per_unit' => 2.2,
]), 201)['data'];
$milk = expect('5. create inventory Milk (5 liter)', $admin->call('POST', '/api/inventory', [
    'name' => 'Milk', 'sku' => 'INV-MLK', 'unit' => 'liter', 'current_quantity' => 5, 'minimum_quantity' => 1, 'cost_per_unit' => 110,
]), 201)['data'];
check('opening stock created INITIAL_STOCK movements', (int) Database::value("SELECT COUNT(*) FROM stock_movements WHERE type='INITIAL_STOCK'") === 2);
expect('recipe rejects incompatible unit (ml for grams)', $admin->call('PUT', "/api/menu/{$cap['id']}/recipe", ['items' => [
    ['inventory_item_id' => $beans['id'], 'quantity' => 18, 'unit' => 'ml'],
]]), 422);
$rec = expect('6. recipe: 18 g beans + 150 ml milk', $admin->call('PUT', "/api/menu/{$cap['id']}/recipe", ['items' => [
    ['inventory_item_id' => $beans['id'], 'quantity' => 18, 'unit' => 'g'],
    ['inventory_item_id' => $milk['id'], 'quantity' => 150, 'unit' => 'ml'],
]]), 200)['data'];
check('recipe has 2 ingredients', count($rec['items']) === 2);
$newStaff = expect('7. create staff account', $admin->call('POST', '/api/staff', [
    'name' => 'Sita Rai', 'email' => 'sita@ishascozycafe.com', 'password' => 'SitaPass2026', 'password_confirmation' => 'SitaPass2026', 'role' => 'STAFF',
]), 201)['data'];
expect('staff password confirmation mismatch', $admin->call('POST', '/api/staff', [
    'name' => 'X', 'email' => 'x@x.com', 'password' => 'abcdefg12', 'password_confirmation' => 'zzz', 'role' => 'STAFF',
]), 422);
$audit = Database::value("SELECT CONCAT(COALESCE(old_values,''), COALESCE(new_values,'')) FROM audit_logs WHERE action='STAFF_CREATED' ORDER BY id DESC LIMIT 1");
check('audit log never stores passwords', !str_contains((string) $audit, 'SitaPass2026') && !str_contains((string) $audit, 'password'));
expect('8. admin logout', $admin->call('POST', '/api/auth/logout'), 200);
expect('after logout /me', $admin->call('GET', '/api/auth/me'), 401);

// ---------------------------------------------------------------------------
section('Staff authorization (backend-enforced)');
expect('9. staff login', $staff->login('sita@ishascozycafe.com', 'SitaPass2026'), 200);
expect('staff → GET /api/staff', $staff->call('GET', '/api/staff'), 403);
expect('staff → POST /api/staff', $staff->call('POST', '/api/staff', ['name' => 'Hacker', 'email' => 'h@h.com', 'password' => 'abc12345', 'password_confirmation' => 'abc12345', 'role' => 'SUPERADMIN']), 403);
expect('staff → GET /api/inventory', $staff->call('GET', '/api/inventory'), 403);
expect('staff → POST /api/inventory/{id}/adjust', $staff->call('POST', "/api/inventory/{$beans['id']}/adjust", ['type' => 'PURCHASE', 'quantity' => 5]), 403);
expect('staff → PUT /api/settings', $staff->call('PUT', '/api/settings', ['tax_rate' => 0]), 403);
expect('staff → GET /api/reports/dashboard', $staff->call('GET', '/api/reports/dashboard'), 403);
expect('staff → POST /api/tables', $staff->call('POST', '/api/tables', ['table_number' => '77', 'capacity' => 2, 'section' => 'Indoor']), 403);
expect('staff → PUT /api/menu/{id} (price change)', $staff->call('PUT', "/api/menu/{$cap['id']}", ['selling_price' => 1]), 403);
expect('staff → GET /api/audit-logs', $staff->call('GET', '/api/audit-logs'), 403);
expect('staff can read tables', $staff->call('GET', '/api/tables'), 200);
expect('staff can read menu', $staff->call('GET', '/api/menu?pos=1'), 200);
expect('staff can read settings', $staff->call('GET', '/api/settings'), 200);

// ---------------------------------------------------------------------------
section('§51 Acceptance test — staff order, bill, payment (steps 10-22)');
$beans0 = qty('Coffee Beans');
$milk0 = qty('Milk');
$order = expect('10-13. create order: Cappuccino x2, note "Less sugar", send', $staff->call('POST', '/api/orders', [
    'table_id' => $tableId, 'send' => true,
    'items'    => [['menu_item_id' => $cap['id'], 'quantity' => 2, 'notes' => 'Less sugar']],
]), 201)['data'];
$oid = $order['id'];
check('order number format ORD-YYYYMMDD-NNN', (bool) preg_match('/^ORD-\d{8}-\d{3}$/', $order['order_number']), $order['order_number']);
check('order status PENDING', $order['status'] === 'PENDING');
check('line note stored', $order['items'][0]['notes'] === 'Less sugar');
check('Table 01 = OCCUPIED', $staff->call('GET', "/api/tables/{$tableId}")['data']['status'] === 'OCCUPIED');
expect('second order on occupied table rejected', $staff->call('POST', '/api/orders', ['table_id' => $tableId, 'items' => [['menu_item_id' => $cap['id'], 'quantity' => 1]]]), 409);
$bill = expect('14. open bill', $staff->call('GET', "/api/orders/{$oid}"), 200)['data'];
check('Subtotal = Rs. 360', $bill['subtotal'] === 360.0, (string) $bill['subtotal']);
check('stock untouched before payment', qty('Coffee Beans') === $beans0 && qty('Milk') === $milk0);

expect('discount > 100% rejected', $staff->call('POST', "/api/orders/{$oid}/discount", ['discount_type' => 'PERCENTAGE', 'discount_value' => 150]), 422);
expect('fixed discount > subtotal rejected', $staff->call('POST', "/api/orders/{$oid}/discount", ['discount_type' => 'FIXED', 'discount_value' => 400]), 422);
expect('staff discount above max (15%) rejected', $staff->call('POST', "/api/orders/{$oid}/discount", ['discount_type' => 'PERCENTAGE', 'discount_value' => 20]), 403);
$bill = expect('15. apply 10% discount', $staff->call('POST', "/api/orders/{$oid}/discount", ['discount_type' => 'PERCENTAGE', 'discount_value' => 10]), 200)['data'];
check('Discount = Rs. 36', $bill['discount_amount'] === 36.0, (string) $bill['discount_amount']);
check('Total = Rs. 324', $bill['grand_total'] === 324.0, (string) $bill['grand_total']);
check('discount_applied_by recorded', $bill['discount_applied_by'] === $newStaff['id']);

expect('cash below total rejected', $staff->call('POST', "/api/orders/{$oid}/payment", ['method' => 'CASH', 'amount' => 300]), 422);
expect('eSewa amount must equal total', $staff->call('POST', "/api/orders/{$oid}/payment", ['method' => 'ESEWA', 'amount' => 500]), 422);
expect('stale expected_total rejected', $staff->call('POST', "/api/orders/{$oid}/payment", ['method' => 'CASH', 'amount' => 500, 'expected_total' => 360]), 409);
check('failed payments left no trace', !Database::value('SELECT 1 FROM payments WHERE order_id = ?', [$oid]) && qty('Coffee Beans') === $beans0);

$paid = expect('16-17. pay CASH (Rs. 500 tendered)', $staff->call('POST', "/api/orders/{$oid}/payment", ['method' => 'CASH', 'amount' => 500, 'expected_total' => 324]), 200)['data'];
check('Order = COMPLETED', $paid['status'] === 'COMPLETED');
check('Payment = PAID', $paid['payment_status'] === 'PAID' && $paid['payment']['status'] === 'PAID' && $paid['payment']['amount'] === 324.0);
check('change returned = Rs. 176', $paid['change_amount'] === 176.0, (string) $paid['change_amount']);
check('Table 01 = AVAILABLE', $staff->call('GET', "/api/tables/{$tableId}")['data']['status'] === 'AVAILABLE');
check('Coffee Beans −36 g', abs(($beans0 - qty('Coffee Beans')) - 36) < 0.0001, (string) ($beans0 - qty('Coffee Beans')));
check('Milk −300 ml (0.3 liter)', abs(($milk0 - qty('Milk')) - 0.3) < 0.0001, (string) ($milk0 - qty('Milk')));

$moves = Database::fetchAll("SELECT * FROM stock_movements WHERE reference_type='ORDER' AND reference_id = ? AND type='SALE'", [$oid]);
check('18. two SALE stock movements recorded', count($moves) === 2);
$okMoves = true;
foreach ($moves as $m) {
    $okMoves = $okMoves && abs((float) $m['previous_quantity'] + (float) $m['quantity'] - (float) $m['new_quantity']) < 0.0001;
}
check('movements: previous + quantity = new', $okMoves);

$admin->login('admin@ishascozycafe.com', 'IshaAdmin@2026');
$dash = expect('19. dashboard', $admin->call('GET', '/api/reports/dashboard'), 200)['data'];
check("dashboard today's sales = Rs. 324", $dash['today']['total_collected'] === 324.0 && $dash['today']['orders'] === 1, json_encode($dash['today']));
check('dashboard payment methods: CASH 324', array_values(array_filter($dash['payment_methods'], fn ($p) => $p['method'] === 'CASH'))[0]['amount'] === 324.0);
$sales = expect('reports/sales today', $admin->call('GET', '/api/reports/sales?preset=today'), 200)['data'];
check('gross 360 / discount 36 / net 324', $sales['summary']['gross_sales'] === 360.0 && $sales['summary']['discount'] === 36.0 && $sales['summary']['net_sales'] === 324.0);
expect('reports/top-items', $admin->call('GET', '/api/reports/top-items?preset=month'), 200);
expect('reports custom range validation', $admin->call('GET', '/api/reports/sales?preset=custom&from=2026-10-10&to=2026-10-01'), 422);

$receipt = expect('20. receipt data', $staff->call('GET', "/api/orders/{$oid}/receipt"), 200)['data'];
check('receipt has cafe name + lines', $receipt['cafe']['name'] === "Isha's Cozy Cafe" && count($receipt['order']['items']) === 1);

expect('21. edit completed order rejected', $staff->call('PUT', "/api/orders/{$oid}", ['items' => [['menu_item_id' => $cap['id'], 'quantity' => 5]]]), 409);
expect('21. discount on completed order rejected', $staff->call('POST', "/api/orders/{$oid}/discount", ['discount_type' => 'FIXED', 'discount_value' => 10]), 409);
expect('21. cancel completed order rejected', $staff->call('POST', "/api/orders/{$oid}/cancel", ['reason' => 'test cancel']), 409);
expect('21. admin cannot edit completed order either', $admin->call('PUT', "/api/orders/{$oid}", ['notes' => 'x']), 409);
expect('22. pay again rejected', $staff->call('POST', "/api/orders/{$oid}/payment", ['method' => 'CASH', 'amount' => 500]), 409);
expect('22. /complete again rejected', $staff->call('POST', "/api/orders/{$oid}/complete", ['method' => 'CARD']), 409);
check('still exactly one payment', (int) Database::value('SELECT COUNT(*) FROM payments WHERE order_id = ?', [$oid]) === 1);
check('no duplicate inventory deduction', (int) Database::value("SELECT COUNT(*) FROM stock_movements WHERE reference_type='ORDER' AND reference_id = ?", [$oid]) === 2
    && abs(($beans0 - qty('Coffee Beans')) - 36) < 0.0001);

// Direct service-level idempotency check (same transaction guard used by payment)
Database::transaction(fn () => InventoryService::deductForOrder($oid, 1));
check('InventoryService::deductForOrder is idempotent', abs(($beans0 - qty('Coffee Beans')) - 36) < 0.0001);

// ---------------------------------------------------------------------------
section('Multiple items, quantity changes, price snapshots, cancel');
$cat2 = $admin->call('POST', '/api/categories', ['name' => 'Snacks'])['data'];
$fries = $admin->call('POST', '/api/menu', ['category_id' => $cat2['id'], 'name' => 'French Fries', 'sku' => 'SNK-FRY', 'selling_price' => 180])['data'];
$t2 = $admin->call('POST', '/api/tables', ['table_number' => '02', 'capacity' => 4, 'section' => 'Outdoor'])['data'];
$o2 = expect('draft order with 2 items (Save, not sent)', $staff->call('POST', '/api/orders', [
    'table_id' => $t2['id'], 'send' => false,
    'items'    => [['menu_item_id' => $cap['id'], 'quantity' => 1], ['menu_item_id' => $fries['id'], 'quantity' => 2]],
]), 201)['data'];
check('draft status + subtotal 540', $o2['status'] === 'DRAFT' && $o2['subtotal'] === 540.0);
check('Table 02 occupied by draft', $staff->call('GET', "/api/tables/{$t2['id']}")['data']['status'] === 'OCCUPIED');
expect('status change before send rejected', $staff->call('POST', "/api/orders/{$o2['id']}/status", ['status' => 'SERVED']), 409);

$admin->call('PUT', "/api/menu/{$cap['id']}", ['selling_price' => 220]);
check('MENU_PRICE_CHANGED audited', (bool) Database::value("SELECT 1 FROM audit_logs WHERE action='MENU_PRICE_CHANGED'"));
$capLine = $o2['items'][0];
$friesLine = $o2['items'][1];
$o2 = expect('change qty + add new Cappuccino line', $staff->call('PUT', "/api/orders/{$o2['id']}", ['items' => [
    ['id' => $capLine['id'], 'menu_item_id' => $cap['id'], 'quantity' => 3, 'notes' => 'Extra hot'],
    ['id' => $friesLine['id'], 'menu_item_id' => $fries['id'], 'quantity' => 2],
    ['menu_item_id' => $cap['id'], 'quantity' => 1],
]]), 200)['data'];
check('existing line keeps snapshot price Rs. 180', $o2['items'][0]['unit_price'] === 180.0 && $o2['items'][0]['quantity'] === 3);
check('new line uses current price Rs. 220', $o2['items'][2]['unit_price'] === 220.0);
check('subtotal = 3×180 + 2×180 + 220 = 1120', $o2['subtotal'] === 1120.0, (string) $o2['subtotal']);
check('historical completed order still Rs. 180', $staff->call('GET', "/api/orders/{$oid}")['data']['items'][0]['unit_price'] === 180.0);
$o2 = expect('remove fries line', $staff->call('PUT', "/api/orders/{$o2['id']}", ['items' => [
    ['id' => $o2['items'][0]['id'], 'menu_item_id' => $cap['id'], 'quantity' => 3],
    ['id' => $o2['items'][2]['id'], 'menu_item_id' => $cap['id'], 'quantity' => 1],
]]), 200)['data'];
check('subtotal = 760 after removal', $o2['subtotal'] === 760.0);
expect('empty item list rejected', $staff->call('PUT', "/api/orders/{$o2['id']}", ['items' => []]), 422);
$o2 = expect('send order', $staff->call('POST', "/api/orders/{$o2['id']}/send"), 200)['data'];
check('sent → PENDING, no unsent lines', $o2['status'] === 'PENDING' && $o2['unsent_item_count'] === 0);
$o2 = expect('mark SERVED', $staff->call('POST', "/api/orders/{$o2['id']}/status", ['status' => 'SERVED']), 200)['data'];
check('served_at set', $o2['served_at'] !== null);
expect('cancel requires reason', $staff->call('POST', "/api/orders/{$o2['id']}/cancel", []), 422);
$o2 = expect('cancel order', $staff->call('POST', "/api/orders/{$o2['id']}/cancel", ['reason' => 'Customer changed mind']), 200)['data'];
check('cancelled + table released', $o2['status'] === 'CANCELLED' && $staff->call('GET', "/api/tables/{$t2['id']}")['data']['status'] === 'AVAILABLE');
check('cancelled order deducted no stock', (int) Database::value("SELECT COUNT(*) FROM stock_movements WHERE reference_id = ? AND reference_type='ORDER'", [$o2['id']]) === 0);
expect('pay cancelled order rejected', $staff->call('POST', "/api/orders/{$o2['id']}/payment", ['method' => 'CASH', 'amount' => 1000]), 409);

// ---------------------------------------------------------------------------
section('Tax / service charge billing');
$admin->call('PUT', '/api/settings', ['tax_rate' => 13, 'service_charge_rate' => 10, 'tax_on_service_charge' => true]);
$o3 = $staff->call('POST', '/api/orders', ['table_id' => $t2['id'], 'items' => [['menu_item_id' => $fries['id'], 'quantity' => 5]]])['data'];
$o3 = $staff->call('POST', "/api/orders/{$o3['id']}/discount", ['discount_type' => 'FIXED', 'discount_value' => 100])['data'];
// 900 - 100 = 800; SC 10% = 80; VAT 13% of 880 = 114.40; total 994.40
check('900 −100 +SC 80 +VAT 114.40 = 994.40', $o3['service_charge_amount'] === 80.0 && $o3['tax_amount'] === 114.4 && $o3['grand_total'] === 994.4, json_encode([$o3['service_charge_amount'], $o3['tax_amount'], $o3['grand_total']]));
$o3 = expect('pay by KHALTI exact amount', $staff->call('POST', "/api/orders/{$o3['id']}/payment", ['method' => 'KHALTI', 'amount' => 994.4, 'reference' => 'KH-123']), 200)['data'];
check('fries without recipe → no stock movement', count($o3['stock_movements']) === 0);
$admin->call('PUT', '/api/settings', ['tax_rate' => 0, 'service_charge_rate' => 0]);

// ---------------------------------------------------------------------------
section('Inventory adjustments & table / staff management');
$adj = expect('purchase +500 g beans', $admin->call('POST', "/api/inventory/{$beans['id']}/adjust", ['type' => 'PURCHASE', 'quantity' => 500, 'reason' => 'Delivery']), 200)['data'];
check('purchase movement recorded', $adj['movement']['new_quantity'] === $adj['movement']['previous_quantity'] + 500);
expect('waste needs reason', $admin->call('POST', "/api/inventory/{$beans['id']}/adjust", ['type' => 'WASTE', 'quantity' => 10]), 422);
expect('cannot adjust below zero', $admin->call('POST', "/api/inventory/{$beans['id']}/adjust", ['type' => 'ADJUSTMENT', 'quantity' => -999999, 'reason' => 'count']), 422);
expect('direct quantity edit blocked', $admin->call('PUT', "/api/inventory/{$beans['id']}", ['current_quantity' => 1]), 422);
$mv = expect('movement history', $admin->call('GET', "/api/inventory/{$beans['id']}/movements"), 200)['data'];
check('history: INITIAL + SALE + PURCHASE', count($mv['items']) === 3);
check('INVENTORY_ADJUSTED audited', (bool) Database::value("SELECT 1 FROM audit_logs WHERE action='INVENTORY_ADJUSTED'"));

$del = expect('delete table with history → deactivated', $admin->call('DELETE', "/api/tables/{$tableId}"), 200)['data'];
check('Table 01 is_active = 0, still exists', $del['is_active'] === false && $del['status'] === 'INACTIVE');
expect('order on inactive table rejected', $staff->call('POST', '/api/orders', ['table_id' => $tableId, 'items' => [['menu_item_id' => $cap['id'], 'quantity' => 1]]]), 422);
check('TABLE_DEACTIVATED audited', (bool) Database::value("SELECT 1 FROM audit_logs WHERE action='TABLE_DEACTIVATED'"));
$t9 = $admin->call('POST', '/api/tables', ['table_number' => '09', 'capacity' => 2, 'section' => 'Indoor'])['data'];
expect('delete unused table → removed', $admin->call('DELETE', "/api/tables/{$t9['id']}"), 200);
expect('deleted table 404', $admin->call('GET', "/api/tables/{$t9['id']}"), 404);
expect('staff can mark table CLEANING', $staff->call('POST', "/api/tables/{$t2['id']}/status", ['status' => 'CLEANING']), 200);

expect('deactivate staff', $admin->call('PUT', "/api/staff/{$newStaff['id']}", ['status' => 'INACTIVE']), 200);
expect('deactivated staff session is rejected immediately', $staff->call('GET', '/api/orders'), 401);
expect('deactivated staff cannot log in', (new Client($API))->login('sita@ishascozycafe.com', 'SitaPass2026'), 403);
expect('reset staff password', $admin->call('POST', "/api/staff/{$newStaff['id']}/reset-password", ['password' => 'NewPass2026', 'password_confirmation' => 'NewPass2026']), 200);
expect('admin cannot demote self', $admin->call('PUT', '/api/staff/1', ['role' => 'STAFF']), 409);
expect('admin cannot delete self', $admin->call('DELETE', '/api/staff/1'), 409);
$logs = expect('audit logs', $admin->call('GET', '/api/audit-logs?per_page=100'), 200)['data'];
$actions = array_unique(array_column($logs['items'], 'action'));
foreach (['ORDER_CREATED', 'ORDER_CANCELLED', 'PAYMENT_COMPLETED', 'DISCOUNT_APPLIED', 'STAFF_CREATED', 'MENU_PRICE_CHANGED', 'INVENTORY_ADJUSTED', 'TABLE_CREATED', 'TABLE_DEACTIVATED'] as $a) {
    check("audit contains {$a}", in_array($a, $actions, true));
}
check('pagination metadata present', isset($logs['pagination']['total'], $logs['pagination']['total_pages']));

section('Login throttling');
$x = new Client($API);
for ($i = 0; $i < 5; $i++) {
    $x->call('POST', '/api/auth/login', ['email' => 'staff@ishascozycafe.com', 'password' => 'wrong-pass-1']);
}
expect('6th attempt locked out', $x->call('POST', '/api/auth/login', ['email' => 'staff@ishascozycafe.com', 'password' => 'IshaStaff@2026']), 429);

echo "\n\033[1m{$pass} passed, {$fail} failed\033[0m\n";
exit($fail > 0 ? 1 : 0);

-- =====================================================================
-- Isha's Cozy Cafe — POS / Billing / Inventory schema
-- Database: cafe   (MySQL 5.7+ / MariaDB 10.3+, InnoDB, utf8mb4)
--
-- Note: the restaurant-table entity is stored in `cafe_tables` because
-- TABLES is a reserved word in MySQL.
--
-- Idempotent: safe to run on an existing database (CREATE TABLE IF NOT EXISTS).
-- To wipe everything use `php database/install.php --fresh`.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `cafe` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `cafe`;


-- ---------------------------------------------------------------------
-- Users (SUPERADMIN / STAFF)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL,
    phone         VARCHAR(30)  NULL,
    password      VARCHAR(255) NOT NULL,          -- password_hash() output
    role          ENUM('SUPERADMIN','STAFF') NOT NULL DEFAULT 'STAFF',
    status        ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    last_login    DATETIME NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_email (email),
    KEY idx_users_role_status (role, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_attempts (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email        VARCHAR(150) NOT NULL,
    ip_address   VARCHAR(45)  NOT NULL,
    attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_login_attempts_lookup (email, ip_address, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Restaurant tables
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cafe_tables (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    table_number  VARCHAR(10)  NOT NULL,
    name          VARCHAR(50)  NOT NULL,
    capacity      TINYINT UNSIGNED NOT NULL DEFAULT 2,
    section       VARCHAR(50)  NOT NULL DEFAULT 'Indoor',
    status        ENUM('AVAILABLE','OCCUPIED','RESERVED','CLEANING','INACTIVE') NOT NULL DEFAULT 'AVAILABLE',
    is_active     TINYINT(1) NOT NULL DEFAULT 1,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tables_number (table_number),
    KEY idx_tables_status (status, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Menu
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(80) NOT NULL,
    description  VARCHAR(255) NULL,
    sort_order   INT NOT NULL DEFAULT 0,
    is_active    TINYINT(1) NOT NULL DEFAULT 1,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_categories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS menu_items (
    id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_id      INT UNSIGNED NOT NULL,
    name             VARCHAR(120) NOT NULL,
    sku              VARCHAR(40)  NOT NULL,
    description      VARCHAR(500) NULL,
    image            VARCHAR(500) NULL,
    selling_price    DECIMAL(10,2) NOT NULL,
    cost_price       DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_available     TINYINT(1) NOT NULL DEFAULT 1,   -- toggled by admin (sold out, seasonal ...)
    track_inventory  TINYINT(1) NOT NULL DEFAULT 0,   -- deduct recipe ingredients on sale
    is_active        TINYINT(1) NOT NULL DEFAULT 1,   -- 0 = archived (soft-deleted)
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_menu_items_sku (sku),
    KEY idx_menu_items_category (category_id, is_active, is_available),
    CONSTRAINT fk_menu_items_category FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Inventory & recipes
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_items (
    id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name              VARCHAR(120) NOT NULL,
    sku               VARCHAR(40)  NOT NULL,
    unit              ENUM('kg','g','liter','ml','pcs','packet','bottle','box') NOT NULL,
    current_quantity  DECIMAL(14,3) NOT NULL DEFAULT 0,
    minimum_quantity  DECIMAL(14,3) NOT NULL DEFAULT 0,
    cost_per_unit     DECIMAL(10,2) NOT NULL DEFAULT 0,
    supplier          VARCHAR(150) NULL,
    is_active         TINYINT(1) NOT NULL DEFAULT 1,
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_inventory_sku (sku),
    KEY idx_inventory_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recipes (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    menu_item_id  INT UNSIGNED NOT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_recipes_menu_item (menu_item_id),
    CONSTRAINT fk_recipes_menu_item FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recipe_items (
    id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    recipe_id          INT UNSIGNED NOT NULL,
    inventory_item_id  INT UNSIGNED NOT NULL,
    quantity           DECIMAL(14,3) NOT NULL,          -- per ONE unit of the menu item
    unit               ENUM('kg','g','liter','ml','pcs','packet','bottle','box') NOT NULL,
    UNIQUE KEY uq_recipe_items (recipe_id, inventory_item_id),
    CONSTRAINT fk_recipe_items_recipe FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
    CONSTRAINT fk_recipe_items_inventory FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_sequences (
    seq_date     DATE PRIMARY KEY,
    last_number  INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
    id                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_number            VARCHAR(30) NOT NULL,
    table_id                INT UNSIGNED NOT NULL,
    status                  ENUM('DRAFT','PENDING','CONFIRMED','PREPARING','READY','SERVED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
    payment_status          ENUM('UNPAID','PAID') NOT NULL DEFAULT 'UNPAID',
    notes                   VARCHAR(500) NULL,
    subtotal                DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_type           ENUM('PERCENTAGE','FIXED') NULL,
    discount_value          DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_amount         DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_applied_by     INT UNSIGNED NULL,
    tax_rate                DECIMAL(5,2) NOT NULL DEFAULT 0,
    tax_amount              DECIMAL(12,2) NOT NULL DEFAULT 0,
    service_charge_rate     DECIMAL(5,2) NOT NULL DEFAULT 0,
    service_charge_amount   DECIMAL(12,2) NOT NULL DEFAULT 0,
    grand_total             DECIMAL(12,2) NOT NULL DEFAULT 0,
    inventory_deducted_at   DATETIME NULL,
    created_by              INT UNSIGNED NOT NULL,
    completed_by            INT UNSIGNED NULL,
    cancelled_by            INT UNSIGNED NULL,
    cancel_reason           VARCHAR(255) NULL,
    sent_at                 DATETIME NULL,
    served_at               DATETIME NULL,
    completed_at            DATETIME NULL,
    cancelled_at            DATETIME NULL,
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_orders_number (order_number),
    KEY idx_orders_table_status (table_id, status),
    KEY idx_orders_status_completed (status, completed_at),
    KEY idx_orders_created (created_at),
    CONSTRAINT fk_orders_table FOREIGN KEY (table_id) REFERENCES cafe_tables(id),
    CONSTRAINT fk_orders_created_by FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT fk_orders_completed_by FOREIGN KEY (completed_by) REFERENCES users(id),
    CONSTRAINT fk_orders_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users(id),
    CONSTRAINT fk_orders_discount_by FOREIGN KEY (discount_applied_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Historical rule: name / price / cost are SNAPSHOTS taken when the line is added.
CREATE TABLE IF NOT EXISTS order_items (
    id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id             INT UNSIGNED NOT NULL,
    menu_item_id         INT UNSIGNED NOT NULL,
    item_name_snapshot   VARCHAR(120) NOT NULL,
    category_snapshot    VARCHAR(80)  NULL,
    unit_price           DECIMAL(10,2) NOT NULL,
    cost_price_snapshot  DECIMAL(10,2) NOT NULL DEFAULT 0,
    quantity             INT UNSIGNED NOT NULL,
    line_total           DECIMAL(12,2) NOT NULL,
    notes                VARCHAR(255) NULL,
    sent_at              DATETIME NULL,
    created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_order_items_order (order_id),
    KEY idx_order_items_menu (menu_item_id),
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_order_items_menu FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One settled payment per order. The UNIQUE key is the DB-level duplicate-payment guard.
CREATE TABLE IF NOT EXISTS payments (
    id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id         INT UNSIGNED NOT NULL,
    amount           DECIMAL(12,2) NOT NULL,              -- amount applied to the bill
    tendered_amount  DECIMAL(12,2) NOT NULL,              -- cash handed over
    change_amount    DECIMAL(12,2) NOT NULL DEFAULT 0,
    method           ENUM('CASH','CARD','ESEWA','KHALTI','BANK_TRANSFER','OTHER') NOT NULL,
    status           ENUM('PAID','REFUNDED','FAILED') NOT NULL DEFAULT 'PAID',
    reference        VARCHAR(100) NULL,
    received_by      INT UNSIGNED NOT NULL,
    paid_at          DATETIME NOT NULL,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_payments_order (order_id),
    KEY idx_payments_method_paid (method, paid_at),
    CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id),
    CONSTRAINT fk_payments_user FOREIGN KEY (received_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Stock movements (every inventory change)
-- quantity is SIGNED: positive = stock in, negative = stock out
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_movements (
    id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    inventory_item_id  INT UNSIGNED NOT NULL,
    type               ENUM('INITIAL_STOCK','PURCHASE','SALE','ADJUSTMENT','WASTE','RETURN') NOT NULL,
    quantity           DECIMAL(14,3) NOT NULL,
    previous_quantity  DECIMAL(14,3) NOT NULL,
    new_quantity       DECIMAL(14,3) NOT NULL,
    reference_type     VARCHAR(30) NULL,
    reference_id       INT UNSIGNED NULL,
    reason             VARCHAR(255) NULL,
    created_by         INT UNSIGNED NULL,
    created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_stock_movements_item (inventory_item_id, created_at),
    KEY idx_stock_movements_reference (reference_type, reference_id, type),
    CONSTRAINT fk_stock_movements_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
    CONSTRAINT fk_stock_movements_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Audit log & settings
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id      INT UNSIGNED NULL,
    action       VARCHAR(60) NOT NULL,
    entity_type  VARCHAR(40) NULL,
    entity_id    INT UNSIGNED NULL,
    description  VARCHAR(500) NOT NULL,
    old_values   TEXT NULL,
    new_values   TEXT NULL,
    ip_address   VARCHAR(45) NULL,
    user_agent   VARCHAR(255) NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_audit_user (user_id, created_at),
    KEY idx_audit_action (action, created_at),
    KEY idx_audit_entity (entity_type, entity_id),
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    setting_key    VARCHAR(60) NOT NULL,
    setting_value  TEXT NULL,
    updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_settings_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- PHP sessions (stored in MySQL so they survive container redeploys)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
    id             VARCHAR(128) NOT NULL PRIMARY KEY,
    data           MEDIUMBLOB NOT NULL,
    last_activity  INT UNSIGNED NOT NULL,
    KEY idx_sessions_last_activity (last_activity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

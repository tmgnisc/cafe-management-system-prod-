-- =====================================================================
-- Base seed: default cafe settings (idempotent — existing values are kept).
-- No users here: install.php creates the single SUPERADMIN from
-- ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD when the users table is empty.
-- =====================================================================
USE `cafe`;

INSERT IGNORE INTO settings (setting_key, setting_value) VALUES
('cafe_name',                   'Isha''s Cozy Cafe'),
('address',                     'Jhamsikhel, Lalitpur, Nepal'),
('phone',                       '+977 1-5550123'),
('email',                       'hello@ishascozycafe.com'),
('logo',                        ''),
('pan_number',                  ''),
('currency',                    'NPR'),
('currency_symbol',             'Rs.'),
('tax_label',                   'VAT'),
('tax_rate',                    '0'),
('service_charge_rate',         '0'),
('tax_on_service_charge',       '1'),
('staff_discount_enabled',      '1'),
('max_staff_discount_percent',  '15'),
('allow_negative_stock',        '1'),
('table_status_after_payment',  'AVAILABLE'),
('receipt_footer',              'Thank you for visiting Isha''s Cozy Cafe!');

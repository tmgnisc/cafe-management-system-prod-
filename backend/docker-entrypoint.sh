#!/bin/sh
# Railway injects $PORT; Apache must listen on it.
set -e
PORT="${PORT:-8080}"
sed -ri "s/^Listen .*/Listen ${PORT}/" /etc/apache2/ports.conf
sed -ri "s/<VirtualHost \*:[0-9]+>/<VirtualHost *:${PORT}>/" /etc/apache2/sites-available/000-default.conf

# mod_php needs exactly one MPM: prefork. Remove any other MPM that got enabled
# (otherwise: "AH00534: More than one MPM loaded").
rm -f /etc/apache2/mods-enabled/mpm_event.* /etc/apache2/mods-enabled/mpm_worker.*
[ -e /etc/apache2/mods-enabled/mpm_prefork.load ] || a2enmod mpm_prefork >/dev/null

# Fail fast with a readable error if the Apache config is still invalid.
apache2ctl -t

# A mounted volume (for uploads) starts out root-owned.
chown -R www-data:www-data /var/www/html/public/uploads /var/www/html/storage 2>/dev/null || true

# Idempotent: creates missing tables, default settings and the superadmin (if no users yet).
php /var/www/html/database/install.php

exec apache2-foreground

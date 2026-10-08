# Isha's Cozy Cafe — PHP API image (Railway, or any Docker host)
FROM php:8.2-apache

RUN docker-php-ext-install pdo_mysql \
 # mod_php requires the prefork MPM — make sure it is the ONLY one enabled
 && (a2dismod -f mpm_event mpm_worker || true) \
 && a2enmod mpm_prefork rewrite headers \
 # Serve backend/public as the document root and allow its .htaccess
 && sed -ri 's!/var/www/html!/var/www/html/public!g' /etc/apache2/sites-available/000-default.conf \
 && printf '<Directory /var/www/html/public>\n    AllowOverride All\n    Require all granted\n</Directory>\nServerName localhost\n' > /etc/apache2/conf-available/cafe.conf \
 && a2enconf cafe \
 && mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
 && printf 'expose_php=Off\nupload_max_filesize=4M\npost_max_size=6M\n' > "$PHP_INI_DIR/conf.d/cafe.ini"

WORKDIR /var/www/html
COPY . .
RUN mkdir -p storage/logs storage/sessions public/uploads \
 && chown -R www-data:www-data storage public/uploads \
 && chmod +x docker-entrypoint.sh

ENV APP_ENV=production \
    SESSION_SECURE_COOKIE=true \
    TRUST_PROXY=true

CMD ["./docker-entrypoint.sh"]

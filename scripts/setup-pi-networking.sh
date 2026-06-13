#!/bin/bash
set -e

# Setup Wishboard Networking (DNS + Nginx Reverse Proxy)
# Must be run as root on the Raspberry Pi

DOMAIN=${WISHBOARD_DOMAIN:-"wishboard.painless-computing.com"}
AP_IP=${WISHBOARD_AP_IP:-"10.42.0.1"}

echo "Configuring network for domain: $DOMAIN at IP: $AP_IP"

# 1. Configure dnsmasq (via NetworkManager)
DNS_CONF="/etc/NetworkManager/dnsmasq-shared.d/wishboard.conf"
if [ -d "/etc/NetworkManager/dnsmasq-shared.d" ]; then
    echo "address=/$DOMAIN/$AP_IP" > "$DNS_CONF"
    echo "Created DNS configuration at $DNS_CONF"
else
    echo "Warning: /etc/NetworkManager/dnsmasq-shared.d does not exist. Are you running NetworkManager?"
    # We could optionally support native dnsmasq here:
    if [ -d "/etc/dnsmasq.d" ]; then
        echo "address=/$DOMAIN/$AP_IP" > "/etc/dnsmasq.d/wishboard.conf"
        echo "Created DNS configuration at /etc/dnsmasq.d/wishboard.conf"
    fi
fi

# 2. Configure Nginx
# Extract the base domain to guess the letsencrypt folder
BASE_DOMAIN=$(echo "$DOMAIN" | grep -oE '[^.]+\.[^.]+$')
CERT_DIR="/etc/letsencrypt/live/$BASE_DOMAIN"

# Fallback if the folder doesn't match the base domain (e.g., if they named it painless-computing.com)
if [ ! -d "$CERT_DIR" ]; then
    # try to find any letsencrypt folder that has fullchain.pem
    ALT_DIR=$(ls -d /etc/letsencrypt/live/*/ 2>/dev/null | head -n 1)
    if [ ! -z "$ALT_DIR" ]; then
        CERT_DIR=${ALT_DIR%/}
    fi
fi

NGINX_CONF="/etc/nginx/sites-available/wishboard"

cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name $DOMAIN;

    ssl_certificate $CERT_DIR/fullchain.pem;
    ssl_certificate_key $CERT_DIR/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

echo "Created Nginx configuration at $NGINX_CONF"

# Enable the site
if [ ! -f "/etc/nginx/sites-enabled/wishboard" ]; then
    ln -s "$NGINX_CONF" "/etc/nginx/sites-enabled/wishboard"
    echo "Enabled Nginx site wishboard"
fi

# Test Nginx
echo "Testing Nginx configuration..."
nginx -t

# Reload services
echo "Reloading NetworkManager to apply DNS..."
systemctl reload NetworkManager || true

echo "Reloading Nginx to apply proxy..."
systemctl reload nginx

echo "Successfully configured $DOMAIN to point to $AP_IP and proxy to localhost:3000!"

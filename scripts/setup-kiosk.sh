#!/bin/bash
set -e

echo "=== Wishboard Raspberry Pi Kiosk Setup Script ==="

MODE="${1:-prod}"
DOMAIN_NAME="${2:-wishboard.painless-computing.com}"
REMOTE_TEMP_DIR="${3:-/tmp}"
AP_IP="10.42.0.1"

echo "Deployment Mode: $MODE"
echo "Domain Name: $DOMAIN_NAME"
echo "Remote Temp Dir: $REMOTE_TEMP_DIR"

# 1. Create wishboard user if it doesn't exist
if id "wishboard" &>/dev/null; then
  echo "User wishboard already exists."
else
  echo "Creating wishboard user..."
  sudo adduser --disabled-password --gecos "Wishboard kiosk user" wishboard
fi

# Add wishboard to necessary groups
echo "Assigning groups..."
sudo usermod -a -G video,audio,input,tty,render wishboard

# 2. Setup the application directory
echo "Creating application folder..."
WISHBOARD_HOME=$(getent passwd wishboard | cut -d: -f6)
sudo mkdir -p $WISHBOARD_HOME/wishboard
if [[ -f "$REMOTE_TEMP_DIR/docker-compose.yml" ]]; then
  sudo mv "$REMOTE_TEMP_DIR/docker-compose.yml" $WISHBOARD_HOME/wishboard/docker-compose.yml
fi
sudo chown -R wishboard:wishboard $WISHBOARD_HOME

echo "Installing graphical kiosk and network dependencies..."
sudo apt-get update
sudo apt-get install -y imagemagick swaybg chromium network-manager iw nginx

echo "Checking for Docker CE Rootless dependencies..."
# We unconditionally ensure Docker CE, rootless-extras, uidmap and systemd-container are installed.
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin docker-ce-rootless-extras uidmap systemd-container

echo "Enabling systemd lingering for wishboard user..."
sudo loginctl enable-linger wishboard

echo "Initializing Rootless Docker for wishboard user..."
# Use machinectl to spawn a proper systemd user session shell and install rootless docker
sudo machinectl shell wishboard@ /bin/bash -c "PATH=/usr/bin:/sbin:/usr/sbin:\$PATH dockerd-rootless-setuptool.sh install"

echo "Exporting DOCKER_HOST for wishboard user..."
sudo -u wishboard bash -c 'grep -q "DOCKER_HOST" ~/.bashrc || echo "export DOCKER_HOST=unix:///run/user/\$(id -u)/docker.sock" >> ~/.bashrc'

echo "Configuring Wireless Access Point (Hotspot) for Mode: $MODE..."

if [[ "$MODE" = "dev" ]]; then
  echo "Dev Mode: Skipping all network modifications. Using existing connections."
elif [[ "$MODE" = "dual" ]]; then
  # Create a virtual AP interface for dual mode concurrency
  echo "Setting up virtual ap0 interface for AP/STA concurrency..."
  sudo tee /usr/local/bin/enable-ap0.sh > /dev/null << 'EOF'
#!/bin/bash
iw dev wlan0 interface add ap0 type __ap || true
EOF
  sudo chmod +x /usr/local/bin/enable-ap0.sh

  sudo tee /etc/systemd/system/wifi-ap0.service > /dev/null << 'EOF'
[Unit]
Description=Create virtual ap0 interface for Wi-Fi AP
Before=NetworkManager.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/enable-ap0.sh
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF
  sudo systemctl daemon-reload
  sudo systemctl enable wifi-ap0.service
  sudo systemctl start wifi-ap0.service
  
  if nmcli con show "Hotspot" > /dev/null 2>&1; then
    echo "Hotspot connection already exists. Deleting to recreate with correct interface."
    sudo nmcli con delete "Hotspot" || true
  fi

  sudo nmcli con add type wifi ifname ap0 con-name Hotspot autoconnect yes ssid Wishboard_WiFi
  sudo nmcli con modify Hotspot 802-11-wireless.mode ap ipv4.method shared
  sudo nmcli con modify Hotspot wifi-sec.key-mgmt wpa-psk wifi-sec.psk "wishboard2026"
  sudo nmcli con modify Hotspot connection.autoconnect-priority 100
  echo "Dual Mode Hotspot configured on ap0."
fi

echo "Generating network utility scripts..."

sudo tee /home/pi/convert-to-prod.sh > /dev/null << 'EOF'
#!/bin/bash
echo "Converting networking to PROD mode (isolated hotspot)..."
sudo nmcli con delete Hotspot || true
sudo systemctl disable wifi-ap0.service || true
sudo systemctl stop wifi-ap0.service || true
sudo rm -f /etc/systemd/system/wifi-ap0.service /usr/local/bin/enable-ap0.sh
sudo systemctl daemon-reload
sudo iw dev ap0 del || true

sudo nmcli con add type wifi ifname wlan0 con-name Hotspot autoconnect yes ssid Wishboard_WiFi
sudo nmcli con modify Hotspot 802-11-wireless.mode ap ipv4.method shared
sudo nmcli con modify Hotspot wifi-sec.key-mgmt wpa-psk wifi-sec.psk "wishboard2026"
sudo nmcli con modify Hotspot connection.autoconnect-priority 100
sudo nmcli con up Hotspot
echo "Prod Mode Hotspot successfully configured on wlan0. You are now disconnected from your home network."
EOF
sudo chmod +x /home/pi/convert-to-prod.sh
sudo chown pi:pi /home/pi/convert-to-prod.sh || true

sudo tee /home/pi/restore-network.sh > /dev/null << 'EOF'
#!/bin/bash
echo "Restoring NetworkManager configuration..."
sudo nmcli con delete Hotspot || true
sudo systemctl disable wifi-ap0.service || true
sudo systemctl stop wifi-ap0.service || true
sudo rm -f /etc/systemd/system/wifi-ap0.service /usr/local/bin/enable-ap0.sh
sudo systemctl daemon-reload
sudo iw dev ap0 del || true
sudo systemctl restart NetworkManager
echo "Network fully restored to standard client mode."
EOF
sudo chmod +x /home/pi/restore-network.sh
sudo chown pi:pi /home/pi/restore-network.sh || true

echo "Configuring DNS and Nginx Reverse Proxy..."

# Always configure Nginx for external port forwarding
BASE_DOMAIN=$(echo "$DOMAIN_NAME" | grep -oE '[^.]+\.[^.]+$')
CERT_DIR="/etc/letsencrypt/live/$BASE_DOMAIN"
if [[ ! -d "$CERT_DIR" ]]; then
    ALT_DIR=$(ls -d /etc/letsencrypt/live/*/ 2>/dev/null | head -n 1)
    if [[ ! -z "$ALT_DIR" ]]; then
        CERT_DIR=${ALT_DIR%/}
    fi
fi

NGINX_CONF="/etc/nginx/sites-available/wishboard"
sudo tee "$NGINX_CONF" > /dev/null <<EOF
map \$http_upgrade \$connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN_NAME;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name $DOMAIN_NAME;

    ssl_certificate $CERT_DIR/fullchain.pem;
    ssl_certificate_key $CERT_DIR/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
EOF

if [[ ! -f "/etc/nginx/sites-enabled/wishboard" ]]; then
    sudo ln -s "$NGINX_CONF" "/etc/nginx/sites-enabled/wishboard"
fi
sudo systemctl reload nginx || true
echo "Nginx reverse proxy for $DOMAIN_NAME configured."

# Configure local DNS hijacking only in prod/dual
if [[ "$MODE" = "dev" ]]; then
    echo "Dev Mode: Disabling local DNS redirection..."
    sudo rm -f "/etc/NetworkManager/dnsmasq-shared.d/wishboard.conf"
    sudo systemctl reload NetworkManager || true
    echo "Local DNS redirection disabled."
else
    echo "Prod/Dual Mode: Configuring local DNS redirection for domain $DOMAIN_NAME at IP $AP_IP..."
    DNS_CONF="/etc/NetworkManager/dnsmasq-shared.d/wishboard.conf"
    if [[ -d "/etc/NetworkManager/dnsmasq-shared.d" ]]; then
        echo "address=/$DOMAIN_NAME/$AP_IP" | sudo tee "$DNS_CONF" > /dev/null
    elif [[ -d "/etc/dnsmasq.d" ]]; then
        echo "address=/$DOMAIN_NAME/$AP_IP" | sudo tee "/etc/dnsmasq.d/wishboard.conf" > /dev/null
    fi
    sudo systemctl reload NetworkManager || true
    echo "Local DNS redirection enabled."
fi

echo "Generating fallback background image..."
sudo -u wishboard convert -size 1920x1080 xc:black -font DejaVu-Sans -pointsize 48 -fill white -gravity center -draw "text 0,0 'Please contact the Wishboard Administrator'" $WISHBOARD_HOME/background.png || echo "Fallback background creation skipped (imagemagick failed or font missing)."

# 3. (Systemd Node Service Removed in favor of Docker --restart always)

# 4. Configure LightDM auto-login
echo "Configuring auto-login in LightDM..."
LIGHTDM_CONF="/etc/lightdm/lightdm.conf"

# Hardcode to Wayland (labwc) since we only target Trixie+
KIOSK_SESSION="labwc"
echo "Targeting Wayland graphics stack. Using session: $KIOSK_SESSION"

if [[ -f "$LIGHTDM_CONF" ]]; then
  # Remove existing autologin settings to prevent conflicts
  sudo sed -i '/^autologin-user=/d' "$LIGHTDM_CONF"
  sudo sed -i '/^autologin-user-timeout=/d' "$LIGHTDM_CONF"
  sudo sed -i '/^autologin-session=/d' "$LIGHTDM_CONF"
  
  # Insert under [Seat:*]
  sudo sed -i "/^\[Seat:\*\]/a autologin-user=wishboard\nautologin-user-timeout=0\nautologin-session=$KIOSK_SESSION" "$LIGHTDM_CONF"
  echo "Auto-login for user 'wishboard' configured in LightDM."
else
  echo "WARNING: /etc/lightdm/lightdm.conf not found. Auto-login might need manual configuration."
fi

# 5. Disable TTY1 autologin (prevent bypass via Ctrl-Alt-F1)
echo "Disabling TTY1 autologin for security..."
TTY_OVERRIDE="/etc/systemd/system/getty@tty1.service.d/autologin.conf"
TTY_RASPI="/etc/systemd/system/getty@tty1.service.d/override.conf"
if [[ -f "$TTY_OVERRIDE" ]]; then
  sudo rm -f "$TTY_OVERRIDE"
  echo "Removed $TTY_OVERRIDE"
fi
if [[ -f "$TTY_RASPI" ]]; then
  sudo rm -f "$TTY_RASPI"
  echo "Removed $TTY_RASPI"
fi
sudo systemctl daemon-reload
sudo systemctl restart getty@tty1.service

# 6. Configure autostart for Wayland (labwc)
echo "Configuring labwc Wayland autostart..."
sudo -u wishboard mkdir -p $WISHBOARD_HOME/.config/labwc
sudo -u wishboard tee $WISHBOARD_HOME/.config/labwc/autostart > /dev/null << 'EOF'
#!/bin/bash
swaybg -i $WISHBOARD_HOME/background.png -m fill &
while ! curl -s http://localhost:3000 > /dev/null; do
  sleep 1
done
while true; do
  chromium --kiosk --noerrdialogs --disable-infobars --app=http://localhost:3000/#display?kiosk=true --disable-translate --disable-features=Translate --fast --fast-start --password-store=basic
  sleep 1
done
EOF
sudo chmod +x $WISHBOARD_HOME/.config/labwc/autostart

sudo -u wishboard tee $WISHBOARD_HOME/.config/labwc/rc.xml > /dev/null << 'EOF'
<?xml version="1.0"?>
<labwc_config>
  <keyboard>
    <keybind key="C-A-q"><action name="Execute"><command>dm-tool switch-to-greeter</command></action></keybind>
    <keybind key="C-A-Q"><action name="Execute"><command>dm-tool switch-to-greeter</command></action></keybind>
  </keyboard>
  <mouse><!-- Empty mouse block --></mouse>
</labwc_config>
EOF


echo "=== Setup Completed! ==="

echo "Configuring TTY Watchdog Service..."
# Create watchdog script
sudo tee /usr/local/bin/tty-watchdog.sh > /dev/null << 'EOF'
#!/bin/bash
IDLE_COUNT=0
while true; do
  ACTIVE_TTY=$(cat /sys/class/tty/tty0/active 2>/dev/null || echo "")
  
  if [[ "$ACTIVE_TTY" =~ ^tty[1-6]$ ]]; then
    IDLE_COUNT=$((IDLE_COUNT + 10))
    if [[ "$IDLE_COUNT" -ge 60 ]]; then
      echo "TTY idle timeout reached. Switching back to graphical session."
      chvt 7 || true
      IDLE_COUNT=0
    fi
  else
    # We are on a GUI. Check loginctl for active session status
    ACTIVE_SESSION=$(loginctl show-seat seat0 -p ActiveSession --value 2>/dev/null || echo "")
    if [[ -n "$ACTIVE_SESSION" ]]; then
      SESSION_USER=$(loginctl show-session "$ACTIVE_SESSION" -p Name --value 2>/dev/null || echo "")
      IDLE_HINT=$(loginctl show-session "$ACTIVE_SESSION" -p IdleHint --value 2>/dev/null || echo "no")
      
      if [[ "$SESSION_USER" != "wishboard" ]]; then
        if [[ "$SESSION_USER" = "lightdm" ]]; then
           # Greeter is active, count up unconditionally since they should log in or leave
           IDLE_COUNT=$((IDLE_COUNT + 10))
        elif [[ "$IDLE_HINT" = "yes" ]]; then
           # Pi user is logged in but systemd marked them idle
           IDLE_COUNT=$((IDLE_COUNT + 10))
        else
           IDLE_COUNT=0
        fi
        
        if [[ "$IDLE_COUNT" -ge 60 ]]; then
           echo "Non-kiosk session is idle. Forcing switch to wishboard."
           dm-tool switch-to-user wishboard || chvt 7
           IDLE_COUNT=0
        fi
      else
        IDLE_COUNT=0
      fi
    else
      IDLE_COUNT=0
    fi
  fi
  sleep 10
done
EOF
sudo chmod +x /usr/local/bin/tty-watchdog.sh

# Create watchdog systemd service
sudo tee /etc/systemd/system/tty-watchdog.service > /dev/null << 'EOF'
[Unit]
Description=TTY Watchdog (forces display back to GUI if idle on text console)
After=multi-user.target

[Service]
Type=simple
ExecStart=/usr/local/bin/tty-watchdog.sh
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable tty-watchdog.service
sudo systemctl start tty-watchdog.service
echo "TTY Watchdog configured and started."

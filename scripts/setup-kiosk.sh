#!/bin/bash
set -e

echo "=== Wishboard Raspberry Pi Kiosk Setup Script ==="

MODE="${1:-prod}"
echo "Deployment Mode: $MODE"

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
sudo mkdir -p /home/wishboard/wishboard
sudo chown -R wishboard:wishboard /home/wishboard

echo "Installing graphical kiosk dependencies..."
sudo apt-get update
sudo apt-get install -y imagemagick swaybg chromium network-manager

echo "Configuring Wireless Access Point (Hotspot) for Mode: $MODE..."

if [ "$MODE" = "dev" ]; then
  echo "Dev Mode: Skipping all network modifications. Using existing connections."
elif [ "$MODE" = "dual" ]; then
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

echo "Generating fallback background image..."
sudo -u wishboard convert -size 1920x1080 xc:black -font DejaVu-Sans -pointsize 48 -fill white -gravity center -draw "text 0,0 'Please contact the Wishboard Administrator'" /home/wishboard/background.png || echo "Fallback background creation skipped (imagemagick failed or font missing)."

# 3. Create systemd service
echo "Configuring systemd service..."
sudo tee /etc/systemd/system/wishboard.service > /dev/null << 'EOF'
[Unit]
Description=Wishboard Node Server
After=network.target

[Service]
Type=simple
User=wishboard
WorkingDirectory=/home/wishboard/wishboard
ExecStart=/usr/bin/node src/server/index.js
Restart=always
RestartSec=3
Environment=PORT=3000 WISHBOARD_DB_PATH=/home/wishboard/wishboard/data/wishboard.db

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable wishboard.service
echo "systemd service wishboard.service enabled."

# 4. Configure LightDM auto-login
echo "Configuring auto-login in LightDM..."
LIGHTDM_CONF="/etc/lightdm/lightdm.conf"

# Detect whether to use Wayland (labwc) or X11 (openbox)
if [ -x "$(command -v labwc)" ]; then
  KIOSK_SESSION="labwc"
else
  KIOSK_SESSION="openbox"
fi
echo "Detected graphics stack. Using session: $KIOSK_SESSION"

if [ -f "$LIGHTDM_CONF" ]; then
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
if [ -f "$TTY_OVERRIDE" ]; then
  sudo rm -f "$TTY_OVERRIDE"
  echo "Removed $TTY_OVERRIDE"
fi
if [ -f "$TTY_RASPI" ]; then
  sudo rm -f "$TTY_RASPI"
  echo "Removed $TTY_RASPI"
fi
sudo systemctl daemon-reload
sudo systemctl restart getty@tty1.service

# 6. Configure autostart for Wayland (labwc)
echo "Configuring labwc Wayland autostart..."
sudo -u wishboard mkdir -p /home/wishboard/.config/labwc
sudo -u wishboard tee /home/wishboard/.config/labwc/autostart > /dev/null << 'EOF'
#!/bin/bash
swaybg -i /home/wishboard/background.png -m fill &
while ! curl -s http://localhost:3000 > /dev/null; do
  sleep 1
done
while true; do
  chromium --kiosk --noerrdialogs --disable-infobars --app=http://localhost:3000/#display --disable-translate --disable-features=Translate --fast --fast-start --password-store=basic
  sleep 1
done
EOF
sudo chmod +x /home/wishboard/.config/labwc/autostart

sudo -u wishboard tee /home/wishboard/.config/labwc/rc.xml > /dev/null << 'EOF'
<?xml version="1.0"?>
<labwc_config>
  <keyboard>
    <keybind key="C-A-q"><action name="Execute"><command>dm-tool switch-to-greeter</command></action></keybind>
    <keybind key="C-A-Q"><action name="Execute"><command>dm-tool switch-to-greeter</command></action></keybind>
  </keyboard>
  <mouse><!-- Empty mouse block --></mouse>
</labwc_config>
EOF

# 7. Configure autostart for X11 (openbox)
echo "Configuring openbox X11 autostart..."
sudo -u wishboard mkdir -p /home/wishboard/.config/openbox
sudo -u wishboard tee /home/wishboard/.config/openbox/autostart > /dev/null << 'EOF'
#!/bin/bash
xset s off
xset -dpms
xset s noblank
feh --bg-fill /home/wishboard/background.png &
while ! curl -s http://localhost:3000 > /dev/null; do
  sleep 1
done
while true; do
  chromium --kiosk --noerrdialogs --disable-infobars --app=http://localhost:3000/#display --disable-translate --disable-features=Translate --fast --fast-start --password-store=basic
  sleep 1
done
EOF
sudo chmod +x /home/wishboard/.config/openbox/autostart

sudo -u wishboard tee /home/wishboard/.config/openbox/rc.xml > /dev/null << 'EOF'
<?xml version="1.0"?>
<openbox_config>
  <keyboard>
    <keybind key="C-A-q"><action name="Execute"><command>dm-tool switch-to-greeter</command></action></keybind>
    <keybind key="C-A-Q"><action name="Execute"><command>dm-tool switch-to-greeter</command></action></keybind>
  </keyboard>
  <mouse><context name="Root"><!-- Empty root menu --></context></mouse>
</openbox_config>
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
    if [ "$IDLE_COUNT" -ge 60 ]; then
      echo "TTY idle timeout reached. Switching back to graphical session."
      chvt 7 || true
      IDLE_COUNT=0
    fi
  else
    # We are on a GUI. Check loginctl for active session status
    ACTIVE_SESSION=$(loginctl show-seat seat0 -p ActiveSession --value 2>/dev/null || echo "")
    if [ -n "$ACTIVE_SESSION" ]; then
      SESSION_USER=$(loginctl show-session "$ACTIVE_SESSION" -p Name --value 2>/dev/null || echo "")
      IDLE_HINT=$(loginctl show-session "$ACTIVE_SESSION" -p IdleHint --value 2>/dev/null || echo "no")
      
      if [ "$SESSION_USER" != "wishboard" ]; then
        if [ "$SESSION_USER" = "lightdm" ]; then
           # Greeter is active, count up unconditionally since they should log in or leave
           IDLE_COUNT=$((IDLE_COUNT + 10))
        elif [ "$IDLE_HINT" = "yes" ]; then
           # Pi user is logged in but systemd marked them idle
           IDLE_COUNT=$((IDLE_COUNT + 10))
        else
           IDLE_COUNT=0
        fi
        
        if [ "$IDLE_COUNT" -ge 60 ]; then
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

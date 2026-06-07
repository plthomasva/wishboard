#!/bin/bash
set -e

echo "=== Wishboard Raspberry Pi Kiosk Setup Script ==="

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
sudo apt-get install -y imagemagick swaybg chromium

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
if [ -f "$LIGHTDM_CONF" ]; then
  # Remove existing autologin settings to prevent conflicts
  sudo sed -i '/^autologin-user=/d' "$LIGHTDM_CONF"
  sudo sed -i '/^autologin-user-timeout=/d' "$LIGHTDM_CONF"
  
  # Insert under [Seat:*]
  sudo sed -i '/^\[Seat:\*\]/a autologin-user=wishboard\nautologin-user-timeout=0' "$LIGHTDM_CONF"
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

# 6. Configure labwc autostart for Wayland kiosk mode
echo "Configuring labwc Wayland autostart..."
sudo -u wishboard mkdir -p /home/wishboard/.config/labwc

sudo -u wishboard tee /home/wishboard/.config/labwc/autostart > /dev/null << 'EOF'
#!/bin/bash

# Display fallback background
swaybg -i /home/wishboard/background.png -m fill &

# Start Chromium in a crash-recovery kiosk loop
while true; do
  chromium \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --app=http://localhost:3000 \
    --disable-translate \
    --disable-features=Translate \
    --fast \
    --fast-start \
    --password-store=basic
  sleep 1
done
EOF

sudo chmod +x /home/wishboard/.config/labwc/autostart
echo "labwc autostart configured."

echo "Configuring labwc exit shortcut (Ctrl-Alt-Q)..."
sudo -u wishboard tee /home/wishboard/.config/labwc/rc.xml > /dev/null << 'EOF'
<?xml version="1.0"?>
<labwc_config>
  <keyboard>
    <keybind key="C-A-q">
      <action name="Exit" />
    </keybind>
    <keybind key="C-A-Q">
      <action name="Exit" />
    </keybind>
  </keyboard>
  <mouse>
    <!-- Empty mouse block prevents default root menu bindings -->
  </mouse>
</labwc_config>
EOF
echo "labwc exit shortcut configured."

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
    IDLE_COUNT=0
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

# Wishboard Deployment Guide

This guide is designed for system owners and event managers who want to deploy a fresh instance of Wishboard on a Raspberry Pi using a custom domain. 

Wishboard is designed to be an offline-first kiosk application. However, to provide a seamless mobile experience for users in the venue, we use a custom domain, standard SSL certificates, and local DNS hijacking so users don't get scary browser warnings when connecting.

## Prerequisites

1. **Hardware**: A Raspberry Pi (Pi 4 or Pi 5 recommended).
2. **OS**: A fresh installation of **Raspberry Pi OS (Trixie/Debian 13 or newer)**. 
3. **Domain Name**: You must own a domain name (e.g., `wishboard.example.com`).
4. **Network**: The Pi must be temporarily connected to the internet to download dependencies during the initial deployment.

---

## Step 1: Obtain SSL Certificates (DNS Challenge)

Because the Pi will eventually run offline (without a public IP), you cannot use standard HTTP validation to get an SSL certificate. You must use a **DNS Challenge** via Let's Encrypt.

SSH into your fresh Raspberry Pi and install Certbot:
```bash
sudo apt-get update
sudo apt-get install -y certbot
```

Run Certbot to request a certificate manually via DNS:
```bash
sudo certbot certonly --manual --preferred-challenges dns -d wishboard.example.com
```

Certbot will ask you to create a specific `TXT` record in your domain's DNS settings. 
1. Log into your domain registrar (e.g., Namecheap, Cloudflare, Google Domains).
2. Add the `TXT` record provided by Certbot.
3. Wait a few minutes for DNS to propagate, then press `Enter` in the Certbot terminal.

If successful, your certificates will be securely saved to:
`/etc/letsencrypt/live/wishboard.example.com/`

> **Note:** The deployment scripts are hardcoded to look in `/etc/letsencrypt/live/` for the certificate matching your base domain.

---

## Step 2: Run the Deployment Orchestrator

From your **local developer machine** (not the Pi), run the automated deployment script. This script will configure the Pi, install Docker Rootless, set up Nginx with your new SSL certificates, and launch the kiosk.

### Windows (PowerShell)
```powershell
.\scripts\deploy-kiosk.ps1 -AdminUsername pi -HostName raspberrypi.local -Mode prod -DomainName wishboard.example.com
```

### macOS / Linux (Bash)
```bash
./scripts/deploy-kiosk.sh pi raspberrypi.local prod wishboard.example.com
```

### Networking Modes
- `prod`: The Pi creates an isolated `Wishboard_WiFi` hotspot and hijacks DNS for your custom domain.
- `dual`: The Pi stays connected to your home Wi-Fi but broadcasts a virtual hotspot for testing.
- `dev`: Standard mode without Wi-Fi AP manipulation.

---

## Step 3: Configure Environment Variables

The deployment script automatically generates a base `.env` file and maps it securely into the Rootless Docker container.

The environment file is located on the Pi at:
`/home/wishboard/wishboard/.env`

### Customizing Variables

If you need to inject special environment variables (like changing the default admin credentials), follow these steps:

1. SSH into the Pi:
   ```bash
   ssh pi@raspberrypi.local
   ```
2. Edit the environment file (you must use `sudo` to edit as the `wishboard` service user):
   ```bash
   sudo -u wishboard nano /home/wishboard/wishboard/.env
   ```
3. Add your custom variables:
   ```env
   # Pre-populated by deployment script
   VITE_WISHBOARD_DOMAIN=wishboard.example.com
   VITE_WISHBOARD_AP_IP=10.42.0.1
   CORS_ALLOWED_ORIGINS=https://wishboard.example.com
   
   # Add your custom overrides here:
   WISHBOARD_ADMIN_USERNAME=event_admin
   WISHBOARD_ADMIN_SECRET=SuperSecretPassword123
   ```
4. Restart the Docker container so it picks up the new environment variables:
   ```bash
   sudo -u wishboard DOCKER_HOST=unix:///run/user/$(id -u wishboard)/docker.sock bash -c 'cd /home/wishboard/wishboard && docker compose restart'
   ```

---

## Updating the Application

When a new version of Wishboard is published, you can effortlessly upgrade your deployment by re-running the deployment script from your developer machine. 

The script uses Docker to pull the new image and cleanly restart the service without destroying your underlying SQLite database (which is safely persisted in the `wishboard_data` volume).

```powershell
# Upgrade to a specific version
.\scripts\deploy-kiosk.ps1 -AdminUsername pi -HostName raspberrypi.local -Mode prod -DomainName wishboard.example.com -AppVersion v1.3.0
```

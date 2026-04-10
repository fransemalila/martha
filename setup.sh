#!/bin/bash
set -euo pipefail

# ============================================================
# Treasury Cashflow Dashboard — AlmaLinux 9 Setup Script
# ============================================================

APP_DIR="/opt/treasury-dashboard"
DATA_DIR="${APP_DIR}/data"
NODE_MAJOR=18

echo "============================================"
echo "  Treasury Cashflow Dashboard Setup"
echo "  Target: AlmaLinux 9"
echo "============================================"

# -----------------------------------------------------------
# 1. Install Node.js 18
# -----------------------------------------------------------
echo ""
echo "[1/8] Installing Node.js ${NODE_MAJOR}..."

if command -v node &>/dev/null && [[ "$(node -v)" == v${NODE_MAJOR}* ]]; then
    echo "  Node.js $(node -v) already installed."
else
    dnf module enable -y nodejs:${NODE_MAJOR} 2>/dev/null || true
    dnf install -y nodejs npm
    echo "  Installed Node.js $(node -v)"
fi

# -----------------------------------------------------------
# 2. Install Nginx
# -----------------------------------------------------------
echo ""
echo "[2/8] Installing Nginx..."
dnf install -y nginx
systemctl enable nginx

# -----------------------------------------------------------
# 3. Install PM2 globally
# -----------------------------------------------------------
echo ""
echo "[3/8] Installing PM2..."
if ! command -v pm2 &>/dev/null; then
    npm install -g pm2
fi
echo "  PM2 $(pm2 -v) installed."

# -----------------------------------------------------------
# 4. Create directory structure & set permissions
# -----------------------------------------------------------
echo ""
echo "[4/8] Setting up directories..."
mkdir -p "${DATA_DIR}/uploads"
chmod -R 755 "${APP_DIR}"
chmod -R 775 "${DATA_DIR}"

# -----------------------------------------------------------
# 5. Create .env from .env.example if it doesn't exist
# -----------------------------------------------------------
echo ""
echo "[5/8] Configuring environment..."
if [ ! -f "${APP_DIR}/.env" ]; then
    if [ -f "${APP_DIR}/.env.example" ]; then
        cp "${APP_DIR}/.env.example" "${APP_DIR}/.env"
        # Update DATA_DIR to absolute path
        sed -i "s|DATA_DIR=.*|DATA_DIR=${DATA_DIR}|" "${APP_DIR}/.env"
        echo "  Created .env from .env.example — EDIT IT with real values!"
    else
        cat > "${APP_DIR}/.env" <<EOF
PORT=5000
UPLOAD_PASSWORD=changeme
DATA_DIR=${DATA_DIR}
CORS_ORIGINS=http://10.4.10.75,http://10.4.10.75:8080
EOF
        echo "  Created default .env — EDIT IT with real values!"
    fi
else
    echo "  .env already exists, skipping."
fi

# -----------------------------------------------------------
# 6. Install npm dependencies & build frontend apps
# -----------------------------------------------------------
echo ""
echo "[6/8] Installing dependencies & building..."

echo "  Installing backend dependencies..."
cd "${APP_DIR}/backend"
npm install --production

echo "  Installing & building Dashboard..."
cd "${APP_DIR}/dashboard"
npm install
npm run build

echo "  Installing & building Upload Portal..."
cd "${APP_DIR}/upload-portal"
npm install
npm run build

# -----------------------------------------------------------
# 7. Configure Nginx
# -----------------------------------------------------------
echo ""
echo "[7/8] Configuring Nginx..."
cp "${APP_DIR}/nginx/treasury.conf" /etc/nginx/conf.d/treasury.conf

# Test nginx config
nginx -t

# Restart nginx
systemctl restart nginx

# -----------------------------------------------------------
# 8. Start application via PM2
# -----------------------------------------------------------
echo ""
echo "[8/8] Starting application with PM2..."
cd "${APP_DIR}"
pm2 delete treasury-api 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# -----------------------------------------------------------
# 9. Configure firewall
# -----------------------------------------------------------
echo ""
echo "[+] Configuring firewall..."
if command -v firewall-cmd &>/dev/null; then
    firewall-cmd --permanent --add-service=http 2>/dev/null || true
    firewall-cmd --permanent --add-service=https 2>/dev/null || true
    firewall-cmd --permanent --add-port=8080/tcp 2>/dev/null || true
    firewall-cmd --permanent --add-port=5000/tcp 2>/dev/null || true
    firewall-cmd --reload 2>/dev/null || true
    echo "  Firewall configured for HTTP/HTTPS + ports 8080, 5000."
else
    echo "  firewall-cmd not found, skipping firewall config."
fi

# -----------------------------------------------------------
# Done
# -----------------------------------------------------------
echo ""
echo "============================================"
echo "  Setup Complete!"
echo "============================================"
echo ""
echo "  Dashboard:     http://10.4.10.75"
echo "  Upload Portal: http://10.4.10.75:8080"
echo "  API:           http://10.4.10.75:5000"
echo ""
echo "  IMPORTANT:"
echo "  1. Edit ${APP_DIR}/.env to set a secure UPLOAD_PASSWORD"
echo ""
echo "  PM2 Commands:"
echo "    pm2 status        — Check process status"
echo "    pm2 logs          — View logs"
echo "    pm2 restart all   — Restart all processes"
echo ""

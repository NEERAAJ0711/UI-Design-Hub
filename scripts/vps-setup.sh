#!/bin/bash
# ============================================================
# RPS App — One-time VPS setup script
# Run this ONCE on your Hostinger VPS to prepare it for CI/CD
# Usage: bash scripts/vps-setup.sh
# ============================================================

set -e

echo "=========================================="
echo "  RPS App — VPS Setup"
echo "=========================================="

# ── 1. Node.js via NVM ─────────────────────────────────────
echo ""
echo ">>> Installing Node.js 24 via NVM..."
if [ ! -d "$HOME/.nvm" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 24
nvm use 24
echo "Node: $(node -v)"

# ── 2. pnpm + PM2 ──────────────────────────────────────────
echo ""
echo ">>> Installing pnpm and PM2..."
npm install -g pnpm pm2
echo "pnpm: $(pnpm -v)"
echo "PM2:  $(pm2 -v)"

# ── 3. PostgreSQL ──────────────────────────────────────────
echo ""
echo ">>> Checking PostgreSQL..."
if ! command -v psql &> /dev/null; then
  apt update && apt install -y postgresql
  systemctl enable postgresql
  systemctl start postgresql
fi
echo "PostgreSQL: $(psql --version)"

# ── 4. Create DB and user ──────────────────────────────────
echo ""
echo ">>> Setting up database..."
read -p "Enter DB password for rps_user: " DB_PASSWORD
sudo -u postgres psql <<EOF
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rps_user') THEN
    CREATE USER rps_user WITH PASSWORD '$DB_PASSWORD';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE rps_db OWNER rps_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'rps_db')\gexec
EOF
echo "Database ready."

# ── 5. SSH key for GitHub Actions ─────────────────────────
echo ""
echo ">>> Setting up SSH key for GitHub Actions..."
SSH_KEY_PATH="$HOME/.ssh/github_actions_rps"
if [ ! -f "$SSH_KEY_PATH" ]; then
  ssh-keygen -t ed25519 -C "github-actions-rps" -f "$SSH_KEY_PATH" -N ""
fi

# Add to authorized_keys
cat "$SSH_KEY_PATH.pub" >> "$HOME/.ssh/authorized_keys"
chmod 600 "$HOME/.ssh/authorized_keys"

echo ""
echo "=========================================="
echo "  COPY THIS PRIVATE KEY INTO GITHUB SECRETS"
echo "  Secret name: VPS_SSH_KEY"
echo "=========================================="
cat "$SSH_KEY_PATH"
echo "=========================================="

# ── 6. Clone the app ───────────────────────────────────────
echo ""
read -p "Enter your app directory (e.g. /home/rps.yourdomain.com/htdocs/rps.yourdomain.com): " APP_PATH
git clone https://github.com/NEERAAJ0711/UI-Design-Hub.git "$APP_PATH" 2>/dev/null || true
cd "$APP_PATH"
pnpm install

# ── 7. Create .env ─────────────────────────────────────────
echo ""
echo ">>> Creating .env file..."
cat > artifacts/api-server/.env <<ENV
DATABASE_URL=postgresql://rps_user:${DB_PASSWORD}@localhost:5432/rps_db
SESSION_SECRET=$(openssl rand -hex 32)
NODE_ENV=production
PORT=8090
ENV
echo ".env created."

# ── 8. DB migration + Build ────────────────────────────────
echo ""
echo ">>> Running DB migration..."
pnpm --filter @workspace/db run push

echo ""
echo ">>> Building app..."
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/kra-kpi-app run build

# ── 9. PM2 start ──────────────────────────────────────────
echo ""
echo ">>> Starting API with PM2..."
cd "$APP_PATH/artifacts/api-server"
PORT=8090 pm2 start dist/index.mjs --name rps-api
pm2 save
pm2 startup

echo ""
echo "=========================================="
echo "  ✅ VPS setup complete!"
echo ""
echo "  Now go to GitHub → Settings → Secrets"
echo "  and add these secrets:"
echo ""
echo "  VPS_HOST      = $(curl -s ifconfig.me)"
echo "  VPS_USER      = root"
echo "  VPS_SSH_KEY   = (the key printed above)"
echo "  VPS_PORT      = 22"
echo "  APP_PATH      = $APP_PATH"
echo "=========================================="

#!/usr/bin/env bash
# ==============================================================================
# AWS EC2 AUTOMATED SETUP SCRIPT FOR MULTI-TENANT LIBRARY MANAGEMENT SAAS
# Web Server: Apache (Reverse Proxy to Node.js / Express on Port 5000)
# Supports: Ubuntu 22.04 / 24.04 LTS & Amazon Linux 2023 / RHEL
# ==============================================================================

set -e

echo "======================================================================"
echo " Starting Library Management SaaS Installation on AWS EC2 with Apache "
echo "======================================================================"

# 1. Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    OS="unknown"
fi

echo "[1/7] Detected Operating System: $OS"

# 2. Update packages and install Apache & Git
echo "[2/7] Installing Apache, Git, and essential dependencies..."
if [[ "$OS" == "ubuntu" || "$OS" == "debian" ]]; then
    sudo apt update && sudo apt upgrade -y
    sudo apt install -y apache2 git curl ufw certbot python3-certbot-apache
    
    # Enable necessary Apache reverse proxy modules
    sudo a2enmod proxy
    sudo a2enmod proxy_http
    sudo a2enmod headers
    sudo a2enmod rewrite
    sudo a2enmod ssl
    
    APACHE_CONF_DIR="/etc/apache2/sites-available"
    APACHE_SERVICE="apache2"
elif [[ "$OS" == "amzn" || "$OS" == "fedora" || "$OS" == "rhel" || "$OS" == "centos" ]]; then
    sudo dnf update -y
    sudo dnf install -y httpd git curl mod_ssl certbot python3-certbot-apache
    
    APACHE_CONF_DIR="/etc/httpd/conf.d"
    APACHE_SERVICE="httpd"
else
    echo "Unsupported OS. Please run on Ubuntu or Amazon Linux."
    exit 1
fi

# 3. Install Node.js 20 LTS & PM2
echo "[3/7] Installing Node.js 20 LTS and PM2 Process Manager..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs || sudo dnf install -y nodejs
fi

echo "Node.js version: $(node -v)"
echo "NPM version: $(npm -v)"

sudo npm install -g pm2

# 4. Clone or pull repository into /var/www/library
echo "[4/7] Setting up application repository in /var/www/library..."
sudo mkdir -p /var/www
cd /var/www

if [ -d "/var/www/library/.git" ]; then
    echo "Repository already exists. Pulling latest updates..."
    cd /var/www/library
    git pull origin main
else
    echo "Cloning repository from GitHub..."
    sudo git clone https://github.com/akshay21121/library.git
    sudo chown -R $USER:$USER /var/www/library
    cd /var/www/library
fi

# 5. Install dependencies, configure .env, seed DB & build frontend
echo "[5/7] Installing dependencies and building production frontend..."
npm install --legacy-peer-deps

if [ ! -f ".env" ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    # Generate random JWT secret
    RANDOM_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    sed -i "s/production_super_secret_jwt_key_please_change_2026_xyz/$RANDOM_SECRET/g" .env
fi

# Run database seed if DB does not exist
npm run seed

# Build production React bundle
npm run build

# 6. Configure Apache VirtualHost Reverse Proxy
echo "[6/7] Configuring Apache Reverse Proxy to port 5000..."

if [[ "$OS" == "ubuntu" || "$OS" == "debian" ]]; then
    sudo tee /etc/apache2/sites-available/library-saas.conf > /dev/null << 'EOF'
<VirtualHost *:80>
    ServerAdmin webmaster@localhost
    DocumentRoot /var/www/library/dist

    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:5000/
    ProxyPassReverse / http://127.0.0.1:5000/

    ErrorLog ${APACHE_LOG_DIR}/library_error.log
    CustomLog ${APACHE_LOG_DIR}/library_access.log combined
</VirtualHost>
EOF

    # Disable default site and enable library-saas
    sudo a2dissite 000-default.conf 2>/dev/null || true
    sudo a2ensite library-saas.conf
    sudo systemctl restart apache2
    sudo systemctl enable apache2
else
    # Amazon Linux / RHEL httpd configuration
    sudo tee /etc/httpd/conf.d/library-saas.conf > /dev/null << 'EOF'
<VirtualHost *:80>
    DocumentRoot /var/www/library/dist

    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:5000/
    ProxyPassReverse / http://127.0.0.1:5000/

    ErrorLog /var/log/httpd/library_error.log
    CustomLog /var/log/httpd/library_access.log combined
</VirtualHost>
EOF
    sudo systemctl restart httpd
    sudo systemctl enable httpd
fi

# 7. Start SaaS Server with PM2
echo "[7/7] Starting SaaS application with PM2 process manager..."
pm2 delete library-saas 2>/dev/null || true
pm2 start server/server.js --name "library-saas"
pm2 save

# Setup PM2 startup script
env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME 2>/dev/null || true

# 8. Setup daily Gmail SMTP automated fee reminders cron job at 10:00 AM
echo "Configuring daily automated fee reminders cron job..."
CRON_JOB="0 10 * * * curl -s -X POST http://127.0.0.1:5000/api/whatsapp/run-auto > /dev/null 2>&1"
(crontab -l 2>/dev/null | grep -v "run-auto" ; echo "$CRON_JOB") | crontab -

echo ""
echo "======================================================================"
echo " 🎉 INSTALLATION COMPLETED SUCCESSFULLY! "
echo "======================================================================"
echo "Your SaaS platform is now live and running behind Apache on Port 80!"
echo ""
echo "Next steps:"
echo "1. Configure your Gmail SMTP credentials for fee reminders:"
echo "   nano /var/www/library/.env"
echo "   Set SMTP_USER=yourgmail@gmail.com and SMTP_PASS=your-16-char-app-password"
echo "   Then restart PM2: pm2 restart library-saas"
echo ""
echo "2. If you have a custom domain name, obtain free SSL with Let's Encrypt:"
echo "   sudo certbot --apache -d yourdomain.com -d www.yourdomain.com"
echo ""
echo "3. Default login credentials:"
echo "   - Supreme Platform Admin: admin@librarysaas.com / Admin@12345"
echo "   - Apex Library Owner:     apex.owner@gmail.com / Owner@12345"
echo "   - Zenith Library Owner:   zenith.owner@gmail.com / Owner@12345"
echo "======================================================================"

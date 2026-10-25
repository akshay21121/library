# AWS EC2 Installation & Deployment Guide (Apache Web Server)

This guide walks you through deploying the **Multi-Tenant Library Management SaaS Platform** on an **AWS EC2 instance** using **Apache (`apache2` / `httpd`)** as a reverse proxy, **PM2** as the Node.js process manager, and **Gmail SMTP** for automated and manual fee reminders.

---

## ⚡ Option 1: One-Command Automated Setup

If you have launched a fresh Ubuntu or Amazon Linux EC2 instance, you can run the automated installer script with a single command:

```bash
curl -fsSL https://raw.githubusercontent.com/akshay21121/library/main/setup-ec2-apache.sh | bash
```

The script will automatically install Apache, Node.js 20, PM2, clone the repository, build the frontend, initialize the database, configure Apache reverse proxy, and start the application!

---

## 🛠️ Option 2: Step-by-Step Manual Setup

### 1. AWS EC2 Security Group Configuration
Before connecting to your EC2 instance, ensure your **Security Group** has the following **Inbound Rules**:

| Type | Protocol | Port Range | Source | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **SSH** | TCP | `22` | `My IP` or `0.0.0.0/0` | Secure Shell Access |
| **HTTP** | TCP | `80` | `0.0.0.0/0` | Web Traffic (Apache) |
| **HTTPS** | TCP | `443` | `0.0.0.0/0` | Secure SSL Traffic |

---

### 2. Connect to EC2 & Update System Packages

```bash
ssh -i /path/to/your-key.pem ubuntu@your-ec2-public-ip

# Update repositories
sudo apt update && sudo apt upgrade -y
```

---

### 3. Install Apache and Required Reverse Proxy Modules

```bash
# Install Apache and Git
sudo apt install -y apache2 git curl ufw

# Enable Apache reverse proxy modules
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod headers
sudo a2enmod rewrite
sudo a2enmod ssl

# Restart Apache
sudo systemctl restart apache2
sudo systemctl enable apache2
```

---

### 4. Install Node.js 20 LTS & PM2

```bash
# Add NodeSource repository for Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node -v   # Should be v20.x
npm -v    # Should be v10.x

# Install PM2 Process Manager globally
sudo npm install -g pm2
```

---

### 5. Clone Repository & Setup Application

```bash
# Setup web directory
sudo mkdir -p /var/www
cd /var/www

# Clone repository
sudo git clone https://github.com/akshay21121/library.git
sudo chown -R $USER:$USER /var/www/library
cd /var/www/library

# Install project dependencies
npm install --legacy-peer-deps

# Create environment configuration
cp .env.example .env
```

---

### 6. Configure Gmail SMTP in `.env` for Free Fee Reminders

Open `.env` for editing:
```bash
nano .env
```

#### How to get a free Google App Password:
1. Go to your **Google Account**: [https://myaccount.google.com/security](https://myaccount.google.com/security)
2. Ensure **2-Step Verification** is turned **ON**.
3. In the top search bar, type **"App passwords"** and click on it.
4. Name the app `Library SaaS` and click **Create**.
5. Google will display a **16-character password** (e.g., `abcd efgh ijkl mnop`).
6. Update your `.env` file with these values:

```env
PORT=5000
JWT_SECRET=your_custom_secure_random_key_here

# Gmail SMTP Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=yourgmailaddress@gmail.com
SMTP_PASS=abcdefghijklmnop
SMTP_FROM="Apex Library" <yourgmailaddress@gmail.com>
```

Save and exit: press `Ctrl+O`, then `Enter`, then `Ctrl+X`.

---

### 7. Initialize Database & Compile Production Frontend

```bash
# 1. Initialize SQLite schema and seed demo libraries
npm run seed

# 2. Build the production React frontend bundle
npm run build

# 3. Run automated tests to verify all 10 workflows pass
npm test
```

---

### 8. Configure Apache VirtualHost (Reverse Proxy)

Create an Apache VirtualHost file to route incoming port 80 traffic to Node.js on port 5000:

```bash
sudo nano /etc/apache2/sites-available/library-saas.conf
```

Paste the following configuration:

```apache
<VirtualHost *:80>
    ServerName yourdomain.com
    ServerAlias www.yourdomain.com
    ServerAdmin webmaster@localhost

    DocumentRoot /var/www/library/dist

    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:5000/
    ProxyPassReverse / http://127.0.0.1:5000/

    ErrorLog ${APACHE_LOG_DIR}/library_error.log
    CustomLog ${APACHE_LOG_DIR}/library_access.log combined
</VirtualHost>
```

Enable the configuration and reload Apache:

```bash
# Disable Apache default placeholder site
sudo a2dissite 000-default.conf

# Enable library SaaS site
sudo a2ensite library-saas.conf

# Check syntax
sudo apache2ctl configtest

# Restart Apache
sudo systemctl restart apache2
```

---

### 9. Start the Application with PM2

```bash
# Start backend server
pm2 start server/server.js --name "library-saas"

# Save process list and enable start on server boot
pm2 save
pm2 startup
```

---

### 10. Enable Free SSL Certificate (HTTPS) with Certbot

To secure your site with HTTPS for free:

```bash
sudo apt install -y certbot python3-certbot-apache
sudo certbot --apache -d yourdomain.com -d www.yourdomain.com
```

Certbot will automatically update your Apache configuration to redirect all HTTP traffic to HTTPS!

---

### 11. Automated Daily Fee Reminders (Cron Job)

To automatically dispatch due-date reminders via Gmail SMTP daily at 10:00 AM, add a crontab entry:

```bash
crontab -e
```

Add this line at the bottom:
```cron
0 10 * * * curl -s -X POST http://127.0.0.1:5000/api/whatsapp/run-auto > /dev/null 2>&1
```

---

## 🔑 Default Login Credentials

| Role | Email | Password | Access Details |
| :--- | :--- | :--- | :--- |
| **Supreme Platform Admin** | `admin@librarysaas.com` | `Admin@12345` | Global admin dashboard, platform MRR, and **Strict Read-Only library inspection**. |
| **Apex Library Owner** | `apex.owner@gmail.com` | `Owner@12345` | Full control over Jaipur Library, admissions, visual floor plan builder, 3-shift seats, and fee collection. |
| **Zenith Library Owner** | `zenith.owner@gmail.com` | `Owner@12345` | Second isolated library demonstrating multi-tenancy. |

---

## 🛠️ Handy Maintenance Commands

```bash
# View live application logs
pm2 logs library-saas

# Restart application
pm2 restart library-saas

# Check Apache status
sudo systemctl status apache2

# View Apache error logs
sudo tail -f /var/log/apache2/library_error.log

# Rebuild frontend after git pull
cd /var/www/library
git pull origin main
npm run build
pm2 restart library-saas
```

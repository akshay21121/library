# Multi-Tenant Library Management SaaS Platform

A production-ready, full-stack multi-tenant SaaS application built for modern study libraries, co-working reading halls, and educational spaces.

Designed with complete server-side tenant isolation, strict role-based access control, an interactive visual floor plan builder with 3-shift seat allocation, automated WhatsApp fee reminders, printable receipts, and platform-wide Supreme Admin administration with strict read-only inspection.

---

## Key Features

### 1. Multi-Tenant Architecture & Security
- **Independent Tenants:** Each library operates in its own isolated environment with dedicated branding, students, floor plans, seats, fee structures, and audit logs.
- **Server-Side Tenant Isolation:** Every SQL query and API mutation enforces tenant boundaries server-side.
- **Role-Based Access Control:**
  - **Supreme Admin (Platform Owner):** Monitor all registered libraries, subscription plans, MRR, platform analytics, and audit logs.
  - **Strict Read-Only Mode:** Supreme Admin can inspect any library panel in strict read-only mode (`x-view-tenant-id`). Any mutation attempt (`POST`, `PUT`, `DELETE`) is rejected at the API layer with `403 Forbidden (READ_ONLY_ACCESS_DENIED)`.
  - **Library Owner (Admin):** Full control over their own library, student admissions, floor plan, fee collection, and settings.

### 2. Interactive Visual Floor Plan Builder
- **Drag-and-Drop Floor Canvas:** Add, move, rotate, and align seats, partition walls, common tables, and entrance doors.
- **Three-Segment Seat Status Cards:** Every seat visually displays all 3 configured shifts:
  - `First Shift`: **GREEN** (Booked) / **RED** (Available)
  - `Second Shift`: **GREEN** (Booked) / **RED** (Available)
  - `Third Shift`: **GREEN** (Booked) / **RED** (Available)
- **Conflict Prevention Engine:** Real-time database conflict checks prevent overlapping bookings for the same seat and shift.
- **Active Booking Protection:** Seats with active student bookings cannot be deleted until bookings are released or transferred.
- **Quick Setup Wizard:** Automatically generate structured grid layouts based on seat counts in seconds.

### 3. Student Admissions & Privacy Compliance
- Student KYC management, identity proof tracking, phone, email, and emergency contact details.
- **Permanent Deletion Policy:** Supports both **Privacy Anonymization** (erases PII while preserving legal accounting invoice numbers for GST/tax compliance) and **Hard Purge**.

### 4. Fees Management & Financial Integrity
- Configurable membership fee plans (single shift, double shift, 24/7 full day).
- Sequential, safe receipt numbering (`REC-YYYY-XXXX`).
- Printable and downloadable official fee receipts branded with library logo, tax ID, header, and footer.
- **Correction & Reversal Workflow:** Financial records cannot be silently modified or deleted. Reversals require a mandatory reason and log immutable audit entries.

### 5. WhatsApp Fee Reminders
- **Manual Reminders:** Filter unpaid students, preview messages, and broadcast WhatsApp alerts.
- **Automated Engine:** Configurable due-date rules (e.g. 3 days before expiry) with idempotency deduplication to prevent duplicate messages.
- **Meta Cloud API Abstraction:** Operates in transparent sandbox test mode or connects directly to official Meta WhatsApp Cloud API credentials.

---

## Default Login Credentials

| Role | Email | Password | Scope |
| :--- | :--- | :--- | :--- |
| **Supreme Platform Admin** | `admin@librarysaas.com` | `Admin@12345` | Global Platform Access |
| **Apex Library Owner** | `apex.owner@gmail.com` | `Owner@12345` | Jaipur Study Hub |
| **Zenith Library Owner** | `zenith.owner@gmail.com` | `Owner@12345` | Gurugram Scholar Hub |

---

## Local Development Setup

### Prerequisites
- Node.js (v18.x or v20.x recommended)
- npm (v9.x or v10.x)
- Git

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/akshay21121/library.git
cd library
npm install --legacy-peer-deps
```

### 2. Environment Configuration
Copy the example environment file:
```bash
cp .env.example .env
```

### 3. Database Initialization & Seeding
Initialize the SQLite schema and load realistic demonstration data:
```bash
npm run seed
```

### 4. Build the Frontend
```bash
npm run build
```

### 5. Run the Automated Test Suite
Verify that all 10 critical workflows pass (tenant isolation, conflict prevention, 3-shift statuses, read-only mode, and reversals):
```bash
npm test
```

### 6. Start the Server
```bash
npm start
```
Open **[http://localhost:5000](http://localhost:5000)** in your browser.

---

## Production Server Setup (Ubuntu / Debian VPS)

Follow this step-by-step guide to deploy this SaaS on an Ubuntu 22.04 / 24.04 LTS VPS (AWS EC2, DigitalOcean Droplet, Linode, or Hetzner).

### Step 1: Update System & Install Node.js
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw nginx

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify versions
node -v
npm -v
```

### Step 2: Install PM2 Process Manager
```bash
sudo npm install -g pm2
```

### Step 3: Clone Repository
```bash
cd /var/www
sudo git clone https://github.com/akshay21121/library.git
sudo chown -R $USER:$USER /var/www/library
cd /var/www/library
```

### Step 4: Install Dependencies & Build Frontend
```bash
npm install --legacy-peer-deps
cp .env.example .env
# Edit .env and change your JWT_SECRET
nano .env

# Initialize database & seed initial plans & superadmin
npm run seed

# Build production React frontend
npm run build
```

### Step 5: Start Application with PM2
```bash
pm2 start server/server.js --name "library-saas"
pm2 save
pm2 startup
```

### Step 6: Configure Nginx as Reverse Proxy
Create an Nginx configuration file:
```bash
sudo nano /etc/nginx/sites-available/library.conf
```

Paste the following configuration (replace `yourdomain.com` with your domain name or VPS IP):
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site and test Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/library.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 7: Enable SSL with Let's Encrypt (Certbot)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### Step 8: Setup Automatic WhatsApp Reminders Cron
To run the automated fee reminders daily at 10:00 AM, add a crontab entry:
```bash
crontab -e
```
Add the line:
```cron
0 10 * * * curl -X POST http://localhost:5000/api/whatsapp/run-auto > /dev/null 2>&1
```

---

## Technology Stack

- **Backend:** Node.js, Express.js (v5)
- **Database:** SQLite with WebAssembly execution engine (`sql.js`), schema migrations, ACID transactions, and disk persistence
- **Frontend:** React 19, Vite, Lucide Icons
- **Design System:** Custom Vanilla CSS with responsive design, glassmorphism, and color-coded status badges
- **Security:** JSON Web Tokens (JWT), bcrypt password hashing, server-side tenant isolation middleware, strict read-only authorization guards

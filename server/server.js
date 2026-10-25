const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const db = require('./db/database');
const errorHandler = require('./middleware/errorHandler');

// Route handlers
const authRoutes = require('./routes/auth');
const superAdminRoutes = require('./routes/superAdmin');
const tenantSettingsRoutes = require('./routes/tenantSettings');
const studentRoutes = require('./routes/students');
const floorRoutes = require('./routes/floors');
const seatRoutes = require('./routes/seats');
const feeRoutes = require('./routes/fees');
const whatsappRoutes = require('./routes/whatsapp');
const reportRoutes = require('./routes/reports');
const uploadRoutes = require('./routes/uploads');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure upload directory exists
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

// Serve uploaded tenant media files securely
app.use('/api/uploads/files', express.static(config.uploadDir));

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/tenant', tenantSettingsRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/floors', floorRoutes);
app.use('/api/seats', seatRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/uploads', uploadRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    platform: 'Multi-Tenant Library Management SaaS',
    timestamp: new Date().toISOString(),
  });
});

// Serve frontend static build if exists
const distPath = path.resolve(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Centralized error handler
app.use(errorHandler);

// Start server helper
async function startServer() {
  await db.initDb();
  const server = app.listen(config.port, () => {
    console.log(`Backend API server running on http://localhost:${config.port}`);
  });
  return server;
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { app, startServer };

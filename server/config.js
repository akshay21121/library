const path = require('path');
require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '5000', 10),
  jwtSecret: process.env.JWT_SECRET || 'lib_saas_sec_super_secret_key_2026_xyz999',
  jwtExpiresIn: '7d',
  dbPath: path.resolve(__dirname, '..', process.env.DB_PATH || 'data/library_saas.sqlite'),
  uploadDir: path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads'),
  whatsapp: {
    apiUrl: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v20.0',
    token: process.env.WHATSAPP_TOKEN || '',
    phoneId: process.env.WHATSAPP_PHONE_ID || '',
    wabaId: process.env.WHATSAPP_WABA_ID || '',
    sandboxMode: !process.env.WHATSAPP_TOKEN,
  },
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || '',
    isConfigured: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
  }
};


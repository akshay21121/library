const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { authenticate } = require('../middleware/auth');
const { enforceTenantIsolation } = require('../middleware/tenantIsolation');

// Allowed image MIME types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

// Multer storage engine with tenant directory isolation
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tenantFolder = path.join(config.uploadDir, req.tenantId || 'common');
    if (!fs.existsSync(tenantFolder)) {
      fs.mkdirSync(tenantFolder, { recursive: true });
    }
    cb(null, tenantFolder);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const sanitizedName = `${Date.now()}-${uuidv4().substring(0, 8)}${ext}`;
    cb(null, sanitizedName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, and SVG images are allowed.'));
    }
  },
});

router.use(authenticate, enforceTenantIsolation);

router.post('/', upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    // Return URL accessible by frontend
    const fileUrl = `/api/uploads/files/${req.tenantId}/${req.file.filename}`;
    res.json({
      url: fileUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

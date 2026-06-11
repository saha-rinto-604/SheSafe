/**
 * middleware/upload.js — Multer File Upload Middleware
 * ──────────────────────────────────────────────────────────────────────
 * Why memoryStorage instead of diskStorage:
 *   Files are held in memory as Buffers and streamed directly to Cloudinary.
 *   This avoids writing temp files to disk (cleaner for containers) and
 *   prevents orphaned files if the upload pipeline fails midway.
 *
 * Security: Limits file size to 5MB and restricts to image MIME types.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const multer = require('multer');

const storage = multer.memoryStorage();
const videoTempDir = path.join(os.tmpdir(), 'shesafe-live-video-uploads');
fs.mkdirSync(videoTempDir, { recursive: true });

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WebP, and HEIC images are allowed.'), false);
  }
};

/**
 * Single file upload middleware.
 * Usage: upload.single('photo') — expects `photo` field in multipart form.
 */
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, videoTempDir),
  filename: (req, file, cb) => {
    const safeExt = path.extname(file.originalname || '').replace(/[^a-z0-9.]/gi, '').toLowerCase() || '.mp4';
    cb(null, `live-video-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

const videoUpload = multer({
  storage: videoStorage,
  fileFilter: (req, file, cb) => {
    if (String(file.mimetype || '').toLowerCase().startsWith('video/')) {
      cb(null, true);
      return;
    }
    cb(new Error('Invalid video file.'), false);
  },
  limits: {
    fileSize: 60 * 1024 * 1024, // 60 MB
  },
});

upload.video = videoUpload;

module.exports = upload;

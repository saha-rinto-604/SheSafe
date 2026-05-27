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

const multer = require('multer');

const storage = multer.memoryStorage();

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

module.exports = upload;

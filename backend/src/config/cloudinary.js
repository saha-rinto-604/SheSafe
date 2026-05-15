/**
 * cloudinary.js — Cloudinary SDK Configuration
 * ─────────────────────────────────────────────────────────────────────
 * Why Cloudinary for a university project:
 *   - Free tier (25 credits/month) is sufficient for demos and defenses.
 *   - Returns a CDN-backed `secure_url` that can be served globally.
 *   - Supports on-the-fly image transformations via URL parameters
 *     (e.g., resize, crop, format conversion) without server-side processing.
 *   - Eliminates the need for local file storage or S3 configuration.
 *
 * Security Note:
 *   Credentials are loaded from environment variables and never committed
 *   to version control. The `api_secret` should be treated like a password.
 */

const { v2: cloudinary } = require('cloudinary');

// Configure only if credentials exist (graceful degradation for dev without cloud)
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true, // Always use HTTPS URLs
  });
  console.log('[CLOUDINARY] Configured for cloud:', process.env.CLOUDINARY_CLOUD_NAME);
} else {
  console.warn('[CLOUDINARY] No credentials found — photo uploads will return placeholder URLs.');
}

/**
 * Upload a file buffer to Cloudinary.
 *
 * Why we upload from a buffer (not a file path):
 *   Multer stores the file in memory (memoryStorage). This avoids writing
 *   temp files to disk, which is cleaner for containerized deployments and
 *   prevents orphaned temp files on upload failure.
 *
 * @param {Buffer} buffer - The file buffer from Multer
 * @param {string} folder - Cloudinary folder path (e.g., 'resqher/profiles')
 * @param {string} [publicId] - Optional public ID for the asset
 * @returns {Promise<{secure_url: string, public_id: string}>}
 */
async function uploadBuffer(buffer, folder, publicId) {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    // Dev fallback — return a placeholder so the flow doesn't break
    const devId = publicId || `${folder}/${Date.now()}`;
    console.log('[CLOUDINARY] Dev mode — skipping actual upload, publicId:', devId);
    return {
      secure_url: `https://picsum.photos/seed/${encodeURIComponent(devId)}/400/400`,
      public_id: devId,
    };
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId || undefined,
        overwrite: true,
        resource_type: 'image',
        transformation: [
          { width: 800, height: 800, crop: 'limit' }, // Cap resolution for bandwidth
          { quality: 'auto:good' },                     // Adaptive quality
          { fetch_format: 'auto' },                     // WebP where supported
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({ secure_url: result.secure_url, public_id: result.public_id });
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Delete an asset from Cloudinary by its public_id.
 * Used when a user removes their profile photo or re-uploads.
 */
async function deleteAsset(publicId) {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('[CLOUDINARY] Delete failed:', err.message);
  }
}

module.exports = { cloudinary, uploadBuffer, deleteAsset };

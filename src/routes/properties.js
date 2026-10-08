import express from 'express';
import multer from 'multer';
import { listProperties, getProperty, createProperty, updateProperty, deleteProperty, updatePropertyStatus, updatePropertyPrice, recommendProperties } from '../controllers/propertyController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { uploadPropertyImage, replacePropertyImage, deletePropertyImage, updateMainPropertyImage } from '../controllers/propertyImagesController.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10,
  },
});

// Public
router.get('/', listProperties);
router.get('/:id', getProperty);

// Admin protected routes for managing properties
router.post('/', requireAuth, requireAdmin, upload.array('images', 10), createProperty);
router.put('/:id', requireAuth, requireAdmin, updateProperty);
router.delete('/:id', requireAuth, requireAdmin, deleteProperty);
router.post('/:id/status', requireAuth, requireAdmin, updatePropertyStatus);
router.post('/:id/price', requireAuth, requireAdmin, updatePropertyPrice);

// image management (admin only)
router.post('/:id/images', requireAuth, requireAdmin, upload.single('image'), uploadPropertyImage);
// Replace by index OR by imageId (both supported)
router.post('/:id/images/:imageIndex', requireAuth, requireAdmin, upload.single('image'), replacePropertyImage);
router.post('/:id/images/id/:imageId', requireAuth, requireAdmin, upload.single('image'), replacePropertyImage);
// Delete by index OR by imageId
router.delete('/:id/images/:imageIndex', requireAuth, requireAdmin, deletePropertyImage);
router.delete('/:id/images/id/:imageId', requireAuth, requireAdmin, deletePropertyImage);
// Update main / featured image for a property
router.put('/:id/image', requireAuth, requireAdmin, upload.single('image'), updateMainPropertyImage);

// Admin profile image endpoints (simple admin-only handlers)
router.get('/admin/profile', requireAuth, requireAdmin, async (req, res) => {
  try {
    // simple stub: read admin profile from config or env - fallback to a basic object
    const profile = req.app.locals.adminProfile || { name: 'Admin', email: 'admin@example.com', phone: '', image: '' };
    return res.json({ success: true, data: profile });
  } catch (e) {
    console.error('Fetch admin profile failed', e);
    return res.status(500).json({ success: false, message: 'Unable to fetch profile' });
  }
});

router.put('/admin/profile', requireAuth, requireAdmin, async (req, res) => {
  try {
    const payload = req.body || {};
    req.app.locals.adminProfile = { ...(req.app.locals.adminProfile || {}), ...payload };
    return res.json({ success: true, data: req.app.locals.adminProfile });
  } catch (e) {
    console.error('Save admin profile failed', e);
    return res.status(500).json({ success: false, message: 'Unable to save profile' });
  }
});

router.put('/admin/profile/image', requireAuth, requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    // save to local public images for admin profile temporarily
    const fs = await import('fs');
    const path = await import('path');
    const outDir = path.resolve('public', 'images');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const filename = `admin-profile-${Date.now()}-${file.originalname}`;
    const target = path.join(outDir, filename);
    fs.writeFileSync(target, file.buffer);
    const url = `/images/${filename}`;
    req.app.locals.adminProfile = { ...(req.app.locals.adminProfile || {}), image: url };
    return res.json({ success: true, data: req.app.locals.adminProfile });
  } catch (e) {
    console.error('Upload admin profile image failed', e);
    return res.status(500).json({ success: false, message: 'Unable to upload profile image' });
  }
});
// Recommendation endpoint (accepts preferences in body)
router.post('/recommend', recommendProperties);

export default router;

import express from 'express';
import multer from 'multer';
import { listProperties, getProperty, createProperty, updateProperty, deleteProperty, updatePropertyStatus, updatePropertyPrice, recommendProperties } from '../controllers/propertyController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { uploadPropertyImage, replacePropertyImage, deletePropertyImage } from '../controllers/propertyImagesController.js';

const router = express.Router();
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, 'C:/Users/Administrator/OneDrive/Desktop/new rms/Backend/public/images'),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`),
  }),
});

// Public
router.get('/', listProperties);
router.get('/:id', getProperty);

// Admin protected routes for managing properties
router.post('/', requireAuth, requireAdmin, createProperty);
router.put('/:id', requireAuth, requireAdmin, updateProperty);
router.delete('/:id', requireAuth, requireAdmin, deleteProperty);
router.post('/:id/status', requireAuth, requireAdmin, updatePropertyStatus);
router.post('/:id/price', requireAuth, requireAdmin, updatePropertyPrice);

// image management (admin only)
router.post('/:id/images', requireAuth, requireAdmin, upload.single('image'), uploadPropertyImage);
router.post('/:id/images/:imageIndex', requireAuth, requireAdmin, upload.single('image'), replacePropertyImage);
router.delete('/:id/images/:imageIndex', requireAuth, requireAdmin, deletePropertyImage);

// Recommendation endpoint (accepts preferences in body)
router.post('/recommend', recommendProperties);

export default router;

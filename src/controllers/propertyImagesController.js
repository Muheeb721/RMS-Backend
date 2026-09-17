import fs from 'fs';
import path from 'path';
import Property from '../models/Property.js';
import { logAdminAction } from '../services/activityService.js';

const imagesDir = path.join(process.cwd(), 'Backend', 'public', 'images');

const ensureImagesDir = () => {
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
};

const getUploadedImage = (req) => {
  if (req.file) return req.file;
  if (!req.files) return null;
  if (Array.isArray(req.files)) return req.files[0] || null;
  if (req.files.image) return req.files.image;
  if (req.files.file) return req.files.file;
  const firstEntry = Object.values(req.files)[0];
  if (Array.isArray(firstEntry)) return firstEntry[0] || null;
  return firstEntry || null;
};

export const uploadPropertyImage = async (req, res) => {
  try {
    ensureImagesDir();
    const propertyId = req.params.id;
    const file = getUploadedImage(req);
    if (!file) return res.status(400).json({ success: false, message: 'No image file provided.' });
    const MAX_BYTES = Number(process.env.UPLOAD_MAX_SIZE) || 5 * 1024 * 1024; // 5MB default
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (!file.mimetype || !allowed.includes(String(file.mimetype).toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Invalid file type. Only JPEG, PNG and WEBP are allowed.' });
    }

    if (file.size && Number(file.size) > MAX_BYTES) {
      return res.status(400).json({ success: false, message: `File too large. Maximum allowed size is ${Math.round(MAX_BYTES / 1024 / 1024)}MB.` });
    }
    const filename = `${Date.now()}-${file.name}`.replace(/\s+/g, '-');
    const dest = path.join(imagesDir, filename);

    await file.mv(dest);

    const relativeUrl = `/images/${filename}`;

    const prop = await Property.findById(propertyId);
    if (!prop) return res.status(404).json({ success: false, message: 'Property not found.' });

    prop.images = Array.isArray(prop.images) ? [relativeUrl, ...prop.images] : [relativeUrl];
    if (!prop.image) prop.image = relativeUrl;
    prop.updatedAt = new Date();
    await prop.save();

    await logAdminAction({
      adminId: req.user?.id || req.user?._id || 'admin',
      adminName: req.user?.name || 'Admin',
      adminEmail: req.user?.email || '',
      actionType: 'PROPERTY_IMAGE_UPLOAD',
      entityType: 'PROPERTY',
      entityId: String(propertyId),
      message: `Uploaded image for property ${propertyId}`,
      propertyName: prop.title || '',
    });

    return res.status(201).json({ success: true, data: { url: relativeUrl, images: prop.images } });
  } catch (error) {
    console.error('Image upload failed:', error);
    return res.status(500).json({ success: false, message: 'Image upload failed.' });
  }
};

export const replacePropertyImage = async (req, res) => {
  try {
    ensureImagesDir();
    const { id, imageIndex } = req.params;
    const idx = Number(imageIndex || 0);
    const file = getUploadedImage(req);
    if (!file) return res.status(400).json({ success: false, message: 'No image file provided.' });
    const MAX_BYTES = Number(process.env.UPLOAD_MAX_SIZE) || 5 * 1024 * 1024; // 5MB default
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (!file.mimetype || !allowed.includes(String(file.mimetype).toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Invalid file type. Only JPEG, PNG and WEBP are allowed.' });
    }

    if (file.size && Number(file.size) > MAX_BYTES) {
      return res.status(400).json({ success: false, message: `File too large. Maximum allowed size is ${Math.round(MAX_BYTES / 1024 / 1024)}MB.` });
    }

    const prop = await Property.findById(id);
    if (!prop) return res.status(404).json({ success: false, message: 'Property not found.' });

    const filename = `${Date.now()}-${file.name}`.replace(/\s+/g, '-');
    const dest = path.join(imagesDir, filename);
    await file.mv(dest);
    const relativeUrl = `/images/${filename}`;

    const old = Array.isArray(prop.images) ? prop.images[idx] : null;
    if (Array.isArray(prop.images)) {
      prop.images[idx] = relativeUrl;
    } else {
      prop.images = [relativeUrl];
    }

    // update cover if replaced index is 0
    if (!prop.image || idx === 0) prop.image = relativeUrl;
    prop.updatedAt = new Date();
    await prop.save();

    // attempt to delete old file (best-effort)
    try {
      if (old && old.startsWith('/images/')) {
        const oldPath = path.join(imagesDir, path.basename(old));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    } catch (e) {
      console.warn('Failed to delete old image file:', e?.message || e);
    }

    await logAdminAction({
      adminId: req.user?.id || req.user?._id || 'admin',
      adminName: req.user?.name || 'Admin',
      adminEmail: req.user?.email || '',
      actionType: 'PROPERTY_IMAGE_REPLACE',
      entityType: 'PROPERTY',
      entityId: String(id),
      message: `Replaced image index ${idx} for property ${id}`,
      propertyName: prop.title || '',
    });

    return res.json({ success: true, data: { url: relativeUrl, images: prop.images } });
  } catch (error) {
    console.error('Image replace failed:', error);
    return res.status(500).json({ success: false, message: 'Image replace failed.' });
  }
};

export const deletePropertyImage = async (req, res) => {
  try {
    ensureImagesDir();
    const { id, imageIndex } = req.params;
    const idx = Number(imageIndex || 0);

    const prop = await Property.findById(id);
    if (!prop) return res.status(404).json({ success: false, message: 'Property not found.' });

    if (!Array.isArray(prop.images) || idx < 0 || idx >= prop.images.length) {
      return res.status(400).json({ success: false, message: 'Invalid image index.' });
    }

    const removed = prop.images.splice(idx, 1)[0];
    if (!prop.images.length) prop.image = '';
    else if (idx === 0) prop.image = prop.images[0];
    prop.updatedAt = new Date();
    await prop.save();

    // delete file best-effort
    try {
      if (removed && removed.startsWith('/images/')) {
        const oldPath = path.join(imagesDir, path.basename(removed));
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    } catch (e) {
      console.warn('Failed to delete image file:', e?.message || e);
    }

    await logAdminAction({
      adminId: req.user?.id || req.user?._id || 'admin',
      adminName: req.user?.name || 'Admin',
      adminEmail: req.user?.email || '',
      actionType: 'PROPERTY_IMAGE_DELETE',
      entityType: 'PROPERTY',
      entityId: String(id),
      message: `Deleted image index ${idx} for property ${id}`,
      propertyName: prop.title || '',
    });

    return res.json({ success: true, data: { images: prop.images } });
  } catch (error) {
    console.error('Image delete failed:', error);
    return res.status(500).json({ success: false, message: 'Image delete failed.' });
  }
};

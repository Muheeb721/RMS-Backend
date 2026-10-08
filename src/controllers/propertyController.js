import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Property, { normalizePropertyImages } from '../models/Property.js';
import cloudinaryService from '../services/cloudinaryService.js';

const getStoredImagePath = (imageUrl) => {
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  const clean = imageUrl.split('?')[0].replace(/^\/+/, '').replace(/^[A-Za-z]+:\/\//, '');
  if (!clean || !(clean.startsWith('images/') || clean.startsWith('uploads/'))) return null;
  const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const publicRoot = path.resolve(backendRoot, 'public');
  const resolved = path.resolve(publicRoot, clean);
  return resolved.startsWith(`${publicRoot}${path.sep}`) ? resolved : null;
};

const deletePropertyMediaFiles = async (property) => {
  if (!property) return;
  const candidates = [];
  const handledAssets = new Set();

  if (property.image) candidates.push({ url: property.image, public_id: property.featuredImage?.public_id || '' });
  if (property.featuredImage?.url) candidates.push(property.featuredImage);
  if (Array.isArray(property.images)) candidates.push(...property.images);

  for (const image of candidates) {
    const imageUrl = typeof image === 'string' ? image : image?.url;
    const publicId = typeof image === 'object' ? image.public_id : '';
    const assetKey = publicId || imageUrl;
    if (!assetKey || handledAssets.has(assetKey)) continue;
    handledAssets.add(assetKey);
    if (publicId) {
      try {
        await cloudinaryService.deleteByPublicId(publicId);
      } catch (error) {
        console.warn('Unable to remove property image from Cloudinary:', error?.message || error);
      }
    }
    const filePath = getStoredImagePath(imageUrl);
    if (!filePath) continue;
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (error) {
      console.warn('Unable to remove property image file:', error?.message || error);
    }
  }
};

// --- Recommendation helpers (deterministic, same priorities as frontend)
const normalizeText = (v) => (typeof v === 'string' ? v.toLowerCase().trim() : '');
const parseNumber = (v) => { const n = Number(String(v || 0).replace(/[^0-9.-]+/g, '')); return Number.isFinite(n) ? n : 0; };
const asLocationMatch = (property, preferredLocation) => {
  if (!preferredLocation) return 100;
  const target = normalizeText(preferredLocation);
  const haystack = `${property.location || ''} ${property.address || ''} ${property.area || ''}`.toLowerCase();
  return haystack.includes(target) ? 100 : 70;
};
const propertyPrice = (property) => Number(property.price || property.salePrice || property.rent || 0) || 0;
const propertyTypeValue = (property) => String(property.type || property.propertyType || property.category || '').toLowerCase();

const scoreProperty = (property, prefs = {}) => {
  const budget = parseNumber(prefs.budget || 0);
  const preferredType = normalizeText(prefs.type || '');
  const preferredSaleType = normalizeText(prefs.saleType || prefs.transaction || '');
  const preferredLocation = prefs.location || '';
  const availabilityPref = normalizeText(prefs.availability || '');
  const targetBedrooms = parseNumber(prefs.bedrooms || 0);
  const targetBathrooms = parseNumber(prefs.bathrooms || 0);

  // type
  const propType = propertyTypeValue(property);
  let typeMatch = 100;
  if (preferredType && preferredType !== 'any' && preferredType !== 'all') {
    const target = preferredType;
    const apartmentSet = ['apartment','flat'];
    const hostelSet = ['hostel','room'];
    const houseSet = ['house','villa','home'];
    const matchesApartment = apartmentSet.some(t => target.includes(t)) && apartmentSet.some(t => propType.includes(t));
    const matchesHostel = hostelSet.some(t => target.includes(t)) && hostelSet.some(t => propType.includes(t));
    const matchesHouse = houseSet.some(t => target.includes(t)) && houseSet.some(t => propType.includes(t));
    if (!(matchesApartment || matchesHostel || matchesHouse || propType.includes(target))) {
      typeMatch = 20;
    }
  }

  // transaction
  let transactionMatch = 100;
  if (preferredSaleType) {
    const propTxn = normalizeText(property.transactionType || property.status || '');
    if (preferredSaleType.includes('rent')) {
      transactionMatch = propTxn.includes('rent') || propType.includes('hostel') ? 100 : 20;
    } else if (preferredSaleType.includes('sale') || preferredSaleType.includes('buy')) {
      transactionMatch = propTxn.includes('sale') || propTxn.includes('sell') ? 100 : 20;
    }
  }

  // budget
  const price = propertyPrice(property) || 0;
  let budgetMatch = 100;
  if (budget > 0) {
    if (price === 0) budgetMatch = 50;
    else if (price <= budget) budgetMatch = 100;
    else {
      const pctOver = ((price - budget) / Math.max(budget, 1)) * 100;
      budgetMatch = Math.max(0, Math.round(100 - Math.min(100, pctOver)));
    }
  }

  const locationMatch = asLocationMatch(property, preferredLocation);

  let availabilityMatch = 100;
  if (availabilityPref && availabilityPref !== 'all') {
    const propAvail = normalizeText(property.availability || property.status || '');
    availabilityMatch = propAvail && propAvail.includes(availabilityPref) ? 100 : 30;
  }

  const bedroomMatch = targetBedrooms > 0 ? Math.min(100, Math.round((Number(property.bedrooms || 0) / Math.max(targetBedrooms, 1)) * 100)) : 100;
  const bathroomMatch = targetBathrooms > 0 ? Math.min(100, Math.round((Number(property.bathrooms || 0) / Math.max(targetBathrooms, 1)) * 100)) : 100;

  const weights = { type: 0.35, transaction: 0.25, budget: 0.18, location: 0.12, availability: 0.05, bedrooms: 0.03, bathrooms: 0.02 };

  const raw = (typeMatch * weights.type) + (transactionMatch * weights.transaction) + (budgetMatch * weights.budget) + (locationMatch * weights.location) + (availabilityMatch * weights.availability) + (bedroomMatch * weights.bedrooms) + (bathroomMatch * weights.bathrooms);
  const score = Math.round(Math.min(100, Math.max(0, raw)));

  return { score, breakdown: { typeMatch, transactionMatch, budgetMatch, locationMatch, availabilityMatch, bedroomMatch, bathroomMatch } };
};

export const recommendProperties = async (req, res) => {
  try {
    const prefs = req.body || {};
    const all = await Property.find({}).lean();
    const scored = all.map((p) => ({ property: p, score: scoreProperty(p, prefs) }));
    scored.sort((a, b) => b.score.score - a.score.score);
    const mapped = scored.map(({ property, score }) => ({ ...property, matchScore: score.score, matchBreakdown: score.breakdown }));
    return res.json({ success: true, data: mapped });
  } catch (error) {
    console.error('Recommend properties failed', error);
    return res.status(500).json({ success: false, message: 'Unable to recommend properties.' });
  }
};

export const normalizePropertyStatus = (value) => {
  const key = String(value || '').trim().toLowerCase();
  const mappings = {
    available: 'Available',
    vacant: 'Available',
    reserved: 'Reserved',
    sold: 'Sold',
    for_rent: 'For Rent',
    'for rent': 'For Rent',
    rent: 'For Rent',
  };
  return mappings[key] || 'Available';
};

export const calculateOfferPrice = (price, discountPercent = 0) => {
  const numericPrice = Number(price || 0);
  const discount = Number(discountPercent || 0);
  if (!Number.isFinite(numericPrice)) return 0;
  return Math.max(0, numericPrice - (numericPrice * discount) / 100);
};

export const createProperty = async (req, res) => {
  const savedUploads = [];
  try {
    const input = req.body || {};
    if (!String(input.title || '').trim()) {
      return res.status(400).json({ success: false, message: 'Property title is required.' });
    }
    const propertyType = String(input.propertyType || input.type || input.category || '').trim();
    if (!['house', 'apartment', 'flat', 'room', 'hostel'].includes(propertyType.toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Property category must be House, Apartment, Flat, Room, or Hostel.' });
    }
    const monthlyPrice = Number(input.rent || input.price || 0);
    if (!Number.isFinite(monthlyPrice) || monthlyPrice <= 0) {
      return res.status(400).json({ success: false, message: 'Monthly rent must be greater than zero.' });
    }
    const files = Array.isArray(req.files) ? req.files : [];
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxBytes = Number(process.env.UPLOAD_MAX_SIZE) || 5 * 1024 * 1024;
    for (const file of files) {
      if (!allowedTypes.includes(String(file.mimetype || '').toLowerCase())) {
        return res.status(400).json({ success: false, message: 'Invalid image type. Only JPEG, PNG and WEBP are allowed.' });
      }
      if (file.size > maxBytes) {
        return res.status(400).json({ success: false, message: `Each image must be no larger than ${Math.round(maxBytes / 1024 / 1024)}MB.` });
      }
    }

    const uploadedImages = await Promise.all(files.map(async (file) => {
      if (cloudinaryService?.isConfigured?.()) {
        const uploaded = await cloudinaryService.uploadBuffer(file.buffer, { folder: 'properties' });
        const image = { url: uploaded.url, public_id: uploaded.public_id || '' };
        savedUploads.push(image);
        return image;
      }

      const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
      const imagesDir = path.join(backendRoot, 'public', 'uploads', 'properties');
      await fs.promises.mkdir(imagesDir, { recursive: true });
      const extension = path.extname(file.originalname || '').toLowerCase();
      const filename = `${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`;
      const imagePath = path.join(imagesDir, filename);
      await fs.promises.writeFile(imagePath, file.buffer);
      const image = { url: `/uploads/properties/${filename}`, public_id: '' };
      savedUploads.push(image);
      return image;
    }));

    const normalizedImages = normalizePropertyImages(
      [...uploadedImages, ...(Array.isArray(input.images) ? input.images : (input.image ? [input.image] : []))],
      uploadedImages[0]?.url || input.featuredImage?.url || input.image || ''
    );

    const normalized = {
      ...input,
      purpose: input.purpose || input.transactionType || 'Rent',
      propertyType: input.propertyType || input.type || 'House',
      type: input.type || input.propertyType || 'House',
      transactionType: input.transactionType || input.purpose || 'Rent',
      listingType: 'rent',
      status: normalizePropertyStatus(input.status),
      availability: input.availability || normalizePropertyStatus(input.status),
      price: monthlyPrice,
      salePrice: 0,
      rent: monthlyPrice,
      images: normalizedImages.images,
      image: normalizedImages.image,
      featuredImage: normalizedImages.featuredImage,
      videos: Array.isArray(input.videos) ? input.videos : input.video ? [input.video] : [],
      media3d: Array.isArray(input.media3d) ? input.media3d : input.model3d ? [input.model3d] : [],
      updatedAt: new Date(),
      createdAt: new Date(),
    };

    if (normalized.offerEnabled && Number(normalized.discountPercent || 0) > 0) {
      normalized.offer = {
        discountPercent: Number(normalized.discountPercent || 0),
        enabled: true,
        finalPrice: calculateOfferPrice(normalized.price || normalized.salePrice || 0, normalized.discountPercent),
      };
    }

    const prop = await Property.create(normalized);
    return res.status(201).json({ success: true, data: prop });
  } catch (error) {
    for (const image of savedUploads) {
      if (image.public_id) {
        try { await cloudinaryService.deleteByPublicId(image.public_id); } catch (cleanupError) {
          console.warn('Failed to clean up uploaded property image:', cleanupError?.message || cleanupError);
        }
      } else {
        const filePath = getStoredImagePath(image.url);
        if (filePath) {
          try { await fs.promises.unlink(filePath); } catch (cleanupError) {
            if (cleanupError.code !== 'ENOENT') console.warn('Failed to clean up uploaded property image:', cleanupError?.message || cleanupError);
          }
        }
      }
    }
    console.error('Create property failed', error);
    return res.status(500).json({ success: false, message: 'Unable to create property.' });
  }
};

export const listProperties = async (req, res) => {
  try {
    const { q, type, status, city, minPrice, maxPrice, budget, limit = 1000, page = 1 } = req.query || {};
    const filter = {};
    if (q) filter.$or = [{ title: new RegExp(q, 'i') }, { description: new RegExp(q, 'i') }, { location: new RegExp(q, 'i') }];
    if (type) filter.$or = [{ propertyType: type }, { type }];
    if (status) filter.status = normalizePropertyStatus(status);
    if (city) filter.city = city;

    // price filtering: support minPrice/maxPrice and budget (max only)
    const min = Number(minPrice || 0);
    const max = Number(maxPrice || budget || 0);
    if (min || max) {
      // match properties where any of price/rent/salePrice fall within range
      const priceConditions = [];
      if (min) priceConditions.push({ price: { $gte: min } });
      if (max) priceConditions.push({ price: { $lte: max } });
      const rentConditions = [];
      if (min) rentConditions.push({ rent: { $gte: min } });
      if (max) rentConditions.push({ rent: { $lte: max } });
      const saleConditions = [];
      if (min) saleConditions.push({ salePrice: { $gte: min } });
      if (max) saleConditions.push({ salePrice: { $lte: max } });

      const anyPriceMatch = { $or: [] };
      if (priceConditions.length) anyPriceMatch.$or.push(...priceConditions);
      if (rentConditions.length) anyPriceMatch.$or.push(...rentConditions);
      if (saleConditions.length) anyPriceMatch.$or.push(...saleConditions);

      if (anyPriceMatch.$or.length) {
        filter.$and = filter.$and || [];
        filter.$and.push(anyPriceMatch);
      }
    }

    const skip = Math.max(0, (Number(page) - 1) * Number(limit));
    const items = await Property.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean();
    const total = await Property.countDocuments(filter);
    return res.json({ success: true, data: items, meta: { total } });
  } catch (error) {
    console.error('List properties failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list properties.' });
  }
};

export const getProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const prop = await Property.findById(id).lean();
    if (!prop) return res.status(404).json({ success: false, message: 'Property not found.' });
    return res.json({ success: true, data: prop });
  } catch (error) {
    console.error('Get property failed', error);
    return res.status(500).json({ success: false, message: 'Unable to get property.' });
  }
};

export const updateProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const editableFields = [
      'title',
      'description',
      'propertyType',
      'type',
      'category',
      'purpose',
      'transactionType',
      'price',
      'rent',
      'salePrice',
      'listingType',
      'location',
      'city',
      'society',
      'phase',
      'block',
      'address',
      'bedrooms',
      'bathrooms',
      'area',
      'furnished',
      'amenities',
      'ownerName',
      'ownerPhone',
      'ownerEmail',
      'managerName',
      'deposit',
      'otherCharges',
      'floor',
      'totalFloors',
      'priceHistory',
      'images',
      'image',
      'featuredImage',
      'videos',
      'media3d',
      'status',
      'availability',
      'offer',
      'offerEnabled',
      'discountPercent',
      'isFeatured',
    ];
    const updates = Object.fromEntries(
      editableFields
        .filter((field) => Object.prototype.hasOwnProperty.call(body, field))
        .map((field) => [field, body[field]])
    );

    if (typeof updates.title === 'string') updates.title = updates.title.trim();
    if (Object.prototype.hasOwnProperty.call(body, 'title') && !updates.title) {
      return res.status(400).json({ success: false, message: 'Property title is required.' });
    }

    if (updates.status) updates.status = normalizePropertyStatus(updates.status);
    if (updates.availability) updates.availability = normalizePropertyStatus(updates.availability);
    const rentalFieldsChanged = [
      'propertyType',
      'type',
      'category',
      'transactionType',
      'purpose',
      'listingType',
      'price',
      'rent',
      'salePrice',
    ].some((field) => Object.prototype.hasOwnProperty.call(updates, field));
    if (rentalFieldsChanged) {
      updates.listingType = 'rent';
      updates.transactionType = 'Rent';
      updates.purpose = 'Rent';
      updates.salePrice = 0;
      if (Object.prototype.hasOwnProperty.call(updates, 'price') || Object.prototype.hasOwnProperty.call(updates, 'rent')) {
        const monthlyRent = Number(updates.rent ?? updates.price);
        updates.price = monthlyRent;
        updates.rent = monthlyRent;
      }
    }

    for (const field of ['price', 'rent', 'salePrice', 'bedrooms', 'bathrooms', 'area', 'discountPercent']) {
      if (Object.prototype.hasOwnProperty.call(updates, field)) {
        const numericValue = Number(updates[field]);
        if (!Number.isFinite(numericValue) || numericValue < 0) {
          return res.status(400).json({ success: false, message: `${field} must be a non-negative number.` });
        }
        updates[field] = numericValue;
      }
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'images')) {
      if (!Array.isArray(updates.images)) {
        return res.status(400).json({ success: false, message: 'images must be an array.' });
      }
    }

    if (Array.isArray(updates.images) && updates.images.length > 0) {
      const normalizedImages = normalizePropertyImages(updates.images, updates.image || '');
      updates.images = normalizedImages.images;
      if (!Object.prototype.hasOwnProperty.call(updates, 'image')) {
        updates.image = normalizedImages.image;
      }
      if (!Object.prototype.hasOwnProperty.call(updates, 'featuredImage')) {
        updates.featuredImage = normalizedImages.featuredImage;
      }
    }

    if (Array.isArray(updates.images) && updates.images.length === 0) {
      delete updates.images;
      delete updates.image;
      delete updates.featuredImage;
    }
    if (!Object.prototype.hasOwnProperty.call(updates, 'images')) {
      delete updates.image;
      delete updates.featuredImage;
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'image') && typeof updates.image !== 'string') {
      return res.status(400).json({ success: false, message: 'image must be a string URL.' });
    }

    if (updates.offerEnabled && Number(updates.discountPercent || 0) > 0) {
      updates.offer = {
        discountPercent: Number(updates.discountPercent || 0),
        enabled: true,
        finalPrice: calculateOfferPrice(updates.price || updates.salePrice || 0, updates.discountPercent),
      };
    }
    // ensure arrays for new media fields when provided
    if (updates.videos && !Array.isArray(updates.videos)) updates.videos = [updates.videos];
    if (updates.media3d && !Array.isArray(updates.media3d)) updates.media3d = [updates.media3d];
    updates.updatedAt = new Date();

    const prop = await Property.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true, context: 'query' }
    ).lean();
    if (!prop) return res.status(404).json({ success: false, message: 'Property not found.' });
    return res.json({ success: true, data: prop });
  } catch (error) {
    console.error('Update property failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update property.' });
  }
};

export const deleteProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const prop = await Property.findById(id).lean();
    if (!prop) return res.status(404).json({ success: false, message: 'Property not found.' });

    await deletePropertyMediaFiles(prop);
    const deleted = await Property.findByIdAndDelete(id).lean();
    if (!deleted) return res.status(404).json({ success: false, message: 'Property not found.' });
    return res.json({ success: true, data: deleted });
  } catch (error) {
    console.error('Delete property failed', error);
    return res.status(500).json({ success: false, message: 'Unable to delete property.' });
  }
};

export const updatePropertyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const nextStatus = normalizePropertyStatus(status);
    const prop = await Property.findByIdAndUpdate(id, { status: nextStatus, availability: nextStatus, updatedAt: new Date() }, { new: true }).lean();
    if (!prop) return res.status(404).json({ success: false, message: 'Property not found.' });
    return res.json({ success: true, data: prop });
  } catch (error) {
    console.error('Update property status failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update property status.' });
  }
};

export const updatePropertyPrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { price, salePrice, discountPercent } = req.body || {};
    const numericPrice = Number(price || salePrice || 0);
    const next = {
      price: numericPrice,
      salePrice: Number(salePrice || price || numericPrice),
      discountPercent: Number(discountPercent || 0),
      updatedAt: new Date(),
    };

    if (Number(next.discountPercent || 0) > 0) {
      next.offer = {
        discountPercent: next.discountPercent,
        enabled: true,
        finalPrice: calculateOfferPrice(next.price, next.discountPercent),
      };
    }

    const prop = await Property.findByIdAndUpdate(id, next, { new: true }).lean();
    if (!prop) return res.status(404).json({ success: false, message: 'Property not found.' });
    return res.json({ success: true, data: prop });
  } catch (error) {
    console.error('Update property price failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update property price.' });
  }
};

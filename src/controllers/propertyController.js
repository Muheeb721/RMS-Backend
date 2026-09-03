import Property from '../models/Property.js';

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
  try {
    const input = req.body || {};
    const normalized = {
      ...input,
      purpose: input.purpose || input.transactionType || 'Sale',
      propertyType: input.propertyType || input.type || 'House',
      type: input.type || input.propertyType || 'House',
      transactionType: input.transactionType || input.purpose || 'Sale',
      status: normalizePropertyStatus(input.status),
      availability: input.availability || normalizePropertyStatus(input.status),
      price: Number(input.price || input.salePrice || 0),
      salePrice: Number(input.salePrice || input.price || 0),
      rent: Number(input.rent || 0),
      images: Array.isArray(input.images) ? input.images : input.image ? [input.image] : [],
      image: input.image || (Array.isArray(input.images) ? input.images[0] : ''),
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
    console.error('Create property failed', error);
    return res.status(500).json({ success: false, message: 'Unable to create property.' });
  }
};

export const listProperties = async (req, res) => {
  try {
    const { q, type, status, city, minPrice, maxPrice, budget, limit = 20, page = 1 } = req.query || {};
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
    const updates = req.body || {};
    if (updates.status) updates.status = normalizePropertyStatus(updates.status);
    if (updates.availability) updates.availability = normalizePropertyStatus(updates.availability);
    if (updates.price || updates.salePrice) {
      updates.price = Number(updates.price || updates.salePrice || 0);
      updates.salePrice = Number(updates.salePrice || updates.price || 0);
    }
    if (updates.offerEnabled && Number(updates.discountPercent || 0) > 0) {
      updates.offer = {
        discountPercent: Number(updates.discountPercent || 0),
        enabled: true,
        finalPrice: calculateOfferPrice(updates.price || updates.salePrice || 0, updates.discountPercent),
      };
    }
    updates.updatedAt = new Date();

    const prop = await Property.findByIdAndUpdate(id, updates, { new: true }).lean();
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
    const prop = await Property.findByIdAndDelete(id).lean();
    if (!prop) return res.status(404).json({ success: false, message: 'Property not found.' });
    return res.json({ success: true, data: prop });
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

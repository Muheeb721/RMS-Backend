import mongoose from 'mongoose';

export const normalizePropertyImages = (imagesInput = [], fallbackFeaturedUrl = '') => {
  const values = Array.isArray(imagesInput) ? imagesInput : [];
  const normalized = values
    .map((it) => {
      if (!it) return null;
      if (typeof it === 'string') return { url: it, public_id: '' };
      if (typeof it === 'object' && it && typeof it.url === 'string') {
        return { url: it.url, public_id: it.public_id || '', uploadedAt: it.uploadedAt || new Date(), _id: it._id };
      }
      return null;
    })
    .filter(Boolean);

  if (normalized.length > 0) {
    const featured = normalized[0];
    return {
      images: normalized,
      featuredImage: { url: featured.url || fallbackFeaturedUrl || '', public_id: featured.public_id || '' },
      image: featured.url || fallbackFeaturedUrl || '',
    };
  }

  const fallbackUrl = typeof fallbackFeaturedUrl === 'string' ? fallbackFeaturedUrl : '';
  return {
    images: [],
    featuredImage: { url: fallbackUrl, public_id: '' },
    image: fallbackUrl,
  };
};

const propertySchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  propertyType: { type: String, default: 'House' },
  type: { type: String, default: 'House' },
  category: { type: String, default: 'House' },
  purpose: { type: String, default: 'Sale' },
  transactionType: { type: String, default: 'Sale' },
  price: { type: Number, default: 0 },
  rent: { type: Number, default: 0 },
  salePrice: { type: Number, default: 0 },
  // listing type: sale | rent
  listingType: { type: String, default: 'rent' },
  location: { type: String, default: '' },
  city: { type: String, default: '' },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
  // structured location fields
  society: { type: String, default: '' },
  phase: { type: String, default: '' },
  block: { type: String, default: '' },
  address: { type: String, default: '' },
  bedrooms: { type: Number, default: 0 },
  bathrooms: { type: Number, default: 0 },
  area: { type: Number, default: 0 },
  furnished: { type: String, default: '' },
  amenities: { type: [String], default: [] },
  ownerId: { type: String, default: '' },
  ownerName: { type: String, default: '' },
  ownerPhone: { type: String, default: '' },
  ownerEmail: { type: String, default: '' },
  managerName: { type: String, default: '' },
  deposit: { type: Number, default: 0 },
  otherCharges: { type: Number, default: 0 },
  floor: { type: Number, default: 0 },
  totalFloors: { type: Number, default: 0 },
  priceHistory: { type: [mongoose.Schema.Types.Mixed], default: [] },
  // images stored as objects to support Cloudinary metadata
  images: {
    type: [
      {
        url: { type: String, default: '' },
        public_id: { type: String, default: '' },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  },
  // legacy single featured image (string) kept for compatibility
  image: { type: String, default: '' },
  // explicit featured image metadata (preferred)
  featuredImage: {
    url: { type: String, default: '' },
    public_id: { type: String, default: '' },
  },
  videos: { type: [String], default: [] },
  media3d: { type: [String], default: [] },
  status: { type: String, default: 'Available' },
  availability: { type: String, default: 'Available' },
  offer: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  offerEnabled: { type: Boolean, default: false },
  discountPercent: { type: Number, default: 0 },
  isFeatured: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: false });

// Normalize images: allow legacy string entries by converting them to objects
propertySchema.pre('save', function normalizeImages(next) {
  try {
    const imageValues = normalizePropertyImages(this.images, this.image || this.featuredImage?.url || '');
    if (Array.isArray(this.images)) {
      this.images = imageValues.images;
    }

    if (this.featuredImage && typeof this.featuredImage === 'object') {
      this.featuredImage = {
        url: imageValues.featuredImage.url || this.featuredImage.url || '',
        public_id: imageValues.featuredImage.public_id || this.featuredImage.public_id || '',
      };
    } else if (imageValues.featuredImage.url) {
      this.featuredImage = imageValues.featuredImage;
    }

    if (!this.image || this.image === '') {
      this.image = imageValues.image || this.featuredImage?.url || '';
    }

    if ((!this.featuredImage || !this.featuredImage.url) && Array.isArray(this.images) && this.images.length) {
      this.featuredImage = { url: this.images[0].url || '', public_id: this.images[0].public_id || '' };
      if (!this.image) this.image = this.featuredImage.url || '';
    }
  } catch (e) {
    console.warn('Property image normalization failed', e && e.message ? e.message : e);
  }
  next();
});

export default mongoose.model('Property', propertySchema, 'properties');

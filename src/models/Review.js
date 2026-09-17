import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  userId: { type: String, default: '' },
  userName: { type: String, default: '' },
  propertyId: { type: String, default: '' },
  propertyName: { type: String, default: '' },
  rating: { type: Number, default: 5 },
  comment: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: false });

export default mongoose.model('Review', reviewSchema, 'reviews');

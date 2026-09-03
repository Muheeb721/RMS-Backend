import mongoose from 'mongoose';

const contactRequestSchema = new mongoose.Schema({
  fullName: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  message: { type: String, default: '' },
  propertyId: { type: String, default: '' },
  propertyName: { type: String, default: '' },
  inquiryType: { type: String, default: 'General' },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: false });

export default mongoose.model('ContactRequest', contactRequestSchema, 'contact_requests');

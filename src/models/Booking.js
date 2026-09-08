import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  userId: { type: String, default: 'guest-user', index: true },
  userName: { type: String, default: '' },
  userEmail: { type: String, default: '' },
  userPhone: { type: String, default: '' },
  customerName: { type: String, default: '' },
  customerPhone: { type: String, default: '' },
  propertyId: { type: String, default: '', index: true },
  propertyName: { type: String, default: '' },
  propertyTitle: { type: String, default: '' },
  propertyType: { type: String, default: '' },
  amount: { type: Number, default: 0 },
  rent: { type: Number, default: 0 },
  rentFrequency: { type: String, default: 'Monthly' },
  moveInDate: { type: Date, default: null },
  rentalDuration: { type: String, default: '1 month' },
  occupants: { type: Number, default: 1 },
  message: { type: String, default: '' },
  notes: { type: String, default: '' },
  paymentStatus: { type: String, default: 'Pending' },
  bookingStatus: { type: String, default: 'Pending' },
  status: { type: String, default: 'Pending' },
  bookingDate: { type: Date, default: Date.now },
  visitDate: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: false });

bookingSchema.pre('save', function next(next) {
  this.updatedAt = new Date();
  if (!this.status) this.status = this.bookingStatus || 'Pending';
  if (!this.bookingStatus) this.bookingStatus = this.status || 'Pending';
  if (!this.paymentStatus) this.paymentStatus = 'Pending';
  next();
});

export default mongoose.model('Booking', bookingSchema, 'bookings');

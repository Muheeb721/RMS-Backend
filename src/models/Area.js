import mongoose from 'mongoose';

const AreaSchema = new mongoose.Schema({
  name: { type: String, required: true },
  city: { type: String, default: '' },
  phase: { type: String, default: '' },
  displayOrder: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model('Area', AreaSchema);

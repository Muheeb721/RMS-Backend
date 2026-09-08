import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  // Do not include passwordHash by default when returning user documents
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, default: 'resident' },
  phone: { type: String, default: '' },
  profileImage: { type: String, default: '' },
  profile: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: false });

userSchema.methods.comparePassword = async function (candidate) {
  // Avoid logging sensitive values in production. Return false if missing hash.
  if (!this.passwordHash) return false;
  try {
    return await bcrypt.compare(candidate, this.passwordHash);
  } catch (e) {
    console.warn('Password compare failed', e && e.message ? e.message : e);
    return false;
  }
};
export default mongoose.model('User', userSchema, 'users');

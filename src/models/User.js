import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, default: 'resident' },
  phone: { type: String, default: '' },
  profileImage: { type: String, default: '' },
  profile: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: false });

userSchema.methods.comparePassword = async function (candidate) {
 console . log ('candidate password:', candidate ) ; 
 console . log ('Stored  hash :', this.passwordHash) ;

return bcrypt.compare(candidate, this.passwordHash);
};
export default mongoose.model('User', userSchema, 'users');

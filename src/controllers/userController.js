import User from '../models/User.js';

export const getProfile = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated.' });
    const user = await User.findById(req.user.id).select('-passwordHash').lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.json({ success: true, data: user });
  } catch (error) {
    console.error('Get profile failed', error);
    return res.status(500).json({ success: false, message: 'Unable to fetch profile.' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated.' });
    const updates = req.body || {};
    const profileUpdate = updates.profile && typeof updates.profile === 'object' ? updates.profile : updates;

    // prevent updating role or password via this endpoint
    delete profileUpdate.role;
    delete profileUpdate.passwordHash;

    const existing = await User.findById(req.user.id).lean();
    if (!existing) return res.status(404).json({ success: false, message: 'User not found.' });

    const mergedProfile = {
      ...(existing.profile || {}),
      ...profileUpdate,
    };

    const user = await User.findByIdAndUpdate(req.user.id, { profile: mergedProfile }, { new: true }).select('-passwordHash').lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.json({ success: true, data: user });
  } catch (error) {
    console.error('Update profile failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update profile.' });
  }
};

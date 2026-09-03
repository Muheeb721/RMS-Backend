import Favorite from '../models/Favorite.js';

export const addFavorite = async (req, res) => {
  try {
    const user = req.user || {};
    const { propertyId } = req.body || {};
    if (!user || !user.id) return res.status(401).json({ success: false, message: 'Authentication required.' });
    if (!propertyId) return res.status(400).json({ success: false, message: 'propertyId is required.' });

    const existing = await Favorite.findOne({ userId: user.id, propertyId });
    if (existing) return res.json({ success: true, data: existing });

    const fav = await Favorite.create({ userId: user.id, propertyId, createdAt: new Date() });
    return res.status(201).json({ success: true, data: fav });
  } catch (error) {
    console.error('Add favorite failed', error);
    return res.status(500).json({ success: false, message: 'Unable to add favorite.' });
  }
};

export const removeFavorite = async (req, res) => {
  try {
    const user = req.user || {};
    const { propertyId } = req.params || {};
    if (!user || !user.id) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const removed = await Favorite.findOneAndDelete({ userId: user.id, propertyId }).lean();
    return res.json({ success: true, data: removed });
  } catch (error) {
    console.error('Remove favorite failed', error);
    return res.status(500).json({ success: false, message: 'Unable to remove favorite.' });
  }
};

export const listFavorites = async (req, res) => {
  try {
    const user = req.user || {};
    if (!user || !user.id) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const items = await Favorite.find({ userId: user.id }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('List favorites failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list favorites.' });
  }
};

export const aggregateFavorites = async (req, res) => {
  try {
    // aggregate counts across all users by propertyId
    const agg = await Favorite.aggregate([
      { $group: { _id: '$propertyId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const total = agg.reduce((s, a) => s + (a.count || 0), 0);
    return res.json({ success: true, data: { totalFavorites: total, byProperty: agg } });
  } catch (error) {
    console.error('Aggregate favorites failed', error);
    return res.status(500).json({ success: false, message: 'Unable to aggregate favorites.' });
  }
};

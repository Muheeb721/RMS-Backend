import SavedSearch from '../models/SavedSearch.js';

export const saveSearch = async (req, res) => {
  try {
    const user = req.user || {};
    const { name, filters } = req.body || {};
    if (!user || !user.id) return res.status(401).json({ success: false, message: 'Authentication required.' });

    const record = await SavedSearch.create({ userId: user.id, name: name || 'Saved Search', filters: filters || {}, createdAt: new Date() });
    return res.status(201).json({ success: true, data: record });
  } catch (error) {
    console.error('Save search failed', error);
    return res.status(500).json({ success: false, message: 'Unable to save search.' });
  }
};

export const listSavedSearches = async (req, res) => {
  try {
    const user = req.user || {};
    if (!user || !user.id) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const items = await SavedSearch.find({ userId: user.id }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('List saved searches failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list saved searches.' });
  }
};

export const deleteSavedSearch = async (req, res) => {
  try {
    const user = req.user || {};
    const { id } = req.params || {};
    if (!user || !user.id) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const removed = await SavedSearch.findOneAndDelete({ _id: id, userId: user.id }).lean();
    return res.json({ success: true, data: removed });
  } catch (error) {
    console.error('Delete saved search failed', error);
    return res.status(500).json({ success: false, message: 'Unable to delete saved search.' });
  }
};

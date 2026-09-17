import Area from '../models/Area.js';

export const listAreas = async (req, res) => {
  try {
    const items = await Area.find({}).sort({ displayOrder: 1, name: 1 }).lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('List areas failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list areas.' });
  }
};

export const createArea = async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ success: false, message: 'Area name is required.' });
    const item = await Area.create({
      name: String(body.name).trim(),
      city: body.city || '',
      phase: body.phase || '',
      displayOrder: Number(body.displayOrder || 0),
      active: body.active !== undefined ? Boolean(body.active) : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('Create area failed', error);
    return res.status(500).json({ success: false, message: 'Unable to create area.' });
  }
};

export const updateArea = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    updates.updatedAt = new Date();
    const item = await Area.findByIdAndUpdate(id, updates, { new: true }).lean();
    if (!item) return res.status(404).json({ success: false, message: 'Area not found.' });
    return res.json({ success: true, data: item });
  } catch (error) {
    console.error('Update area failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update area.' });
  }
};

export const deleteArea = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Area.findByIdAndDelete(id).lean();
    if (!item) return res.status(404).json({ success: false, message: 'Area not found.' });
    return res.json({ success: true, data: item });
  } catch (error) {
    console.error('Delete area failed', error);
    return res.status(500).json({ success: false, message: 'Unable to delete area.' });
  }
};

export const toggleAreaActive = async (req, res) => {
  try {
    const { id } = req.params;
    const area = await Area.findById(id);
    if (!area) return res.status(404).json({ success: false, message: 'Area not found.' });
    area.active = !area.active;
    area.updatedAt = new Date();
    await area.save();
    return res.json({ success: true, data: area });
  } catch (error) {
    console.error('Toggle area failed', error);
    return res.status(500).json({ success: false, message: 'Unable to toggle area.' });
  }
};

import RentRecord from '../models/RentRecord.js';

export const createRentRecord = async (req, res) => {
  try {
    const user = req.user || {};
    if (!user || !user.id) return res.status(401).json({ success: false, message: 'Authentication required.' });

    const body = req.body || {};
    const isAdmin = String(user.role || '').toLowerCase() === 'admin';
    const { propertyId, propertyName, monthlyRent, paid, dueDate, month, status } = body;
    const amount = Number(monthlyRent || 0);
    const paidAmount = Number(paid || 0);
    const payload = {
      userId: isAdmin && body.userId ? String(body.userId) : user.id,
      propertyId: propertyId || '',
      propertyName: propertyName || '',
      userName: isAdmin && body.userName ? String(body.userName) : user.name || '',
      monthlyRent: amount,
      paid: paidAmount,
      remaining: Math.max(0, amount - paidAmount),
      dueDate: dueDate || new Date(),
      month: month || new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      status: status || (paidAmount >= amount ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Pending'),
      paymentStatus: status || (paidAmount >= amount ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Pending'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const record = await RentRecord.create(payload);
    return res.status(201).json({ success: true, data: record });
  } catch (error) {
    console.error('Create rent record failed', error);
    return res.status(500).json({ success: false, message: 'Unable to create rent record.' });
  }
};

export const listRentRecords = async (req, res) => {
  try {
    const user = req.user || {};
    const isAdmin = String(user.role || '').toLowerCase() === 'admin';
    const filter = isAdmin ? {} : { userId: user.id };
    const items = await RentRecord.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('List rent records failed', error);
    return res.status(500).json({ success: false, message: 'Unable to load rent records.' });
  }
};

export const updateRentRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await RentRecord.findByIdAndUpdate(id, { ...req.body, updatedAt: new Date() }, { new: true }).lean();
    if (!record) return res.status(404).json({ success: false, message: 'Rent record not found.' });
    return res.json({ success: true, data: record });
  } catch (error) {
    console.error('Update rent record failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update rent record.' });
  }
};

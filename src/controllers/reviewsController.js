import Review from '../models/Review.js';

export const listReviews = async (req, res) => {
  try {
    const reviews = await Review.find({}).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ success: true, data: reviews });
  } catch (error) {
    console.error('List reviews failed', error);
    res.status(500).json({ success: false, message: 'Unable to list reviews.' });
  }
};

export const createReview = async (req, res) => {
  try {
    const input = req.body || {};
    const review = await Review.create({
      userId: input.userId || '',
      userName: input.userName || input.user || '',
      propertyId: input.propertyId || '',
      propertyName: input.propertyName || input.property || '',
      rating: Number(input.rating || 5),
      comment: input.comment || input.message || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    res.status(201).json({ success: true, data: review });
  } catch (error) {
    console.error('Create review failed', error);
    res.status(500).json({ success: false, message: 'Unable to create review.' });
  }
};

export const deleteReview = async (req, res) => {
  try {
    const id = req.params.id;
    const result = await Review.findByIdAndDelete(id);
    if (!result) return res.status(404).json({ success: false, message: 'Review not found.' });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Delete review failed', error);
    res.status(500).json({ success: false, message: 'Unable to delete review.' });
  }
};

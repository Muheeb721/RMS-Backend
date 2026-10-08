import jwt from 'jsonwebtoken';

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const applyDevSession = () => {
    const devSession = req.headers['x-rms-session'] || req.headers['x-rms-session'.toLowerCase()];
    if (!devSession || process.env.NODE_ENV === 'production') return false;

    try {
      const parsed = typeof devSession === 'string' ? JSON.parse(devSession) : devSession;
      const email = parsed?.email || parsed?.userEmail || '';
      req.user = {
        id: parsed?.id || parsed?.userId || email || parsed?.email || 'dev-user',
        userId: parsed?.userId || parsed?.id || email || parsed?.email || 'dev-user',
        email,
        name: parsed?.name || '',
        role: parsed?.role || 'resident',
      };
      return true;
    } catch (e) {
      return false;
    }
  };

  if (!token) {
    if (applyDevSession()) return next();
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ success: false, message: 'JWT_SECRET is not configured on the server.' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      ...decoded,
      id: decoded.userId || decoded.id,
      userId: decoded.userId || decoded.id,
    };
    return next();
  } catch (error) {
    if (applyDevSession()) return next();
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

export const requireAdmin = (req, res, next) => {
  const user = req.user || {};
  const role = String(user.role || '').toLowerCase();

  if (role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }

  return next();
};

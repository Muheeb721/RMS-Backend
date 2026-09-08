import jwt from 'jsonwebtoken';

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    // Development shortcut: accept an inlined JSON session via header `x-rms-session`
    // This allows the frontend dev/e2e scripts to provide a session without JWT.
    const devSession = req.headers['x-rms-session'] || req.headers['x-rms-session'.toLowerCase()];
    if (devSession && process.env.NODE_ENV !== 'production') {
      try {
        const parsed = typeof devSession === 'string' ? JSON.parse(devSession) : devSession;
        const email = parsed?.email || parsed?.userEmail || '';
        req.user = { id: parsed?.id || email || parsed?.email || 'dev-user', email: email, name: parsed?.name || '', role: parsed?.role || 'user' };
        return next();
      } catch (e) {
        // fall through to 401
      }
    }
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    req.user = decoded;
    return next();
  } catch (error) {
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

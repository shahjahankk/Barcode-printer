const jwt = require('jsonwebtoken')

function authRequired(req, res, next) {
  const header = req.headers.authorization || ''
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Access token required' })
  }
  try {
    const decoded = jwt.verify(
      header.slice(7),
      process.env.JWT_SECRET || 'dev-barcode-secret'
    )
    req.user = {
      id: decoded.userId,
      username: decoded.username,
      role: decoded.role,
    }
    return next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' })
    }
    return res.status(401).json({ success: false, message: 'Invalid token' })
  }
}

function signToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
    },
    process.env.JWT_SECRET || 'dev-barcode-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
  )
}

module.exports = { authRequired, signToken }

function admin(req, res, next) {
  console.log('Admin middleware - req.user:', req.user);
  console.log('Admin middleware - req.user.role:', req.user?.role);
  
  if (req.user && req.user.role === 'admin') {
    console.log('Admin access granted');
    return next();
  }
  console.log('Admin access denied');
  return res.status(403).json({ error: 'Admin access required' });
}

module.exports = admin; 
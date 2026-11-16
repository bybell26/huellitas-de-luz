import jwt from 'jsonwebtoken';

/**
 * Middleware que verifica el JWT en el header Authorization.
 * Si es válido, adjunta req.user = { id, email, name }.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido.' });
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email, name: payload.name };
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'Token expirado. Inicia sesión de nuevo.'
      : 'Token inválido.';
    return res.status(401).json({ error: message });
  }
}

/**
 * Genera un JWT firmado para el usuario dado.
 */
export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

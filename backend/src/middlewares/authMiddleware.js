import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export const verificarAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      ok: false,
      error: 'Acceso no autorizado: Token de autenticación requerido'
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.usuario = payload;
    next();
  } catch (err) {
    return res.status(401).json({
      ok: false,
      error: 'Token inválido o expirado'
    });
  }
};

export const requerirRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ ok: false, error: 'Usuario no autenticado' });
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({
        ok: false,
        error: `Acceso restringido: Se requiere uno de los siguientes roles: ${rolesPermitidos.join(', ')}`
      });
    }

    next();
  };
};


import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { supabase } from '../config/supabase.js';
import { mockDb } from '../services/mockStore.js';

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

export const validarSesionActiva = async (req, res, next) => {
  try {
    const id_sesion = req.body?.id_sesion || req.params?.id_sesion;
    if (!id_sesion) {
      return res.status(400).json({ ok: false, error: 'id_sesion es requerido' });
    }

    let sesion = null;

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('sesiones_mesa')
          .select('id_sesion, id_mesa, estado, expira_en')
          .eq('id_sesion', id_sesion)
          .single();

        if (!error && data) {
          sesion = data;
        }
      } catch (e) {
        console.warn('Fallo Supabase en validarSesionActiva:', e.message);
      }
    }

    if (!sesion) {
      sesion = mockDb.sesiones_mesa.find(s => s.id_sesion === id_sesion) || null;
    }

    if (!sesion) {
      return res.status(404).json({ ok: false, error: 'Sesión de mesa no encontrada' });
    }

    if (sesion.estado !== 'ABIERTA') {
      return res.status(403).json({
        ok: false,
        error: 'La sesión de mesa ya fue cerrada. Escanea el código QR nuevamente.'
      });
    }

    if (sesion.expira_en && new Date(sesion.expira_en) < new Date()) {
      // Cerrar automáticamente la sesión expirada
      if (supabase) {
        try {
          await supabase
            .from('sesiones_mesa')
            .update({ estado: 'CERRADA', cerrada_en: new Date().toISOString() })
            .eq('id_sesion', id_sesion);
        } catch (e) {}
      }
      const mockSesion = mockDb.sesiones_mesa.find(s => s.id_sesion === id_sesion);
      if (mockSesion) {
        mockSesion.estado = 'CERRADA';
        mockSesion.cerrada_en = new Date().toISOString();
      }

      return res.status(403).json({
        ok: false,
        error: 'Tu sesión de 90 minutos en mesa ha expirado. Escanea nuevamente el QR para continuar.'
      });
    }

    next();
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};


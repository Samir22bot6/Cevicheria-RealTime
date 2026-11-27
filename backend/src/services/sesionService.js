import crypto from 'crypto';
import { supabase } from '../config/supabase.js';
import { mockDb } from './mockStore.js';
import { getIO } from '../sockets/socketHandler.js';

const SESION_DURACION_MS = 90 * 60 * 1000; // 90 minutos

/**
 * Calcula la distancia en metros entre dos coordenadas geográficas usando Haversine.
 */
function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radio de la Tierra en metros
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const SesionService = {
  async obtenerConfiguracionLocal() {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('configuracion_local')
          .select('*')
          .eq('id', 1)
          .single();

        if (!error && data) {
          return {
            ...data,
            latitud: Number(data.latitud),
            longitud: Number(data.longitud),
            radio_permitido_metros: Number(data.radio_permitido_metros),
            validar_gps: Boolean(data.validar_gps)
          };
        }
      } catch (e) {
        console.warn('Fallo Supabase en obtenerConfiguracionLocal:', e.message);
      }
    }

    return { ...mockDb.configuracion_local };
  },

  async actualizarConfiguracionLocal({ nombre_local, latitud, longitud, radio_permitido_metros, validar_gps }) {
    const payload = {
      id: 1,
      actualizado_en: new Date().toISOString()
    };
    if (nombre_local !== undefined) payload.nombre_local = String(nombre_local).trim() || 'SIN ESPINAS';
    if (latitud !== undefined) payload.latitud = Number(latitud);
    if (longitud !== undefined) payload.longitud = Number(longitud);
    if (radio_permitido_metros !== undefined) payload.radio_permitido_metros = Math.max(10, Number(radio_permitido_metros) || 80);
    if (validar_gps !== undefined) payload.validar_gps = Boolean(validar_gps);

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('configuracion_local')
          .upsert(payload, { onConflict: 'id' })
          .select()
          .single();

        if (!error && data) {
          mockDb.configuracion_local = {
            ...mockDb.configuracion_local,
            ...data,
            latitud: Number(data.latitud),
            longitud: Number(data.longitud),
            radio_permitido_metros: Number(data.radio_permitido_metros),
            validar_gps: Boolean(data.validar_gps)
          };
          return mockDb.configuracion_local;
        }
      } catch (e) {
        console.warn('Fallo Supabase en actualizarConfiguracionLocal:', e.message);
      }
    }

    mockDb.configuracion_local = {
      ...mockDb.configuracion_local,
      ...payload
    };
    return { ...mockDb.configuracion_local };
  },

  async validarGeocerca(latitud, longitud) {
    const cfg = await this.obtenerConfiguracionLocal();
    if (!cfg.validar_gps) return { permitido: true, configuracion: cfg };

    const latCliente = Number(latitud);
    const lonCliente = Number(longitud);

    if (
      latitud === undefined ||
      longitud === undefined ||
      latitud === null ||
      longitud === null ||
      Number.isNaN(latCliente) ||
      Number.isNaN(lonCliente)
    ) {
      const err = new Error('Debes estar dentro de SIN ESPINAS para realizar pedidos en mesa');
      err.statusCode = 403;
      err.codigo = 'GPS_REQUERIDO';
      throw err;
    }

    const distancia = calcularDistanciaMetros(latCliente, lonCliente, Number(cfg.latitud), Number(cfg.longitud));
    if (distancia > Number(cfg.radio_permitido_metros)) {
      const err = new Error('Debes estar dentro de SIN ESPINAS para realizar pedidos en mesa');
      err.statusCode = 403;
      err.codigo = 'FUERA_DE_RANGO';
      err.distancia_metros = Math.round(distancia);
      throw err;
    }

    return { permitido: true, distancia_metros: Math.round(distancia), configuracion: cfg };
  },

  async abrirSesion(codigo_qr_token, cantidad_comensales = 1, latitud = null, longitud = null) {
    // Validar geocerca GPS si está activa
    await this.validarGeocerca(latitud, longitud);

    const ahora = new Date();
    const expiraEnDefault = new Date(ahora.getTime() + SESION_DURACION_MS).toISOString();

    // 1. Si Supabase está disponible, intentamos consultar PostgreSQL
    if (supabase) {
      try {
        const { data: mesa, error: mesaErr } = await supabase
          .from('mesas')
          .select('*')
          .eq('codigo_qr_token', codigo_qr_token)
          .single();

        if (mesaErr || !mesa) {
          throw new Error('Mesa no encontrada con el código QR provisto');
        }

        // Buscar sesión ABIERTA
        const { data: sesionExistente } = await supabase
          .from('sesiones_mesa')
          .select('*')
          .eq('id_mesa', mesa.id_mesa)
          .eq('estado', 'ABIERTA')
          .order('abierta_en', { ascending: false })
          .limit(1)
          .single();

        if (sesionExistente) {
          const expiraDate = sesionExistente.expira_en ? new Date(sesionExistente.expira_en) : null;
          if (!expiraDate || expiraDate > ahora) {
            return {
              id_sesion: sesionExistente.id_sesion,
              numero_mesa: mesa.numero_mesa,
              token_acceso_cliente: sesionExistente.token_acceso_cliente,
              id_mesa: mesa.id_mesa,
              estado_mesa: 'OCUPADA',
              estado: 'ABIERTA',
              expira_en: sesionExistente.expira_en || expiraEnDefault
            };
          }

          // Si ya expiró, cerrarla automáticamente antes de crear la nueva
          await supabase
            .from('sesiones_mesa')
            .update({ estado: 'CERRADA', cerrada_en: ahora.toISOString() })
            .eq('id_sesion', sesionExistente.id_sesion);
        }

        // Crear nueva sesión con expiración de 90 minutos
        const nuevoToken = crypto.randomBytes(32).toString('hex');
        const { data: nuevaSesion, error: sesionErr } = await supabase
          .from('sesiones_mesa')
          .insert([
            {
              id_mesa: mesa.id_mesa,
              token_acceso_cliente: nuevoToken,
              cantidad_comensales: cantidad_comensales || 1,
              estado: 'ABIERTA',
              expira_en: expiraEnDefault
            }
          ])
          .select()
          .single();

        if (sesionErr) throw sesionErr;

        // Actualizar mesa a OCUPADA
        await supabase
          .from('mesas')
          .update({ estado: 'OCUPADA' })
          .eq('id_mesa', mesa.id_mesa);

        const io = getIO();
        if (io) {
          io.to('mozos').emit('mesa_estado_cambiado', {
            id_mesa: mesa.id_mesa,
            numero_mesa: mesa.numero_mesa,
            estado: 'OCUPADA'
          });
        }

        return {
          id_sesion: nuevaSesion.id_sesion,
          numero_mesa: mesa.numero_mesa,
          token_acceso_cliente: nuevaSesion.token_acceso_cliente,
          id_mesa: mesa.id_mesa,
          estado_mesa: 'OCUPADA',
          estado: 'ABIERTA',
          expira_en: nuevaSesion.expira_en || expiraEnDefault
        };
      } catch (err) {
        if (err.statusCode === 403) throw err;
        console.warn('Fallo Supabase en abrirSesion, usando fallback:', err.message);
      }
    }

    // 2. Mock Store Fallback
    const mesa = mockDb.mesas.find(m => m.codigo_qr_token === codigo_qr_token);
    if (!mesa) {
      throw new Error('Mesa no encontrada con el código QR provisto');
    }

    let sesion = mockDb.sesiones_mesa.find(s => s.id_mesa === mesa.id_mesa && s.estado === 'ABIERTA');

    if (sesion && sesion.expira_en && new Date(sesion.expira_en) < ahora) {
      sesion.estado = 'CERRADA';
      sesion.cerrada_en = ahora.toISOString();
      sesion = null;
    }

    if (!sesion) {
      sesion = {
        id_sesion: crypto.randomUUID(),
        id_mesa: mesa.id_mesa,
        id_mozo_asignado: null,
        token_acceso_cliente: crypto.randomBytes(32).toString('hex'),
        cantidad_comensales: Number(cantidad_comensales) || 1,
        estado: 'ABIERTA',
        abierta_en: ahora.toISOString(),
        expira_en: expiraEnDefault,
        cerrada_en: null
      };
      mockDb.sesiones_mesa.push(sesion);
      mesa.estado = 'OCUPADA';

      const io = getIO();
      if (io) {
        io.to('mozos').emit('mesa_estado_cambiado', {
          id_mesa: mesa.id_mesa,
          numero_mesa: mesa.numero_mesa,
          estado: 'OCUPADA'
        });
      }
    }

    return {
      id_sesion: sesion.id_sesion,
      numero_mesa: mesa.numero_mesa,
      token_acceso_cliente: sesion.token_acceso_cliente,
      id_mesa: mesa.id_mesa,
      estado_mesa: mesa.estado,
      estado: sesion.estado,
      expira_en: sesion.expira_en || expiraEnDefault
    };
  },

  async llamarMozo({ id_sesion, numero_mesa, motivo }) {
    const motivoFinal = motivo || 'Necesita atención en mesa';
    let mesaNum = numero_mesa;

    if (!mesaNum && id_sesion) {
      if (supabase) {
        try {
          const { data } = await supabase
            .from('sesiones_mesa')
            .select('mesas(numero_mesa)')
            .eq('id_sesion', id_sesion)
            .single();
          if (data?.mesas?.numero_mesa) mesaNum = data.mesas.numero_mesa;
        } catch (e) {}
      }
      if (!mesaNum) {
        const s = mockDb.sesiones_mesa.find(x => x.id_sesion === id_sesion);
        const m = s ? mockDb.mesas.find(x => x.id_mesa === s.id_mesa) : null;
        if (m) mesaNum = m.numero_mesa;
      }
    }

    const payload = {
      id_alerta: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tipo: 'LLAMAR_MOZO',
      id_sesion,
      numero_mesa: mesaNum || 'M-??',
      motivo: motivoFinal,
      mensaje: `Mesa ${mesaNum || '??'}: ${motivoFinal}`,
      hora: new Date().toISOString()
    };

    const io = getIO();
    if (io) {
      io.to('mozos').emit('llamar_mozo', payload);
      io.to('mozos').emit('alerta_mesa', payload);
    }

    return payload;
  },

  async asignarMozoSesion(id_sesion, id_mozo) {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('sesiones_mesa')
          .update({ id_mozo_asignado: id_mozo ? Number(id_mozo) : null })
          .eq('id_sesion', id_sesion)
          .select('*, usuarios(nombres, apellidos)')
          .single();
        if (!error && data) return data;
      } catch (e) {
        console.warn('Fallo Supabase en asignarMozoSesion:', e.message);
      }
    }

    const sesion = mockDb.sesiones_mesa.find(s => s.id_sesion === id_sesion);
    if (!sesion) throw new Error('Sesión no encontrada');
    sesion.id_mozo_asignado = id_mozo ? Number(id_mozo) : null;
    return sesion;
  },

  async obtenerSesionActivaPorMesa(id_mesa) {
    if (supabase) {
      try {
        const { data } = await supabase
          .from('sesiones_mesa')
          .select('*, usuarios(id_usuario, nombres, apellidos)')
          .eq('id_mesa', Number(id_mesa))
          .eq('estado', 'ABIERTA')
          .single();
        if (data) return data;
      } catch (e) {}
    }
    return mockDb.sesiones_mesa.find(s => s.id_mesa === Number(id_mesa) && s.estado === 'ABIERTA') || null;
  },

  async listarMesas() {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('mesas')
          .select('*, zonas(nombre)')
          .order('id_mesa');
        if (!error && data) return data;
      } catch (e) {
        console.warn('Error al listar mesas en Supabase:', e.message);
      }
    }
    return mockDb.mesas.map(m => {
      const zona = mockDb.zonas.find(z => z.id_zona === m.id_zona);
      return { ...m, zona_nombre: zona ? zona.nombre : '' };
    });
  }
};

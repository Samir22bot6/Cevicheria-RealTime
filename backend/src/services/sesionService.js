import crypto from 'crypto';
import { supabase } from '../config/supabase.js';
import { mockDb } from './mockStore.js';
import { getIO } from '../sockets/socketHandler.js';

export const SesionService = {
  async abrirSesion(codigo_qr_token, cantidad_comensales = 1) {
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
          return {
            id_sesion: sesionExistente.id_sesion,
            numero_mesa: mesa.numero_mesa,
            token_acceso_cliente: sesionExistente.token_acceso_cliente,
            id_mesa: mesa.id_mesa,
            estado_mesa: 'OCUPADA'
          };
        }

        // Crear nueva sesión
        const nuevoToken = crypto.randomBytes(32).toString('hex');
        const { data: nuevaSesion, error: sesionErr } = await supabase
          .from('sesiones_mesa')
          .insert([
            {
              id_mesa: mesa.id_mesa,
              token_acceso_cliente: nuevoToken,
              cantidad_comensales: cantidad_comensales || 1,
              estado: 'ABIERTA'
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
          estado_mesa: 'OCUPADA'
        };
      } catch (err) {
        console.warn('Fallo Supabase en abrirSesion, usando fallback:', err.message);
      }
    }

    // 2. Mock Store Fallback
    const mesa = mockDb.mesas.find(m => m.codigo_qr_token === codigo_qr_token);
    if (!mesa) {
      throw new Error('Mesa no encontrada con el código QR provisto');
    }

    let sesion = mockDb.sesiones_mesa.find(s => s.id_mesa === mesa.id_mesa && s.estado === 'ABIERTA');

    if (!sesion) {
      sesion = {
        id_sesion: crypto.randomUUID(),
        id_mesa: mesa.id_mesa,
        id_mozo_asignado: null,
        token_acceso_cliente: crypto.randomBytes(32).toString('hex'),
        cantidad_comensales: Number(cantidad_comensales) || 1,
        estado: 'ABIERTA',
        abierta_en: new Date().toISOString(),
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
      estado_mesa: mesa.estado
    };
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


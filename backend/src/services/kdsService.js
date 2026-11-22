import { supabase } from '../config/supabase.js';
import { mockDb } from './mockStore.js';
import { getIO } from '../sockets/socketHandler.js';

export const KdsService = {
  async obtenerKds(estacion = null) {
    if (supabase) {
      try {
        let query = supabase.from('vw_kds_cocina').select('*');
        if (estacion && estacion !== 'TODAS') {
          query = query.eq('estacion', estacion);
        }
        const { data, error } = await query;
        if (!error && data) {
          return data;
        }
      } catch (err) {
        console.warn('Fallo Supabase en obtenerKds, usando mock store:', err.message);
      }
    }

    // Mock Store Fallback calculando la vista vw_kds_cocina
    const kdsItems = [];
    const estadosActivos = ['PENDIENTE', 'PREPARANDO', 'LISTO'];

    for (const det of mockDb.detalle_pedidos) {
      if (!estadosActivos.includes(det.estado_estacion)) continue;

      const pedido = mockDb.pedidos.find(p => p.id_pedido === det.id_pedido);
      if (!pedido || pedido.estado === 'CANCELADO') continue;

      const sesion = mockDb.sesiones_mesa.find(s => s.id_sesion === pedido.id_sesion);
      const mesa = sesion ? mockDb.mesas.find(m => m.id_mesa === sesion.id_mesa) : null;
      const plato = mockDb.platos.find(p => p.id_plato === det.id_plato);
      const estacionObj = plato ? mockDb.estaciones_cocina.find(e => e.id_estacion === plato.id_estacion) : null;
      const estacionNombre = estacionObj ? estacionObj.nombre : 'BARRA_FRIA';

      if (estacion && estacion !== 'TODAS' && estacionNombre !== estacion) {
        continue;
      }

      // Opciones
      const optsDetalle = mockDb.detalle_pedido_opciones.filter(dpo => dpo.id_detalle === det.id_detalle);
      const nombresOpts = optsDetalle
        .map(dpo => {
          const o = mockDb.opciones_personalizacion.find(op => op.id_opcion === dpo.id_opcion);
          return o ? o.nombre : null;
        })
        .filter(Boolean);

      const horaPedido = new Date(pedido.creado_en);
      const minutosEspera = Math.max(0, Math.floor((Date.now() - horaPedido.getTime()) / 60000));

      kdsItems.push({
        id_detalle: det.id_detalle,
        id_pedido: pedido.id_pedido,
        id_sesion: pedido.id_sesion,
        numero_ticket: pedido.numero_ticket,
        numero_mesa: mesa ? mesa.numero_mesa : 'M-07',
        estacion: estacionNombre,
        plato: plato ? plato.nombre : 'Plato Desconocido',
        cantidad: det.cantidad,
        estado_estacion: det.estado_estacion,
        observaciones_item: det.observaciones_item || '',
        personalizaciones: nombresOpts.length > 0 ? nombresOpts.join(', ') : 'Estándar',
        hora_pedido: pedido.creado_en,
        minutos_espera: minutosEspera
      });
    }

    kdsItems.sort((a, b) => new Date(a.hora_pedido) - new Date(b.hora_pedido));
    return kdsItems;
  },

  async actualizarEstadoDetalle(id_detalle, nuevoEstado) {
    const estadosValidos = ['PENDIENTE', 'PREPARANDO', 'LISTO', 'ENTREGADO', 'CANCELADO'];
    if (!estadosValidos.includes(nuevoEstado)) {
      throw new Error(`Estado no válido: ${nuevoEstado}`);
    }

    const io = getIO();
    let id_sesion = null;
    let numero_mesa = null;
    let plato_nombre = '';

    if (supabase) {
      try {
        const { data: detActualizado, error } = await supabase
          .from('detalle_pedidos')
          .update({ estado_estacion: nuevoEstado })
          .eq('id_detalle', id_detalle)
          .select('*, pedidos(id_sesion, sesiones_mesa(mesas(numero_mesa))), platos(nombre)')
          .single();

        if (!error && detActualizado) {
          id_sesion = detActualizado.pedidos?.id_sesion;
          numero_mesa = detActualizado.pedidos?.sesiones_mesa?.mesas?.numero_mesa;
          plato_nombre = detActualizado.platos?.nombre;

          // Emisión por Socket.io
          if (io) {
            if (id_sesion) {
              io.to(`mesa_${id_sesion}`).emit('estado_plato_actualizado', {
                id_detalle,
                estado_estacion: nuevoEstado,
                plato: plato_nombre,
                numero_mesa
              });
            }
            io.to('mozos').emit('estado_plato_actualizado', {
              id_detalle,
              estado_estacion: nuevoEstado,
              plato: plato_nombre,
              numero_mesa,
              id_sesion
            });
            io.to('cocina_TODAS').emit('kds_item_actualizado', {
              id_detalle,
              estado_estacion: nuevoEstado
            });
          }

          return detActualizado;
        }
      } catch (err) {
        console.warn('Fallo Supabase en actualizarEstadoDetalle, usando mock store:', err.message);
      }
    }

    // Mock Store Fallback
    const det = mockDb.detalle_pedidos.find(d => d.id_detalle === Number(id_detalle));
    if (!det) {
      throw new Error('Detalle de pedido no encontrado');
    }

    det.estado_estacion = nuevoEstado;

    const pedido = mockDb.pedidos.find(p => p.id_pedido === det.id_pedido);
    if (pedido) {
      id_sesion = pedido.id_sesion;
      const sesion = mockDb.sesiones_mesa.find(s => s.id_sesion === pedido.id_sesion);
      const mesa = sesion ? mockDb.mesas.find(m => m.id_mesa === sesion.id_mesa) : null;
      numero_mesa = mesa ? mesa.numero_mesa : 'M-07';
    }
    const plato = mockDb.platos.find(p => p.id_plato === det.id_plato);
    plato_nombre = plato ? plato.nombre : 'Plato';

    if (io) {
      if (id_sesion) {
        io.to(`mesa_${id_sesion}`).emit('estado_plato_actualizado', {
          id_detalle: det.id_detalle,
          estado_estacion: nuevoEstado,
          plato: plato_nombre,
          numero_mesa
        });
      }
      io.to('mozos').emit('estado_plato_actualizado', {
        id_detalle: det.id_detalle,
        estado_estacion: nuevoEstado,
        plato: plato_nombre,
        numero_mesa,
        id_sesion
      });
      io.to('cocina_TODAS').emit('kds_item_actualizado', {
        id_detalle: det.id_detalle,
        estado_estacion: nuevoEstado
      });
    }

    return det;
  }
};


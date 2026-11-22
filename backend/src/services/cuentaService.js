import { supabase } from '../config/supabase.js';
import { mockDb } from './mockStore.js';
import { getIO } from '../sockets/socketHandler.js';

export const CuentaService = {
  async obtenerCuentaSesion(id_sesion) {
    if (supabase) {
      try {
        const { data: cuenta, error } = await supabase
          .from('vw_cuenta_sesion')
          .select('*')
          .eq('id_sesion', id_sesion)
          .single();

        if (!error && cuenta) {
          // Obtener además el detalle desglosado de pedidos de la sesión
          const { data: pedidos } = await supabase
            .from('pedidos')
            .select(`
              id_pedido,
              numero_ticket,
              estado,
              creado_en,
              detalle_pedidos (
                id_detalle,
                cantidad,
                precio_unitario_historico,
                subtotal_base,
                estado_estacion,
                observaciones_item,
                platos (nombre),
                detalle_pedido_opciones (
                  precio_adicional_historico,
                  opciones_personalizacion (nombre)
                )
              )
            `)
            .eq('id_sesion', id_sesion);

          return {
            ...cuenta,
            pedidos: pedidos || []
          };
        }
      } catch (err) {
        console.warn('Fallo Supabase en obtenerCuentaSesion, usando mock store:', err.message);
      }
    }

    // Mock Store Fallback calculando vw_cuenta_sesion
    const sesion = mockDb.sesiones_mesa.find(s => s.id_sesion === id_sesion);
    if (!sesion) {
      throw new Error('Sesión no encontrada');
    }

    const mesa = mockDb.mesas.find(m => m.id_mesa === sesion.id_mesa);
    const pedidosSesion = mockDb.pedidos.filter(p => p.id_sesion === id_sesion && p.estado !== 'CANCELADO');

    let totalConsumido = 0;
    const desglosePedidos = [];

    pedidosSesion.forEach(ped => {
      const detalles = mockDb.detalle_pedidos.filter(d => d.id_pedido === ped.id_pedido && d.estado_estacion !== 'CANCELADO');
      const detFormateados = detalles.map(det => {
        const plato = mockDb.platos.find(p => p.id_plato === det.id_plato);
        const subtotalBase = Number(det.cantidad) * Number(det.precio_unitario_historico);

        const opciones = mockDb.detalle_pedido_opciones.filter(dpo => dpo.id_detalle === det.id_detalle);
        let totalExtrasPorUnidad = 0;
        const opcionesFmt = opciones.map(dpo => {
          const op = mockDb.opciones_personalizacion.find(o => o.id_opcion === dpo.id_opcion);
          totalExtrasPorUnidad += Number(dpo.precio_adicional_historico || 0);
          return {
            precio_adicional_historico: dpo.precio_adicional_historico,
            opciones_personalizacion: { nombre: op ? op.nombre : 'Opción' }
          };
        });

        const subtotalConExtras = subtotalBase + (Number(det.cantidad) * totalExtrasPorUnidad);
        totalConsumido += subtotalConExtras;

        return {
          id_detalle: det.id_detalle,
          cantidad: det.cantidad,
          precio_unitario_historico: det.precio_unitario_historico,
          subtotal_base: subtotalBase,
          subtotal_total: subtotalConExtras,
          estado_estacion: det.estado_estacion,
          observaciones_item: det.observaciones_item,
          platos: { nombre: plato ? plato.nombre : 'Plato' },
          detalle_pedido_opciones: opcionesFmt
        };
      });

      desglosePedidos.push({
        id_pedido: ped.id_pedido,
        numero_ticket: ped.numero_ticket,
        estado: ped.estado,
        creado_en: ped.creado_en,
        detalle_pedidos: detFormateados
      });
    });

    const pagosSesion = mockDb.pagos.filter(p => p.id_sesion === id_sesion && p.estado === 'COMPLETADO');
    const totalPagado = pagosSesion.reduce((sum, p) => sum + Number(p.monto), 0);
    const saldoPendiente = Math.max(0, totalConsumido - totalPagado);

    return {
      id_sesion,
      numero_mesa: mesa ? mesa.numero_mesa : 'M-07',
      estado_sesion: sesion.estado,
      total_consumido: Number(totalConsumido.toFixed(2)),
      total_pagado: Number(totalPagado.toFixed(2)),
      saldo_pendiente: Number(saldoPendiente.toFixed(2)),
      pedidos: desglosePedidos
    };
  },

  async registrarPago({ id_sesion, metodo_pago, monto, propina = 0, referencia_pasarela = null, id_cajero = null }) {
    const metodosValidos = ['TARJETA_ONLINE', 'YAPE', 'PLIN', 'POS_FISICO', 'EFECTIVO'];
    if (!metodosValidos.includes(metodo_pago)) {
      throw new Error(`Método de pago no válido: ${metodo_pago}`);
    }

    const io = getIO();

    if (supabase) {
      try {
        // 1. Insertar pago
        const { data: nuevoPago, error: pagoErr } = await supabase
          .from('pagos')
          .insert([
            {
              id_sesion,
              id_cajero: id_cajero ? Number(id_cajero) : null,
              metodo_pago,
              monto: Number(monto),
              propina: Number(propina) || 0.00,
              estado: 'COMPLETADO',
              referencia_pasarela: referencia_pasarela || `REF-${Date.now()}`
            }
          ])
          .select()
          .single();

        if (pagoErr) throw pagoErr;

        // 2. Revisar saldo pendiente en vw_cuenta_sesion
        const { data: cuenta } = await supabase
          .from('vw_cuenta_sesion')
          .select('*')
          .eq('id_sesion', id_sesion)
          .single();

        let sesionCerrada = false;
        let mesaLiberada = null;

        if (cuenta && Number(cuenta.saldo_pendiente) <= 0) {
          // Cerrar sesión
          await supabase
            .from('sesiones_mesa')
            .update({ estado: 'CERRADA', cerrada_en: new Date().toISOString() })
            .eq('id_sesion', id_sesion);

          // Obtener mesa asociada para cambiar a LIBRE
          const { data: sesionData } = await supabase
            .from('sesiones_mesa')
            .select('id_mesa, mesas(numero_mesa)')
            .eq('id_sesion', id_sesion)
            .single();

          if (sesionData) {
            await supabase
              .from('mesas')
              .update({ estado: 'LIBRE' })
              .eq('id_mesa', sesionData.id_mesa);

            mesaLiberada = sesionData.mesas?.numero_mesa;
          }
          sesionCerrada = true;
        }

        if (io) {
          io.to(`mesa_${id_sesion}`).emit('pago_procesado', {
            id_pago: nuevoPago.id_pago,
            monto,
            saldo_pendiente: cuenta ? cuenta.saldo_pendiente : 0,
            sesion_cerrada: sesionCerrada
          });
          io.to('mozos').emit('pago_notificado', {
            id_sesion,
            metodo_pago,
            monto,
            mesa: mesaLiberada,
            sesion_cerrada: sesionCerrada
          });
        }

        return {
          pago: nuevoPago,
          cuenta,
          sesion_cerrada: sesionCerrada
        };
      } catch (err) {
        console.warn('Fallo Supabase en registrarPago, usando mock store:', err.message);
      }
    }

    // Mock Store Fallback
    const nuevoPago = {
      id_pago: `pago-${Date.now()}`,
      id_sesion,
      id_cajero: id_cajero ? Number(id_cajero) : null,
      metodo_pago,
      monto: Number(monto),
      propina: Number(propina) || 0.00,
      estado: 'COMPLETADO',
      referencia_pasarela: referencia_pasarela || `REF-${Date.now()}`,
      pagado_en: new Date().toISOString()
    };
    mockDb.pagos.push(nuevoPago);

    const cuentaActual = await this.obtenerCuentaSesion(id_sesion);
    let sesionCerrada = false;
    let mesaLiberada = cuentaActual.numero_mesa;

    if (cuentaActual.saldo_pendiente <= 0) {
      const sesion = mockDb.sesiones_mesa.find(s => s.id_sesion === id_sesion);
      if (sesion) {
        sesion.estado = 'CERRADA';
        sesion.cerrada_en = new Date().toISOString();
        const mesa = mockDb.mesas.find(m => m.id_mesa === sesion.id_mesa);
        if (mesa) {
          mesa.estado = 'LIBRE';
        }
      }
      sesionCerrada = true;
    }

    if (io) {
      io.to(`mesa_${id_sesion}`).emit('pago_procesado', {
        id_pago: nuevoPago.id_pago,
        monto,
        saldo_pendiente: cuentaActual.saldo_pendiente,
        sesion_cerrada: sesionCerrada
      });
      io.to('mozos').emit('pago_notificado', {
        id_sesion,
        metodo_pago,
        monto,
        mesa: mesaLiberada,
        sesion_cerrada: sesionCerrada
      });
    }

    return {
      pago: nuevoPago,
      cuenta: cuentaActual,
      sesion_cerrada: sesionCerrada
    };
  }
};


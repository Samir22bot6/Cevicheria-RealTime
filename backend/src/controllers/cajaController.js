import { supabase } from '../config/supabase.js';
import { mockDb } from '../services/mockStore.js';
import { PedidoService } from '../services/pedidoService.js';

export const CajaController = {
  /**
   * GET /api/v1/caja/tickets-pendientes
   * Lista todos los pedidos en estado PENDIENTE_PAGO para cobro en caja
   */
  async obtenerTicketsPendientes(req, res) {
    try {
      if (supabase) {
        try {
          const { data: pedidos, error } = await supabase
            .from('pedidos')
            .select(`
              id_pedido,
              numero_ticket,
              origen,
              estado,
              notas_generales,
              creado_en,
              id_sesion,
              sesiones_mesa (
                id_mesa,
                mesas (
                  numero_mesa
                )
              ),
              detalle_pedidos (
                id_detalle,
                cantidad,
                observaciones_item,
                platos (
                  nombre,
                  precio_base
                ),
                detalle_pedido_opciones (
                  opciones_personalizacion (
                    nombre,
                    precio_adicional
                  )
                )
              )
            `)
            .eq('estado', 'PENDIENTE_PAGO')
            .order('creado_en', { ascending: false });

          if (!error && pedidos) {
            const formateados = pedidos.map(p => {
              let montoTotal = 0;
              const items = (p.detalle_pedidos || []).map(d => {
                let precioUnitario = Number(d.platos?.precio_base || 0);
                const opciones = (d.detalle_pedido_opciones || []).map(o => {
                  const add = Number(o.opciones_personalizacion?.precio_adicional || 0);
                  precioUnitario += add;
                  return o.opciones_personalizacion?.nombre;
                }).filter(Boolean);

                const subtotal = precioUnitario * Number(d.cantidad || 1);
                montoTotal += subtotal;

                return {
                  id_detalle: d.id_detalle,
                  plato_nombre: d.platos?.nombre || 'Plato',
                  cantidad: d.cantidad,
                  observaciones: d.observaciones_item,
                  opciones: opciones.join(', '),
                  subtotal
                };
              });

              return {
                id_pedido: p.id_pedido,
                numero_ticket: p.numero_ticket,
                codigo_ticket: p.numero_ticket,
                numero_mesa: p.sesiones_mesa?.mesas?.numero_mesa || 'M-??',
                id_sesion: p.id_sesion,
                creado_en: p.creado_en,
                notas_generales: p.notas_generales,
                monto_total: Number(montoTotal.toFixed(2)),
                items
              };
            });

            return res.json({ ok: true, data: formateados });
          }
        } catch (supErr) {
          console.warn('Fallo Supabase en obtenerTicketsPendientes, usando mock:', supErr.message);
        }
      }

      // Mock Store Fallback
      const pedidosMock = mockDb.pedidos
        .filter(p => p.estado === 'PENDIENTE_PAGO')
        .sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en))
        .map(p => {
          const sesion = mockDb.sesiones_mesa.find(s => s.id_sesion === p.id_sesion);
          const mesa = sesion ? mockDb.mesas.find(m => m.id_mesa === sesion.id_mesa) : null;
          const detalles = mockDb.detalle_pedidos.filter(d => d.id_pedido === p.id_pedido);

          let montoTotal = 0;
          const items = detalles.map(d => {
            const plato = mockDb.platos.find(pl => pl.id_plato === d.id_plato);
            let precioUnit = Number(plato?.precio_base || 0);

            const opcionesIds = mockDb.detalle_pedido_opciones
              .filter(dpo => dpo.id_detalle === d.id_detalle);
            const opNombres = opcionesIds.map(dpo => {
              const op = mockDb.opciones_personalizacion.find(o => o.id_opcion === dpo.id_opcion);
              if (op) precioUnit += Number(op.precio_adicional || 0);
              return op ? op.nombre : null;
            }).filter(Boolean);

            const sub = precioUnit * Number(d.cantidad || 1);
            montoTotal += sub;

            return {
              id_detalle: d.id_detalle,
              plato_nombre: plato ? plato.nombre : 'Plato Marino',
              cantidad: d.cantidad,
              observaciones: d.observaciones_item,
              opciones: opNombres.join(', '),
              subtotal: sub
            };
          });

          return {
            id_pedido: p.id_pedido,
            numero_ticket: p.numero_ticket,
            codigo_ticket: p.numero_ticket,
            numero_mesa: mesa ? mesa.numero_mesa : 'M-03',
            id_sesion: p.id_sesion,
            creado_en: p.creado_en,
            notas_generales: p.notas_generales,
            monto_total: Number(montoTotal.toFixed(2)),
            items
          };
        });

      return res.json({ ok: true, data: pedidosMock });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  },

  /**
   * POST /api/v1/caja/confirmar-cobro
   * Confirma el pago en caja física de un ticket y dispara el pedido a cocina
   */
  async confirmarCobro(req, res) {
    try {
      const { id_pedido, codigo_ticket, metodo_pago = 'EFECTIVO' } = req.body;
      let targetId = id_pedido;

      // Si nos pasaron el código_ticket en vez de id_pedido, buscar el id_pedido
      if (!targetId && codigo_ticket) {
        if (supabase) {
          const { data } = await supabase
            .from('pedidos')
            .select('id_pedido')
            .eq('numero_ticket', codigo_ticket)
            .single();
          if (data) targetId = data.id_pedido;
        }
        if (!targetId) {
          const foundMock = mockDb.pedidos.find(p => p.numero_ticket === codigo_ticket);
          if (foundMock) targetId = foundMock.id_pedido;
        }
      }

      if (!targetId) {
        return res.status(400).json({ ok: false, error: 'id_pedido o codigo_ticket no válido o no encontrado' });
      }

      const referencia = `CAJA_${metodo_pago}_${Date.now()}`;
      const resultado = await PedidoService.activarPedidoPagado(targetId, referencia);

      return res.json({
        ok: true,
        mensaje: 'Cobro en caja confirmado con éxito. Pedido enviado a cocina.',
        data: resultado
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }
};

import { supabase } from '../config/supabase.js';
import { mockDb } from './mockStore.js';
import { getIO } from '../sockets/socketHandler.js';
import { MercadoPagoService } from './mercadoPagoService.js';

export const PedidoService = {
  /**
   * 1. Crear Pedido en Espera de Pago (PENDIENTE_PAGO)
   *    NO emite a cocina hasta que el pago sea confirmado.
   *    Genera y devuelve la orden de pago de Mercado Pago.
   */
  async crearPedido({ id_sesion, notas_generales, items, origen = 'QR_CLIENTE', qr_token, metodo_preferido }) {
    if (!id_sesion) throw new Error('id_sesion es requerido');
    if (!items || !items.length) throw new Error('El pedido debe tener al menos un ítem');

    const numeroTicket = `ESP-${Math.floor(1000 + Math.random() * 9000)}`;
    let montoTotal = 0;
    let pedidoId = null;
    const detalleCreado = [];

    // --- FLUJO SUPABASE ---
    if (supabase) {
      try {
        // 1. Insertar pedido con estado PENDIENTE_PAGO
        const { data: pedido, error: pedErr } = await supabase
          .from('pedidos')
          .insert([
            {
              id_sesion,
              numero_ticket: numeroTicket,
              origen,
              estado: 'PENDIENTE_PAGO',
              notas_generales: notas_generales || null
            }
          ])
          .select('*, sesiones_mesa(id_mesa, mesas(numero_mesa))')
          .single();

        if (pedErr) throw pedErr;
        pedidoId = pedido.id_pedido;

        // 2. Insertar detalles
        for (const item of items) {
          const { data: plato } = await supabase
            .from('platos')
            .select('precio_base, nombre, id_estacion, estaciones_cocina(nombre)')
            .eq('id_plato', item.id_plato)
            .single();

          const precioHistorico = plato ? Number(plato.precio_base) : 0;
          let subtotalItem = precioHistorico * Number(item.cantidad || 1);

          const { data: det, error: detErr } = await supabase
            .from('detalle_pedidos')
            .insert([
              {
                id_pedido: pedido.id_pedido,
                id_plato: item.id_plato,
                cantidad: item.cantidad,
                precio_unitario_historico: precioHistorico,
                estado_estacion: 'PENDIENTE',
                observaciones_item: item.observaciones_item || null
              }
            ])
            .select()
            .single();

          if (detErr) throw detErr;

          // 3. Insertar opciones elegidas
          const opcionesNombres = [];
          if (item.opciones_ids && item.opciones_ids.length > 0) {
            for (const id_opcion of item.opciones_ids) {
              const { data: opcion } = await supabase
                .from('opciones_personalizacion')
                .select('nombre, precio_adicional')
                .eq('id_opcion', id_opcion)
                .single();

              if (opcion) {
                const precioExtra = Number(opcion.precio_adicional) || 0;
                subtotalItem += precioExtra * Number(item.cantidad || 1);
                await supabase
                  .from('detalle_pedido_opciones')
                  .insert([
                    {
                      id_detalle: det.id_detalle,
                      id_opcion,
                      precio_adicional_historico: precioExtra
                    }
                  ]);
                opcionesNombres.push(opcion.nombre);
              }
            }
          }

          montoTotal += subtotalItem;
          const estacionNombre = plato?.estaciones_cocina?.nombre || 'BARRA_FRIA';
          detalleCreado.push({
            id_detalle: det.id_detalle,
            id_pedido: pedido.id_pedido,
            numero_ticket: numeroTicket,
            numero_mesa: pedido.sesiones_mesa?.mesas?.numero_mesa || 'M-??',
            estacion: estacionNombre,
            plato: plato?.nombre || 'Plato',
            cantidad: item.cantidad,
            estado_estacion: 'PENDIENTE',
            observaciones_item: item.observaciones_item || '',
            personalizaciones: opcionesNombres.length ? opcionesNombres.join(', ') : 'Estándar',
            hora_pedido: pedido.creado_en,
            minutos_espera: 0
          });
        }

        // 4. Generar orden de Mercado Pago vinculada al pedido y su monto exacto
        const ordenPago = await MercadoPagoService.crearOrden({
          id_sesion,
          qr_token,
          metodo_preferido: metodo_preferido || 'TARJETA_ONLINE',
          monto: Number(montoTotal.toFixed(2)),
          propina: 0,
          id_pedido: pedidoId
        });

        // IMPORTANTE: NO se emite a cocina aquí (prepago obligatorio)
        return {
          ok: true,
          id_pedido: pedidoId,
          numero_ticket: numeroTicket,
          codigo_ticket: numeroTicket,
          estado: 'PENDIENTE_PAGO',
          monto_total: Number(montoTotal.toFixed(2)),
          orden_pago: ordenPago,
          items: detalleCreado
        };
      } catch (err) {
        console.warn('Fallo Supabase en crearPedido, usando mock store:', err.message);
      }
    }

    // --- FLUJO MOCK STORE FALLBACK ---
    const sesion = mockDb.sesiones_mesa.find(s => s.id_sesion === id_sesion);
    const mesa = sesion ? mockDb.mesas.find(m => m.id_mesa === sesion.id_mesa) : null;
    const numeroMesa = mesa ? mesa.numero_mesa : 'M-07';

    pedidoId = mockDb.pedidos.length + 1;
    const nuevoPedido = {
      id_pedido: pedidoId,
      id_sesion,
      numero_ticket: numeroTicket,
      origen,
      estado: 'PENDIENTE_PAGO',
      notas_generales: notas_generales || null,
      creado_en: new Date().toISOString()
    };
    mockDb.pedidos.push(nuevoPedido);

    const itemsKds = [];
    montoTotal = 0;

    items.forEach((item) => {
      const plato = mockDb.platos.find(p => p.id_plato === item.id_plato);
      const precioUnit = plato ? Number(plato.precio_base) : 30.00;
      let subtotalItem = precioUnit * Number(item.cantidad || 1);
      const estacion = plato ? mockDb.estaciones_cocina.find(e => e.id_estacion === plato.id_estacion) : null;
      const estacionNombre = estacion ? estacion.nombre : 'BARRA_FRIA';

      const detalleId = mockDb.detalle_pedidos.length + 1;
      const detalle = {
        id_detalle: detalleId,
        id_pedido: nuevoPedido.id_pedido,
        id_plato: item.id_plato,
        cantidad: Number(item.cantidad) || 1,
        precio_unitario_historico: precioUnit,
        estado_estacion: 'PENDIENTE',
        observaciones_item: item.observaciones_item || null
      };
      mockDb.detalle_pedidos.push(detalle);

      const nombresOpciones = [];
      if (item.opciones_ids && item.opciones_ids.length > 0) {
        item.opciones_ids.forEach(idOp => {
          const op = mockDb.opciones_personalizacion.find(o => o.id_opcion === idOp);
          if (op) {
            const precioExtra = Number(op.precio_adicional) || 0;
            subtotalItem += precioExtra * Number(item.cantidad || 1);
            mockDb.detalle_pedido_opciones.push({
              id_detalle: detalleId,
              id_opcion: idOp,
              precio_adicional_historico: precioExtra
            });
            nombresOpciones.push(op.nombre);
          }
        });
      }

      montoTotal += subtotalItem;
      const itemKds = {
        id_detalle: detalleId,
        id_pedido: nuevoPedido.id_pedido,
        numero_ticket: numeroTicket,
        numero_mesa: numeroMesa,
        estacion: estacionNombre,
        plato: plato ? plato.nombre : 'Plato Marino',
        cantidad: detalle.cantidad,
        estado_estacion: 'PENDIENTE',
        observaciones_item: detalle.observaciones_item || '',
        personalizaciones: nombresOpciones.length ? nombresOpciones.join(', ') : 'Estándar',
        hora_pedido: nuevoPedido.creado_en,
        minutos_espera: 0
      };
      itemsKds.push(itemKds);
    });

    const ordenPago = await MercadoPagoService.crearOrden({
      id_sesion,
      qr_token,
      metodo_preferido: metodo_preferido || 'TARJETA_ONLINE',
      monto: Number(montoTotal.toFixed(2)),
      propina: 0,
      id_pedido: pedidoId
    });

    // NO se emite a cocina hasta confirmación de pago
    return {
      ok: true,
      id_pedido: pedidoId,
      numero_ticket: numeroTicket,
      codigo_ticket: numeroTicket,
      estado: 'PENDIENTE_PAGO',
      monto_total: Number(montoTotal.toFixed(2)),
      orden_pago: ordenPago,
      items: itemsKds
    };
  },

  /**
   * 2. Confirmar Pago y Activar Pedido a Cocina
   *    Cambia estado de PENDIENTE_PAGO a PENDIENTE, registra hora_confirmacion
   *    y emite por Socket.io a cocina_*, mozos y mesa del cliente.
   */
  async activarPedidoPagado(id_pedido, referencia = null) {
    if (!id_pedido) throw new Error('id_pedido es requerido');
    const io = getIO();
    const idPedidoNum = Number(id_pedido);
    let itemsParaCocina = [];
    let numeroTicket = '';
    let idSesion = null;
    let numeroMesa = 'M-??';
    const horaConfirmacion = new Date().toISOString();

    // Normalizar método de pago
    let metodoPagoNorm = 'YAPE';
    const refUpper = String(referencia || '').toUpperCase();
    if (refUpper.includes('PLIN')) metodoPagoNorm = 'PLIN';
    else if (refUpper.includes('TARJETA') || refUpper.includes('ONLINE')) metodoPagoNorm = 'TARJETA_ONLINE';
    else if (refUpper.includes('POS')) metodoPagoNorm = 'POS_FISICO';
    else if (refUpper.includes('EFECTIVO')) metodoPagoNorm = 'EFECTIVO';
    else if (refUpper.includes('YAPE')) metodoPagoNorm = 'YAPE';

    if (supabase) {
      try {
        // 1. Actualizar estado del pedido a PENDIENTE
        const { data: pedActualizado, error: pedErr } = await supabase
          .from('pedidos')
          .update({
            estado: 'PENDIENTE',
            hora_confirmacion: horaConfirmacion
          })
          .eq('id_pedido', idPedidoNum)
          .select('*')
          .single();

        if (pedErr) throw pedErr;

        if (pedActualizado) {
          numeroTicket = pedActualizado.numero_ticket;
          idSesion = pedActualizado.id_sesion;

          // Obtener mesa asociada
          try {
            const { data: sesionData } = await supabase
              .from('sesiones_mesa')
              .select('id_mesa, mesas(numero_mesa)')
              .eq('id_sesion', idSesion)
              .single();
            if (sesionData?.mesas?.numero_mesa) {
              numeroMesa = sesionData.mesas.numero_mesa;
            }
          } catch (mErr) {
            console.warn('No se pudo obtener mesa en activarPedidoPagado:', mErr.message);
          }

          // Consultar detalles para la cocina y calcular monto exacto
          const { data: detalles } = await supabase
            .from('detalle_pedidos')
            .select(`
              id_detalle,
              cantidad,
              precio_unitario_historico,
              subtotal_base,
              estado_estacion,
              observaciones_item,
              platos (precio_base, nombre, id_estacion, estaciones_cocina(nombre)),
              detalle_pedido_opciones (precio_adicional_historico, opciones_personalizacion(nombre))
            `)
            .eq('id_pedido', idPedidoNum);

          let montoPedido = 0;
          if (detalles && detalles.length > 0) {
            detalles.forEach(d => {
              const sub = Number(d.subtotal_base) || (Number(d.cantidad) * Number(d.precio_unitario_historico || d.platos?.precio_base || 0));
              let extras = 0;
              (d.detalle_pedido_opciones || []).forEach(o => {
                extras += Number(o.precio_adicional_historico || 0) * Number(d.cantidad || 1);
              });
              montoPedido += (sub + extras);
            });
            montoPedido = Math.max(0.01, Number(montoPedido.toFixed(2)));

            // Registrar pago COMPLETADO en la tabla pagos para actualizar vw_cuenta_sesion
            try {
              const { data: pagoPendiente } = await supabase
                .from('pagos')
                .select('id_pago')
                .eq('id_sesion', idSesion)
                .eq('estado', 'PENDIENTE')
                .order('pagado_en', { ascending: false })
                .limit(1)
                .single();

              if (pagoPendiente) {
                await supabase
                  .from('pagos')
                  .update({
                    estado: 'COMPLETADO',
                    metodo_pago: metodoPagoNorm,
                    monto: montoPedido,
                    referencia_pasarela: referencia || `PREPAGO-${Date.now()}`,
                    pagado_en: horaConfirmacion
                  })
                  .eq('id_pago', pagoPendiente.id_pago);
              } else {
                await supabase
                  .from('pagos')
                  .insert([
                    {
                      id_sesion: idSesion,
                      metodo_pago: metodoPagoNorm,
                      monto: montoPedido,
                      propina: 0.00,
                      estado: 'COMPLETADO',
                      referencia_pasarela: referencia || `PREPAGO-${Date.now()}`,
                      pagado_en: horaConfirmacion
                    }
                  ]);
              }
            } catch (pErr) {
              console.warn('Error al registrar pago en Supabase:', pErr.message);
            }

            itemsParaCocina = detalles.map(d => {
              const opts = (d.detalle_pedido_opciones || [])
                .map(o => o.opciones_personalizacion?.nombre)
                .filter(Boolean);
              return {
                id_detalle: d.id_detalle,
                id_pedido: idPedidoNum,
                numero_ticket: numeroTicket,
                numero_mesa: numeroMesa,
                estacion: d.platos?.estaciones_cocina?.nombre || 'BARRA_FRIA',
                plato: d.platos?.nombre || 'Plato',
                cantidad: d.cantidad,
                estado_estacion: d.estado_estacion || 'PENDIENTE',
                observaciones_item: d.observaciones_item || '',
                personalizaciones: opts.length ? opts.join(', ') : 'Estándar',
                hora_pedido: pedActualizado.creado_en,
                minutos_espera: 0
              };
            });
          }
        }
      } catch (err) {
        console.warn('Fallo Supabase en activarPedidoPagado, usando fallback:', err.message);
      }
    }

    // Mock Store Fallback
    if (itemsParaCocina.length === 0) {
      const pedidoMock = mockDb.pedidos.find(p => p.id_pedido === idPedidoNum);
      if (pedidoMock) {
        pedidoMock.estado = 'PENDIENTE';
        pedidoMock.hora_confirmacion = horaConfirmacion;
        numeroTicket = pedidoMock.numero_ticket;
        idSesion = pedidoMock.id_sesion;

        const sesion = mockDb.sesiones_mesa.find(s => s.id_sesion === idSesion);
        const mesa = sesion ? mockDb.mesas.find(m => m.id_mesa === sesion.id_mesa) : null;
        numeroMesa = mesa ? mesa.numero_mesa : 'M-07';

        let montoPedidoMock = 0;
        const detallesMock = mockDb.detalle_pedidos.filter(d => d.id_pedido === idPedidoNum);
        detallesMock.forEach(d => {
          const plato = mockDb.platos.find(p => p.id_plato === d.id_plato);
          const subBase = Number(d.cantidad) * Number(d.precio_unitario_historico || plato?.precio_base || 0);
          const ops = mockDb.detalle_pedido_opciones.filter(dpo => dpo.id_detalle === d.id_detalle);
          let extras = 0;
          ops.forEach(o => {
            extras += Number(o.precio_adicional_historico || 0) * Number(d.cantidad || 1);
          });
          montoPedidoMock += (subBase + extras);
        });
        montoPedidoMock = Math.max(0.01, Number(montoPedidoMock.toFixed(2)));

        const pagoMockPend = mockDb.pagos.find(p => p.id_sesion === idSesion && p.estado === 'PENDIENTE');
        if (pagoMockPend) {
          pagoMockPend.estado = 'COMPLETADO';
          pagoMockPend.metodo_pago = metodoPagoNorm;
          pagoMockPend.monto = montoPedidoMock;
          pagoMockPend.referencia_pasarela = referencia || `PREPAGO-${Date.now()}`;
          pagoMockPend.pagado_en = horaConfirmacion;
        } else {
          mockDb.pagos.push({
            id_pago: `pago-${Date.now()}`,
            id_sesion: idSesion,
            id_pedido: idPedidoNum,
            metodo_pago: metodoPagoNorm,
            monto: montoPedidoMock,
            propina: 0,
            estado: 'COMPLETADO',
            referencia_pasarela: referencia || `PREPAGO-${Date.now()}`,
            pagado_en: horaConfirmacion
          });
        }

        detallesMock.forEach(d => {
          const plato = mockDb.platos.find(p => p.id_plato === d.id_plato);
          const estacion = plato ? mockDb.estaciones_cocina.find(e => e.id_estacion === plato.id_estacion) : null;
          const estacionNombre = estacion ? estacion.nombre : 'BARRA_FRIA';
          const opts = mockDb.detalle_pedido_opciones.filter(o => o.id_detalle === d.id_detalle);
          const nombresOpts = opts
            .map(o => mockDb.opciones_personalizacion.find(op => op.id_opcion === o.id_opcion)?.nombre)
            .filter(Boolean);

          itemsParaCocina.push({
            id_detalle: d.id_detalle,
            id_pedido: idPedidoNum,
            numero_ticket: numeroTicket,
            numero_mesa: numeroMesa,
            estacion: estacionNombre,
            plato: plato ? plato.nombre : 'Plato Marino',
            cantidad: d.cantidad,
            estado_estacion: d.estado_estacion || 'PENDIENTE',
            observaciones_item: d.observaciones_item || '',
            personalizaciones: nombresOpts.length ? nombresOpts.join(', ') : 'Estándar',
            hora_pedido: pedidoMock.creado_en,
            minutos_espera: 0
          });
        });
      }
    }

    // 4. Emitir Socket.io hacia cocina, mozos y mesa del cliente
    if (io) {
      if (itemsParaCocina.length > 0) {
        itemsParaCocina.forEach(item => {
          io.to(`cocina_${item.estacion}`).emit('nuevo_pedido_item', item);
        });
        io.to('cocina_TODAS').emit('nuevo_pedido_lote', itemsParaCocina);
        io.to('mozos').emit('nuevo_pedido_mozos', {
          id_pedido: idPedidoNum,
          numero_ticket: numeroTicket,
          id_sesion: idSesion,
          items: itemsParaCocina
        });
      }

      if (idSesion) {
        io.to(`mesa_${idSesion}`).emit('pedido_pagado_confirmado', {
          id_pedido: idPedidoNum,
          numero_ticket: numeroTicket,
          estado: 'PENDIENTE',
          items: itemsParaCocina
        });
        io.to(`mesa_${idSesion}`).emit('pago_confirmado', {
          id_pedido: idPedidoNum,
          referencia_pasarela: referencia || `PREPAGO-${Date.now()}`
        });
        io.to(`mesa_${idSesion}`).emit('pago_procesado', {
          id_pedido: idPedidoNum,
          id_sesion: idSesion
        });
      }
    }

    return {
      ok: true,
      id_pedido: idPedidoNum,
      numero_ticket: numeroTicket,
      estado: 'PENDIENTE',
      items: itemsParaCocina
    };
  }
};

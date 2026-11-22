import { supabase } from '../config/supabase.js';
import { mockDb } from './mockStore.js';
import { getIO } from '../sockets/socketHandler.js';

export const PedidoService = {
  async crearPedido({ id_sesion, notas_generales, items, origen = 'QR_CLIENTE' }) {
    if (!id_sesion) throw new Error('id_sesion es requerido');
    if (!items || !items.length) throw new Error('El pedido debe tener al menos un ítem');

    const numeroTicket = `TK-${Date.now().toString().slice(-6)}`;
    const io = getIO();

    if (supabase) {
      try {
        // 1. Insertar pedido principal
        const { data: pedido, error: pedErr } = await supabase
          .from('pedidos')
          .insert([
            {
              id_sesion,
              numero_ticket: numeroTicket,
              origen,
              estado: 'RECIBIDO',
              notas_generales: notas_generales || null
            }
          ])
          .select('*, sesiones_mesa(id_mesa, mesas(numero_mesa))')
          .single();

        if (pedErr) throw pedErr;

        const detalleCreado = [];

        // 2. Insertar detalles
        for (const item of items) {
          // Buscar plato para precio histórico
          const { data: plato } = await supabase
            .from('platos')
            .select('precio_base, nombre, id_estacion, estaciones_cocina(nombre)')
            .eq('id_plato', item.id_plato)
            .single();

          const precioHistorico = plato ? Number(plato.precio_base) : 0;

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
                await supabase
                  .from('detalle_pedido_opciones')
                  .insert([
                    {
                      id_detalle: det.id_detalle,
                      id_opcion,
                      precio_adicional_historico: Number(opcion.precio_adicional) || 0
                    }
                  ]);
                opcionesNombres.push(opcion.nombre);
              }
            }
          }

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

        // Emitir evento por Socket.io a cocinas y mozos
        if (io) {
          detalleCreado.forEach(item => {
            io.to(`cocina_${item.estacion}`).emit('nuevo_pedido_item', item);
          });
          io.to('cocina_TODAS').emit('nuevo_pedido_lote', detalleCreado);
          io.to('mozos').emit('nuevo_pedido_mozos', {
            id_pedido: pedido.id_pedido,
            numero_ticket: numeroTicket,
            id_sesion,
            items: detalleCreado
          });
        }

        return {
          id_pedido: pedido.id_pedido,
          numero_ticket: numeroTicket,
          items: detalleCreado
        };
      } catch (err) {
        console.warn('Fallo Supabase en crearPedido, usando mock store:', err.message);
      }
    }

    // Mock Store Fallback
    const sesion = mockDb.sesiones_mesa.find(s => s.id_sesion === id_sesion);
    const mesa = sesion ? mockDb.mesas.find(m => m.id_mesa === sesion.id_mesa) : null;
    const numeroMesa = mesa ? mesa.numero_mesa : 'M-07';

    const nuevoPedido = {
      id_pedido: mockDb.pedidos.length + 1,
      id_sesion,
      numero_ticket: numeroTicket,
      origen,
      estado: 'RECIBIDO',
      notas_generales: notas_generales || null,
      creado_en: new Date().toISOString()
    };
    mockDb.pedidos.push(nuevoPedido);

    const itemsKds = [];

    items.forEach((item, idx) => {
      const plato = mockDb.platos.find(p => p.id_plato === item.id_plato);
      const precioUnit = plato ? plato.precio_base : 30.00;
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
            mockDb.detalle_pedido_opciones.push({
              id_detalle: detalleId,
              id_opcion: idOp,
              precio_adicional_historico: op.precio_adicional
            });
            nombresOpciones.push(op.nombre);
          }
        });
      }

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

    if (io) {
      itemsKds.forEach(item => {
        io.to(`cocina_${item.estacion}`).emit('nuevo_pedido_item', item);
      });
      io.to('cocina_TODAS').emit('nuevo_pedido_lote', itemsKds);
      io.to('mozos').emit('nuevo_pedido_mozos', {
        id_pedido: nuevoPedido.id_pedido,
        numero_ticket: numeroTicket,
        id_sesion,
        items: itemsKds
      });
    }

    return {
      id_pedido: nuevoPedido.id_pedido,
      numero_ticket: numeroTicket,
      items: itemsKds
    };
  }
};


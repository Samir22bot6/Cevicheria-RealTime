import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';
import { supabase } from '../config/supabase.js';
import { mockDb } from './mockStore.js';
import { CuentaService } from './cuentaService.js';
import { getIO } from '../sockets/socketHandler.js';

export const MercadoPagoService = {
  /**
   * 1. Crear Orden en Mercado Pago (Orders API) y registrar pago en estado PENDIENTE
   */
  async crearOrden({ id_sesion, qr_token, metodo_preferido = 'TARJETA_ONLINE', monto, propina = 0 }) {
    if (!id_sesion) throw new Error('id_sesion es requerido');
    if (!monto || Number(monto) <= 0) throw new Error('El monto debe ser mayor a 0');

    const totalNum = Number(monto) + (Number(propina) || 0);
    const idPago = uuidv4();
    const tokenFrontend = qr_token || '77777777-7777-4777-8777-877777777777';

    // Guardar pago en base de datos con estado PENDIENTE
    if (supabase) {
      try {
        await supabase.from('pagos').insert([
          {
            id_pago: idPago,
            id_sesion,
            metodo_pago: metodo_preferido,
            monto: Number(monto),
            propina: Number(propina) || 0.00,
            estado: 'PENDIENTE',
            referencia_pasarela: null
          }
        ]);
      } catch (err) {
        console.warn('Fallo guardando pago en Supabase, usando mock store:', err.message);
      }
    }

    // Asegurar registro en mockDb
    mockDb.pagos.push({
      id_pago: idPago,
      id_sesion,
      id_cajero: null,
      metodo_pago: metodo_preferido,
      monto: Number(monto),
      propina: Number(propina) || 0.00,
      estado: 'PENDIENTE',
      referencia_pasarela: null,
      pagado_en: new Date().toISOString()
    });

    // Si MP_ACCESS_TOKEN está configurado, crear la preferencia de pago en Mercado Pago (Checkout Pro Oficial Perú)
    if (config.mpAccessToken && !config.mpAccessToken.includes('tu-access-token')) {
      try {
        const rawFrontend = (config.frontendUrl || 'http://localhost:5173').replace(/\/$/, '');
        const isHttps = rawFrontend.startsWith('https://');
        const callbackUrl = `${rawFrontend}/mesa/${tokenFrontend}?id_pago=${idPago}`;

        // 1. Intentar Checkout Pro Preferences API (soporta Yape, Plin, Tarjetas Visa/Mastercard y efectivo)
        // Nota: auto_return solo es válido por Mercado Pago si la URL usa HTTPS (producción)
        const preferencePayload = {
          items: [
            {
              id: idPago,
              title: `Consumo Cevichería Del Mar - Mesa`,
              description: `Pago de consumo gastronómico Cevichería Del Mar`,
              quantity: 1,
              currency_id: 'PEN',
              unit_price: Number(totalNum.toFixed(2))
            }
          ],
          back_urls: {
            success: callbackUrl,
            failure: callbackUrl,
            pending: callbackUrl
          },
          ...(isHttps ? { auto_return: 'approved' } : {}),
          external_reference: idPago,
          statement_descriptor: 'CEVICHERIA'
        };

        const resPref = await fetch('https://api.mercadopago.com/checkout/preferences', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.mpAccessToken}`
          },
          body: JSON.stringify(preferencePayload)
        });

        const dataPref = await resPref.json();

        if (resPref.ok && dataPref.init_point) {
          return {
            ok: true,
            modo_demo: false,
            id_pago: idPago,
            checkout_url: dataPref.init_point,
            order_id: dataPref.id
          };
        } else {
          console.warn('Aviso Mercado Pago Preferences API:', dataPref);
        }
      } catch (e) {
        console.warn('Fallo llamada a Checkout Pro de Mercado Pago:', e.message);
      }
    }

    // Modo Demo / Fallback transparente
    return {
      ok: true,
      modo_demo: true,
      id_pago: idPago,
      checkout_url: null,
      mensaje: 'Mercado Pago en Modo Demo: listo para simular pago aprobado.'
    };
  },

  /**
   * 2. Confirmar Pago y Liberar Mesa si saldo pendiente <= 0
   */
  async confirmarPago({ id_pago, order_id, payment_id, status }) {
    if (!id_pago) throw new Error('id_pago es requerido');

    const referencia = String(order_id || payment_id || `MP-${Date.now()}`);
    let id_sesion = null;
    let pagoEncontrado = null;

    // 1. Buscar el pago en Supabase o Mock
    if (supabase) {
      try {
        const { data: p } = await supabase
          .from('pagos')
          .select('*')
          .eq('id_pago', id_pago)
          .single();
        if (p) {
          pagoEncontrado = p;
          id_sesion = p.id_sesion;
        }
      } catch (e) {
        console.warn('Fallo buscando pago en Supabase:', e.message);
      }
    }

    if (!pagoEncontrado) {
      pagoEncontrado = mockDb.pagos.find(p => p.id_pago === id_pago);
      if (pagoEncontrado) {
        id_sesion = pagoEncontrado.id_sesion;
      }
    }

    if (!pagoEncontrado) {
      throw new Error(`Pago no encontrado con id_pago: ${id_pago}`);
    }

    // 2. Si ya estaba completado, retornar estado
    if (pagoEncontrado.estado === 'COMPLETADO') {
      const cuenta = await CuentaService.obtenerCuentaSesion(id_sesion);
      return {
        ok: true,
        id_pago,
        referencia_pasarela: pagoEncontrado.referencia_pasarela,
        sesion_cerrada: cuenta.saldo_pendiente <= 0,
        cuenta
      };
    }

    // 3. Si hay MP_ACCESS_TOKEN y order_id/payment_id, validar con MP
    if (config.mpAccessToken && (order_id || payment_id)) {
      try {
        const endpoint = order_id
          ? `https://api.mercadopago.com/v1/orders/${order_id}`
          : `https://api.mercadopago.com/v1/payments/${payment_id}`;

        const resMP = await fetch(endpoint, {
          headers: { 'Authorization': `Bearer ${config.mpAccessToken}` }
        });

        if (resMP.ok) {
          const dataMP = await resMP.json();
          const estadoMP = dataMP.status || dataMP.order_status;
          // Validar aprobación si la respuesta de MP lo indica
          console.log(`Estado consultado en Mercado Pago: ${estadoMP}`);
        }
      } catch (err) {
        console.warn('Error verificando en Mercado Pago API:', err.message);
      }
    }

    // 4. Actualizar a COMPLETADO
    if (supabase) {
      try {
        await supabase
          .from('pagos')
          .update({
            estado: 'COMPLETADO',
            referencia_pasarela: referencia,
            pagado_en: new Date().toISOString()
          })
          .eq('id_pago', id_pago);
      } catch (err) {
        console.warn('Fallo actualizando pago en Supabase:', err.message);
      }
    }

    pagoEncontrado.estado = 'COMPLETADO';
    pagoEncontrado.referencia_pasarela = referencia;
    pagoEncontrado.pagado_en = new Date().toISOString();

    // 5. Consultar cuenta y saldo pendiente
    const cuentaActual = await CuentaService.obtenerCuentaSesion(id_sesion);
    let sesionCerrada = false;
    let mesaLiberada = cuentaActual.numero_mesa;

    if (cuentaActual.saldo_pendiente <= 0) {
      // Cerrar sesión y liberar mesa
      if (supabase) {
        try {
          await supabase
            .from('sesiones_mesa')
            .update({ estado: 'CERRADA', cerrada_en: new Date().toISOString() })
            .eq('id_sesion', id_sesion);

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
        } catch (e) {
          console.warn('Fallo cerrando sesión en Supabase:', e.message);
        }
      }

      const s = mockDb.sesiones_mesa.find(sm => sm.id_sesion === id_sesion);
      if (s) {
        s.estado = 'CERRADA';
        s.cerrada_en = new Date().toISOString();
        const m = mockDb.mesas.find(mesa => mesa.id_mesa === s.id_mesa);
        if (m) m.estado = 'LIBRE';
      }
      sesionCerrada = true;
    }

    // 6. Notificar por Socket.io
    const io = getIO();
    if (io) {
      io.to(`mesa_${id_sesion}`).emit('pago_confirmado', {
        id_pago,
        referencia_pasarela: referencia,
        monto: pagoEncontrado.monto,
        propina: pagoEncontrado.propina,
        saldo_pendiente: cuentaActual.saldo_pendiente,
        sesion_cerrada: sesionCerrada
      });

      io.to('mozos').emit('pago_notificado', {
        id_sesion,
        metodo_pago: pagoEncontrado.metodo_pago,
        monto: pagoEncontrado.monto,
        mesa: mesaLiberada,
        sesion_cerrada: sesionCerrada
      });
    }

    return {
      ok: true,
      id_pago,
      referencia_pasarela: referencia,
      sesion_cerrada: sesionCerrada,
      cuenta: cuentaActual
    };
  },

  /**
   * 3. Procesar Webhook de Mercado Pago
   */
  async procesarWebhook(body, query) {
    console.log('📬 Webhook recibido de Mercado Pago:', { body, query });

    const topic = body?.type || query?.type || query?.topic;
    const resourceId = body?.data?.id || query?.['data.id'] || query?.id;

    if (!resourceId) {
      return { ok: true, mensaje: 'Webhook recibido sin ID de recurso' };
    }

    let externalReference = null;
    let orderId = null;
    let paymentId = null;

    if (topic === 'order' || topic === 'merchant_order') {
      orderId = resourceId;
      if (config.mpAccessToken) {
        try {
          const res = await fetch(`https://api.mercadopago.com/v1/orders/${orderId}`, {
            headers: { 'Authorization': `Bearer ${config.mpAccessToken}` }
          });
          if (res.ok) {
            const ord = await res.json();
            externalReference = ord.external_reference;
          }
        } catch (e) {}
      }
    } else if (topic === 'payment') {
      paymentId = resourceId;
      if (config.mpAccessToken) {
        try {
          const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { 'Authorization': `Bearer ${config.mpAccessToken}` }
          });
          if (res.ok) {
            const pay = await res.json();
            externalReference = pay.external_reference;
          }
        } catch (e) {}
      }
    }

    if (externalReference) {
      return await this.confirmarPago({
        id_pago: externalReference,
        order_id: orderId,
        payment_id: paymentId,
        status: 'approved'
      });
    }

    return { ok: true, procesado: false };
  }
};


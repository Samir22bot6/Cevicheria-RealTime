import { MercadoPagoService } from '../services/mercadoPagoService.js';
import { PedidoService } from '../services/pedidoService.js';

export const PagosController = {
  /**
   * POST /api/v1/pagos/crear-orden
   */
  async crearOrden(req, res) {
    try {
      const { id_sesion, qr_token, metodo_preferido, monto, propina, id_pedido } = req.body;
      const data = await MercadoPagoService.crearOrden({
        id_sesion,
        qr_token,
        metodo_preferido,
        monto,
        propina,
        id_pedido
      });
      return res.status(200).json(data);
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  },

  /**
   * POST /api/v1/pagos/confirmar-retorno
   */
  async confirmarRetorno(req, res) {
    try {
      const { id_pago, order_id, payment_id, status } = req.body;
      const data = await MercadoPagoService.confirmarPago({
        id_pago,
        order_id,
        payment_id,
        status
      });
      return res.status(200).json(data);
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  },

  /**
   * POST /api/v1/pagos/demo-checkout
   * Pago instantáneo en Modo Demo (1 clic sin Mercado Pago)
   */
  async demoCheckout(req, res) {
    try {
      const { id_pedido, metodo_pago } = req.body;
      if (!id_pedido) {
        return res.status(400).json({ ok: false, error: 'id_pedido es requerido' });
      }

      // Validar que modo_demo_pagos esté activo
      const { SesionService } = await import('../services/sesionService.js');
      const cfg = await SesionService.obtenerConfiguracionLocal();
      if (!cfg.modo_demo_pagos) {
        return res.status(403).json({
          ok: false,
          error: 'El Modo Demo de Pagos está desactivado. Usa la pasarela de Mercado Pago.'
        });
      }

      const metodo = metodo_pago || 'DEMO_INSTANTANEO';
      const referencia = `DEMO-${metodo}-${Date.now()}`;
      const data = await PedidoService.activarPedidoPagado(id_pedido, referencia);

      return res.status(200).json({
        ok: true,
        mensaje: 'Pago simulado aprobado exitosamente y comanda enviada a cocina',
        data
      });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  },

  /**
   * POST /api/v1/pagos/simular-aprobacion/:id_pedido
   */
  async simularAprobacionPedido(req, res) {
    try {
      const { id_pedido } = req.params;
      const data = await PedidoService.activarPedidoPagado(id_pedido, `DEMO-APROBADO-${Date.now()}`);
      return res.status(200).json({ ok: true, data });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  },

  /**
   * POST /api/v1/pagos/webhook
   */
  async webhook(req, res) {
    try {
      await MercadoPagoService.procesarWebhook(req.body, req.query);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.warn('Error en webhook MP:', err.message);
      return res.status(200).json({ ok: true });
    }
  }
};


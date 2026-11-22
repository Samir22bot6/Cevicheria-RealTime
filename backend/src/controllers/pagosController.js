import { MercadoPagoService } from '../services/mercadoPagoService.js';

export const PagosController = {
  /**
   * POST /api/v1/pagos/crear-orden
   */
  async crearOrden(req, res) {
    try {
      const { id_sesion, qr_token, metodo_preferido, monto, propina } = req.body;
      const data = await MercadoPagoService.crearOrden({
        id_sesion,
        qr_token,
        metodo_preferido,
        monto,
        propina
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


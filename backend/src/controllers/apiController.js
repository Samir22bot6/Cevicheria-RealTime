import { SesionService } from '../services/sesionService.js';
import { CartaService } from '../services/cartaService.js';
import { PedidoService } from '../services/pedidoService.js';
import { KdsService } from '../services/kdsService.js';
import { CuentaService } from '../services/cuentaService.js';
import { ResenaService } from '../services/resenaService.js';
import { IaService } from '../services/iaService.js';

export const SesionController = {
  async abrir(req, res) {
    try {
      const token = req.body.codigo_qr_token || req.body.qrToken;
      const comensales = req.body.cantidad_comensales ?? 1;
      const latitud = req.body.latitud ?? null;
      const longitud = req.body.longitud ?? null;

      if (!token) {
        return res.status(400).json({ ok: false, error: 'codigo_qr_token o qrToken es requerido' });
      }

      const data = await SesionService.abrirSesion(token, comensales, latitud, longitud);
      return res.status(200).json({ ok: true, data });
    } catch (err) {
      const status = err.statusCode || 500;
      return res.status(status).json({
        ok: false,
        error: err.message,
        codigo: err.codigo || undefined
      });
    }
  },

  async llamarMozo(req, res) {
    try {
      const { id_sesion } = req.params;
      const { numero_mesa, motivo } = req.body || {};
      const data = await SesionService.llamarMozo({ id_sesion, numero_mesa, motivo });
      return res.status(200).json({ ok: true, data });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  },

  async listarMesas(req, res) {
    try {
      const mesas = await SesionService.listarMesas();
      return res.status(200).json({ ok: true, data: mesas });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }
};

export const CartaController = {
  async obtener(req, res) {
    try {
      const carta = await CartaService.obtenerCarta();
      return res.status(200).json({ ok: true, data: carta });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }
};

export const PedidoController = {
  async crear(req, res) {
    try {
      const { id_sesion, notas_generales, items, origen } = req.body;
      const resultado = await PedidoService.crearPedido({
        id_sesion,
        notas_generales,
        items,
        origen
      });
      return res.status(201).json({ ok: true, data: resultado });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  }
};

export const KdsController = {
  async listar(req, res) {
    try {
      const { estacion } = req.query;
      const kds = await KdsService.obtenerKds(estacion);
      return res.status(200).json({ ok: true, data: kds });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  },

  async actualizarEstado(req, res) {
    try {
      const { id_detalle } = req.params;
      const { estado } = req.body;
      if (!estado) {
        return res.status(400).json({ error: 'El estado_estacion es requerido' });
      }
      const resultado = await KdsService.actualizarEstadoDetalle(id_detalle, estado);
      return res.status(200).json({ ok: true, data: resultado });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  }
};

export const CuentaController = {
  async obtener(req, res) {
    try {
      const { id_sesion } = req.params;
      const cuenta = await CuentaService.obtenerCuentaSesion(id_sesion);
      return res.status(200).json({ ok: true, data: cuenta });
    } catch (err) {
      return res.status(404).json({ ok: false, error: err.message });
    }
  },

  async pagar(req, res) {
    try {
      const { id_sesion, metodo_pago, monto, propina, referencia_pasarela, id_cajero } = req.body;
      if (!id_sesion || !metodo_pago || !monto) {
        return res.status(400).json({ error: 'id_sesion, metodo_pago y monto son requeridos' });
      }

      // Si viene usuario autenticado en token, usarlo como id_cajero si no fue enviado
      const cajeroFinal = id_cajero || (req.usuario ? req.usuario.id_usuario : null);

      const resultado = await CuentaService.registrarPago({
        id_sesion,
        metodo_pago,
        monto,
        propina,
        referencia_pasarela,
        id_cajero: cajeroFinal
      });
      return res.status(200).json({ ok: true, data: resultado });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  }
};

export const ResenaController = {
  async registrar(req, res) {
    try {
      const { id_sesion, calificacion, comentario } = req.body;
      const resultado = await ResenaService.registrarResena({
        id_sesion,
        calificacion,
        comentario
      });
      return res.status(201).json({ ok: true, ...resultado });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  }
};

export const IaController = {
  async recomendar(req, res) {
    try {
      const { mensaje_cliente, contexto_pedido } = req.body;
      const resultado = await IaService.recomendar({
        mensaje_cliente,
        contexto_pedido
      });
      return res.status(200).json({ ok: true, data: resultado });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }
};


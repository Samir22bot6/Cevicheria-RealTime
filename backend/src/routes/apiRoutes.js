import { Router } from 'express';
import {
  SesionController,
  CartaController,
  PedidoController,
  KdsController,
  CuentaController,
  ResenaController,
  IaController
} from '../controllers/apiController.js';
import { AuthController } from '../controllers/authController.js';
import { AdminController } from '../controllers/adminController.js';
import { PagosController } from '../controllers/pagosController.js';
import { CajaController } from '../controllers/cajaController.js';
import { verificarAuth, requerirRol, validarSesionActiva } from '../middlewares/authMiddleware.js';

const router = Router();

// ==========================================
// 1. AUTENTICACIÓN PERSONAL
// ==========================================
router.post('/auth/login', AuthController.login);

// ==========================================
// 2. RUTAS PÚBLICAS / CLIENTES QR
// ==========================================
router.post('/sesiones/abrir', SesionController.abrir);
router.get('/sesiones/config-publica', SesionController.obtenerConfigPublica);
router.post('/sesiones/:id_sesion/llamar-mozo', SesionController.llamarMozo);
router.get('/sesiones/mesas', SesionController.listarMesas);
router.get('/sesiones/:id_sesion/cuenta', CuentaController.obtener);

router.get('/carta', CartaController.obtener);
router.post('/pedidos', validarSesionActiva, PedidoController.crear);
router.post('/pagos', CuentaController.pagar);
router.post('/resenas', ResenaController.registrar);
router.post('/ia/recomendar', IaController.recomendar);

// Integración Mercado Pago (Orders API + Webhooks) y Modo Demo
router.post('/pagos/crear-orden', PagosController.crearOrden);
router.post('/pagos/confirmar-retorno', PagosController.confirmarRetorno);
router.post('/pagos/demo-checkout', PagosController.demoCheckout);
router.post('/pagos/simular-aprobacion/:id_pedido', PagosController.simularAprobacionPedido);
router.post('/pagos/webhook', PagosController.webhook);

// Gestión de Caja y Tickets Presenciales
router.get('/caja/tickets-pendientes', CajaController.obtenerTicketsPendientes);
router.post('/caja/confirmar-cobro', CajaController.confirmarCobro);

// ==========================================
// 3. KDS COCINA (Protegido para roles de cocina y admin)
// ==========================================
router.get(
  '/kds',
  verificarAuth,
  requerirRol('ADMIN', 'COCINA_FRIA', 'COCINA_CALIENTE'),
  KdsController.listar
);
router.patch(
  '/kds/detalle/:id_detalle/estado',
  verificarAuth,
  requerirRol('ADMIN', 'COCINA_FRIA', 'COCINA_CALIENTE', 'MOZO'),
  KdsController.actualizarEstado
);

// ==========================================
// 4. MÓDULO ADMINISTRATIVO COMPLETO (Rol ADMIN)
// ==========================================
const adminRouter = Router();
adminRouter.use(verificarAuth, requerirRol('ADMIN'));

// Metadatos para formularios
adminRouter.get('/meta/opciones-estaciones', AdminController.obtenerOpcionesYEstaciones);

// Configuración del local / Geocerca GPS
adminRouter.get('/configuracion', AdminController.obtenerConfiguracion);
adminRouter.put('/configuracion', AdminController.actualizarConfiguracion);

// Categorías
adminRouter.get('/categorias', AdminController.listarCategorias);
adminRouter.post('/categorias', AdminController.crearCategoria);
adminRouter.put('/categorias/:id', AdminController.actualizarCategoria);
adminRouter.delete('/categorias/:id', AdminController.eliminarCategoria);

// Platos
adminRouter.get('/platos', AdminController.listarPlatos);
adminRouter.post('/platos', AdminController.crearPlato);
adminRouter.put('/platos/:id', AdminController.actualizarPlato);
adminRouter.delete('/platos/:id', AdminController.eliminarPlato);

// Zonas
adminRouter.get('/zonas', AdminController.listarZonas);
adminRouter.post('/zonas', AdminController.crearZona);
adminRouter.put('/zonas/:id', AdminController.actualizarZona);
adminRouter.delete('/zonas/:id', AdminController.eliminarZona);

// Mesas
adminRouter.get('/mesas', AdminController.listarMesas);
adminRouter.post('/mesas', AdminController.crearMesa);
adminRouter.put('/mesas/:id', AdminController.actualizarMesa);
adminRouter.post('/mesas/:id/regenerar-qr', AdminController.regenerarQrMesa);
adminRouter.delete('/mesas/:id', AdminController.eliminarMesa);

// Personal / Usuarios
adminRouter.get('/usuarios', AdminController.listarUsuarios);
adminRouter.post('/usuarios', AdminController.crearUsuario);
adminRouter.patch('/usuarios/:id', AdminController.actualizarUsuario);

// Personalizaciones / Grupos de Opciones
adminRouter.get('/grupos-opciones', AdminController.listarGruposOpciones);
adminRouter.post('/grupos-opciones', AdminController.crearGrupoOpcion);
adminRouter.put('/grupos-opciones/:id', AdminController.actualizarGrupoOpcion);
adminRouter.delete('/grupos-opciones/:id', AdminController.eliminarGrupoOpcion);

adminRouter.post('/opciones-personalizacion', AdminController.crearOpcionPersonalizacion);
adminRouter.put('/opciones-personalizacion/:id', AdminController.actualizarOpcionPersonalizacion);
adminRouter.delete('/opciones-personalizacion/:id', AdminController.eliminarOpcionPersonalizacion);

// Reseñas y Métricas
adminRouter.get('/resenas', AdminController.obtenerMetricasYResenas);

// Asignación de Mozo a Mesa y Pedido desde Mozo
adminRouter.post('/mesas/:id_mesa/asignar-mozo', async (req, res) => {
  try {
    const { SesionService } = await import('../services/sesionService.js');
    const { id_mozo } = req.body;
    const sesion = await SesionService.obtenerSesionActivaPorMesa(req.params.id_mesa);
    if (!sesion) return res.status(404).json({ ok: false, error: 'No hay sesión abierta en esta mesa' });
    const actualizada = await SesionService.asignarMozoSesion(sesion.id_sesion, id_mozo);
    res.json({ ok: true, data: actualizada });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

adminRouter.get('/mesas/:id_mesa/sesion-activa', async (req, res) => {
  try {
    const { SesionService } = await import('../services/sesionService.js');
    const sesion = await SesionService.obtenerSesionActivaPorMesa(req.params.id_mesa);
    res.json({ ok: true, data: sesion });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

router.use('/admin', adminRouter);

export default router;

import io from 'socket.io-client';

// Configuración dinámica de API y WebSockets sin barra final
const RAW_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const CLEAN_BASE = RAW_URL.replace(/\/$/, '');

// Si VITE_API_URL ya incluye '/api/v1', no duplicarlo
const API_BASE_URL = CLEAN_BASE.endsWith('/api/v1')
  ? CLEAN_BASE
  : `${CLEAN_BASE}/api/v1`;

// Para Socket.io necesitamos el origen raíz del servidor backend
const SOCKET_URL = CLEAN_BASE.replace(/\/api\/v1$/, '');

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling']
});

// Helper para headers con Auth Token
const getHeaders = (extra = {}) => {
  const token = localStorage.getItem('cevicheria_token');
  const headers = {
    'Content-Type': 'application/json',
    ...extra
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const api = {
  // --- AUTH ---
  async login(email, password) {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return res.json();
  },

  // --- CLIENTE / QR ---
  async abrirSesion(codigo_qr_token, cantidad_comensales = 1, latitud = null, longitud = null) {
    const body = { codigo_qr_token, cantidad_comensales };
    if (latitud !== null && longitud !== null) {
      body.latitud = latitud;
      body.longitud = longitud;
    }
    const res = await fetch(`${API_BASE_URL}/sesiones/abrir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    data._statusCode = res.status;
    return data;
  },

  async llamarMozo(id_sesion, numero_mesa, motivo) {
    const res = await fetch(`${API_BASE_URL}/sesiones/${id_sesion}/llamar-mozo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero_mesa, motivo })
    });
    return res.json();
  },

  async listarMesasPublicas() {
    const res = await fetch(`${API_BASE_URL}/sesiones/mesas`);
    return res.json();
  },

  async obtenerCarta() {
    const res = await fetch(`${API_BASE_URL}/carta`);
    return res.json();
  },

  async crearPedido(datos) {
    const res = await fetch(`${API_BASE_URL}/pedidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return res.json();
  },

  async obtenerCuenta(id_sesion) {
    const res = await fetch(`${API_BASE_URL}/sesiones/${id_sesion}/cuenta`);
    return res.json();
  },

  async pagar(datos) {
    const res = await fetch(`${API_BASE_URL}/pagos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return res.json();
  },

  // --- MERCADO PAGO PERÚ (ORDERS API) ---
  async crearOrdenMercadoPago(datos) {
    const res = await fetch(`${API_BASE_URL}/pagos/crear-orden`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return res.json();
  },

  async confirmarRetornoMercadoPago(datos) {
    const res = await fetch(`${API_BASE_URL}/pagos/confirmar-retorno`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return res.json();
  },

  async simularAprobacionPedido(id_pedido) {
    const res = await fetch(`${API_BASE_URL}/pagos/simular-aprobacion/${id_pedido}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return res.json();
  },

  async enviarResena(datos) {
    const res = await fetch(`${API_BASE_URL}/resenas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    return res.json();
  },

  async consultarIA(mensaje_cliente, contexto_pedido) {
    const res = await fetch(`${API_BASE_URL}/ia/recomendar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensaje_cliente, contexto_pedido })
    });
    return res.json();
  },

  // --- KDS ---
  async obtenerKds(estacion) {
    const url = estacion && estacion !== 'TODAS'
      ? `${API_BASE_URL}/kds?estacion=${estacion}`
      : `${API_BASE_URL}/kds`;
    const res = await fetch(url, { headers: getHeaders() });
    return res.json();
  },

  async actualizarEstadoKds(id_detalle, estado) {
    const res = await fetch(`${API_BASE_URL}/kds/detalle/${id_detalle}/estado`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ estado })
    });
    return res.json();
  },

  // --- ADMIN: METADATOS ---
  async obtenerMetaAdmin() {
    const res = await fetch(`${API_BASE_URL}/admin/meta/opciones-estaciones`, {
      headers: getHeaders()
    });
    return res.json();
  },

  // --- ADMIN: CATEGORÍAS ---
  async adminListarCategorias() {
    const res = await fetch(`${API_BASE_URL}/admin/categorias`, { headers: getHeaders() });
    return res.json();
  },

  async adminCrearCategoria(datos) {
    const res = await fetch(`${API_BASE_URL}/admin/categorias`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(datos)
    });
    return res.json();
  },

  async adminActualizarCategoria(id, datos) {
    const res = await fetch(`${API_BASE_URL}/admin/categorias/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(datos)
    });
    return res.json();
  },

  async adminEliminarCategoria(id) {
    const res = await fetch(`${API_BASE_URL}/admin/categorias/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return res.json();
  },

  // --- ADMIN: PLATOS ---
  async adminListarPlatos() {
    const res = await fetch(`${API_BASE_URL}/admin/platos`, { headers: getHeaders() });
    return res.json();
  },

  async adminCrearPlato(datos) {
    const res = await fetch(`${API_BASE_URL}/admin/platos`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(datos)
    });
    return res.json();
  },

  async adminActualizarPlato(id, datos) {
    const res = await fetch(`${API_BASE_URL}/admin/platos/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(datos)
    });
    return res.json();
  },

  async adminEliminarPlato(id) {
    const res = await fetch(`${API_BASE_URL}/admin/platos/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return res.json();
  },

  // --- ADMIN: ZONAS ---
  async adminListarZonas() {
    const res = await fetch(`${API_BASE_URL}/admin/zonas`, { headers: getHeaders() });
    return res.json();
  },

  async adminCrearZona(datos) {
    const res = await fetch(`${API_BASE_URL}/admin/zonas`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(datos)
    });
    return res.json();
  },

  async adminActualizarZona(id, datos) {
    const res = await fetch(`${API_BASE_URL}/admin/zonas/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(datos)
    });
    return res.json();
  },

  async adminEliminarZona(id) {
    const res = await fetch(`${API_BASE_URL}/admin/zonas/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return res.json();
  },

  // --- ADMIN: MESAS ---
  async adminListarMesas() {
    const res = await fetch(`${API_BASE_URL}/admin/mesas`, { headers: getHeaders() });
    return res.json();
  },

  async adminCrearMesa(datos) {
    const res = await fetch(`${API_BASE_URL}/admin/mesas`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(datos)
    });
    return res.json();
  },

  async adminActualizarMesa(id, datos) {
    const res = await fetch(`${API_BASE_URL}/admin/mesas/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(datos)
    });
    return res.json();
  },

  async adminRegenerarQrMesa(id) {
    const res = await fetch(`${API_BASE_URL}/admin/mesas/${id}/regenerar-qr`, {
      method: 'POST',
      headers: getHeaders()
    });
    return res.json();
  },

  async adminEliminarMesa(id) {
    const res = await fetch(`${API_BASE_URL}/admin/mesas/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return res.json();
  },

  // --- ADMIN: PERSONAL / USUARIOS ---
  async adminListarUsuarios() {
    const res = await fetch(`${API_BASE_URL}/admin/usuarios`, { headers: getHeaders() });
    return res.json();
  },

  async adminCrearUsuario(datos) {
    const res = await fetch(`${API_BASE_URL}/admin/usuarios`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(datos)
    });
    return res.json();
  },

  async adminActualizarUsuario(id, datos) {
    const res = await fetch(`${API_BASE_URL}/admin/usuarios/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(datos)
    });
    return res.json();
  },

  // --- ADMIN: PERSONALIZACIONES / GRUPOS DE OPCIONES ---
  async adminListarGruposOpciones() {
    const res = await fetch(`${API_BASE_URL}/admin/grupos-opciones`, { headers: getHeaders() });
    return res.json();
  },

  async adminCrearGrupoOpcion(datos) {
    const res = await fetch(`${API_BASE_URL}/admin/grupos-opciones`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(datos)
    });
    return res.json();
  },

  async adminActualizarGrupoOpcion(id, datos) {
    const res = await fetch(`${API_BASE_URL}/admin/grupos-opciones/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(datos)
    });
    return res.json();
  },

  async adminEliminarGrupoOpcion(id) {
    const res = await fetch(`${API_BASE_URL}/admin/grupos-opciones/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return res.json();
  },

  async adminCrearOpcionPersonalizacion(datos) {
    const res = await fetch(`${API_BASE_URL}/admin/opciones-personalizacion`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(datos)
    });
    return res.json();
  },

  async adminActualizarOpcionPersonalizacion(id, datos) {
    const res = await fetch(`${API_BASE_URL}/admin/opciones-personalizacion/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(datos)
    });
    return res.json();
  },

  async adminEliminarOpcionPersonalizacion(id) {
    const res = await fetch(`${API_BASE_URL}/admin/opciones-personalizacion/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return res.json();
  },

  // --- ADMIN: RESEÑAS Y MÉTRICAS ---
  async adminObtenerResenas() {
    const res = await fetch(`${API_BASE_URL}/admin/resenas`, { headers: getHeaders() });
    return res.json();
  },

  // --- ADMIN: ASIGNAR MOZO & SESION ---
  async adminAsignarMozo(id_mesa, id_mozo) {
    const res = await fetch(`${API_BASE_URL}/admin/mesas/${id_mesa}/asignar-mozo`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ id_mozo })
    });
    return res.json();
  },

  async adminObtenerSesionMesa(id_mesa) {
    const res = await fetch(`${API_BASE_URL}/admin/mesas/${id_mesa}/sesion-activa`, {
      headers: getHeaders()
    });
    return res.json();
  },

  // --- ADMIN: CONFIGURACIÓN LOCAL / GEOCERCA GPS ---
  async adminObtenerConfiguracion() {
    const res = await fetch(`${API_BASE_URL}/admin/configuracion`, { headers: getHeaders() });
    return res.json();
  },

  async adminActualizarConfiguracion(datos) {
    const res = await fetch(`${API_BASE_URL}/admin/configuracion`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(datos)
    });
    return res.json();
  }
};

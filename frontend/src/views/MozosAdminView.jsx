import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api, socket } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast, ToastContainer } from '../components/Toast';
import {
  Users,
  LayoutGrid,
  UtensilsCrossed,
  UserCheck,
  Star,
  Bell,
  RefreshCw,
  LogOut,
  Plus,
  Trash2,
  Edit2,
  Check,
  Printer,
  Download,
  AlertCircle,
  Eye,
  EyeOff,
  Search,
  DollarSign,
  UserPlus,
  Box,
  Sliders,
  CheckCircle2,
  X,
  Volume2,
  VolumeX,
  MapPin,
  Navigation
} from 'lucide-react';

export default function MozosAdminView() {
  const { usuario, cerrarSesion } = useAuth();
  const navigate = useNavigate();
  const { showToast, toasts, dismissToast } = useToast();

  // Pestañas: 'salon' | 'mesas_qr' | 'carta' | 'personal' | 'resenas'
  const [pestanaActiva, setPestanaActiva] = useState('salon');

  // Sonido y Alertas
  const [sonidoActivo, setSonidoActivo] = useState(true);

  // Configuración GPS / Geocerca
  const [configuracionGPS, setConfiguracionGPS] = useState({
    nombre_local: 'SIN ESPINAS',
    latitud: -16.4090474,
    longitud: -71.5374510,
    radio_permitido_metros: 80,
    validar_gps: false
  });
  const [guardandoConfig, setGuardandoConfig] = useState(false);
  const [obteniendoUbicacion, setObteniendoUbicacion] = useState(false);

  // Datos Generales
  const [mesas, setMesas] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Carta Admin
  const [categorias, setCategorias] = useState([]);
  const [platos, setPlatos] = useState([]);
  const [gruposOpciones, setGruposOpciones] = useState([]);
  const [metaOpciones, setMetaOpciones] = useState({ grupos_opciones: [], estaciones_cocina: [] });
  const [filtroCategoria, setFiltroCategoria] = useState('TODAS');
  const [busquedaPlato, setBusquedaPlato] = useState('');

  // Personal Admin
  const [usuarios, setUsuarios] = useState([]);

  // Reseñas & Métricas
  const [datosResenas, setDatosResenas] = useState({
    resumen: { total_resenas: 0, promedio_estrellas: 5.0, enviadas_a_google: 0, quejas_internas_count: 0 },
    resenas: [],
    quejas_internas: []
  });

  // Modales
  const [modalZona, setModalZona] = useState({ abierto: false, modo: 'crear', datos: { nombre: '', descripcion: '', activa: true } });
  const [modalMesa, setModalMesa] = useState({ abierto: false, modo: 'crear', datos: { id_zona: '', numero_mesa: '', capacidad: 4, estado: 'LIBRE' } });
  const [modalCategoria, setModalCategoria] = useState({ abierto: false, modo: 'crear', datos: { nombre: '', descripcion: '', orden_visualizacion: 1, activa: true } });
  const [modalPlato, setModalPlato] = useState({
    abierto: false,
    modo: 'crear',
    datos: {
      id_categoria: '',
      id_estacion: 1,
      nombre: '',
      descripcion: '',
      precio_base: '',
      tiempo_prep_estimado_min: 10,
      imagen_url: '',
      modelo_3d_url: '',
      disponible: true,
      es_recomendado_ia: false,
      grupos_opciones_ids: []
    }
  });

  // Modal Personal
  const [modalUsuario, setModalUsuario] = useState({
    abierto: false,
    datos: { nombres: '', apellidos: '', email: '', password: '', rol: 'MOZO' }
  });

  // Modal Grupo Opciones & Extras
  const [modalGrupoOp, setModalGrupoOp] = useState({
    abierto: false,
    modo: 'crear',
    datos: { nombre: '', es_obligatorio: false, seleccion_multiple: false }
  });
  const [modalNuevaOpcion, setModalNuevaOpcion] = useState({
    abierto: false,
    id_grupo_opcion: null,
    nombreGrupo: '',
    datos: { nombre: '', precio_adicional: 0, disponible: true }
  });

  // Modal Cobro y Pedido Mozo
  const [modalCobroMesa, setModalCobroMesa] = useState({ abierto: false, mesa: null, cuenta: null, metodo: 'EFECTIVO', propina: 0, procesando: false });
  const [modalPedidoMozo, setModalPedidoMozo] = useState({ abierto: false, mesa: null, sesion: null, items: [], obs: '' });
  const [modalAsignarMozo, setModalAsignarMozo] = useState({ abierto: false, mesa: null, mozoId: '' });

  // Modal Impresión QR
  const [impresionModal, setImpresionModal] = useState({ abierto: false, mesa: null, modoTodos: false });

  // Modal Confirmación Custom (reemplazo de window.confirm)
  const [modalConfirmacion, setModalConfirmacion] = useState({
    abierto: false,
    titulo: '',
    mensaje: '',
    tipo: 'peligro', // 'peligro' | 'advertencia' | 'info'
    textoBoton: 'Confirmar',
    onConfirmar: null
  });

  const abrirConfirmacion = ({ titulo, mensaje, tipo = 'peligro', textoBoton = 'Confirmar', onConfirmar }) => {
    setModalConfirmacion({
      abierto: true,
      titulo,
      mensaje,
      tipo,
      textoBoton,
      onConfirmar: () => {
        setModalConfirmacion(prev => ({ ...prev, abierto: false }));
        if (onConfirmar) onConfirmar();
      }
    });
  };

  // Utilidad de sonido híbrida: reproduce MP3 si existen en /sounds/ o sintetiza con Web Audio API
  const playNotificationSound = (tipo = 'alerta') => {
    if (!sonidoActivo) return;

    // 1. Intentar reproducir archivo MP3 personalizado si existe en /sounds/
    const rutaAudio = tipo === 'listo' ? '/sounds/campana.mp3' : '/sounds/alerta.mp3';
    const audio = new Audio(rutaAudio);
    audio.play().catch(() => {
      // 2. Si no hay archivo MP3 descargado, usar Web Audio API nativo (sintetizador)
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (tipo === 'listo') {
          // Campana de cocina (plato listo en barra)
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.12);
          gain.gain.setValueAtTime(0.4, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.5);
        } else {
          // Alerta de mozo / llamado de mesa
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, ctx.currentTime);
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
          gain.gain.setValueAtTime(0.5, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.6);
        }
      } catch (e) {
        console.warn('Audio no disponible:', e);
      }
    });
  };

  const obtenerMiUbicacionGPS = () => {
    if (!navigator.geolocation) {
      showToast('error', 'Geolocalización no soportada', 'Tu navegador no permite obtener coordenadas GPS.');
      return;
    }
    setObteniendoUbicacion(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setConfiguracionGPS(prev => ({
          ...prev,
          latitud: parseFloat(pos.coords.latitude.toFixed(7)),
          longitud: parseFloat(pos.coords.longitude.toFixed(7))
        }));
        setObteniendoUbicacion(false);
        showToast('success', 'Ubicación obtenida', `Lat: ${pos.coords.latitude.toFixed(5)}, Lon: ${pos.coords.longitude.toFixed(5)}`);
      },
      (err) => {
        setObteniendoUbicacion(false);
        showToast('error', 'Error GPS', err.message || 'No se pudo obtener tu ubicación actual.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const guardarConfiguracionGPS = async () => {
    setGuardandoConfig(true);
    try {
      const res = await api.adminActualizarConfiguracion(configuracionGPS);
      if (res.ok) {
        if (res.data) setConfiguracionGPS(res.data);
        showToast('success', 'Configuración guardada', 'Los ajustes de geocerca y GPS han sido actualizados.');
      } else {
        showToast('error', 'Error guardando', res.error || 'No se pudo guardar la configuración.');
      }
    } catch (e) {
      showToast('error', 'Error', e.message || 'Error al conectar con el servidor.');
    } finally {
      setGuardandoConfig(false);
    }
  };

  // 1. Cargar datos iniciales de forma resiliente
  const cargarTodo = async () => {
    try {
      setCargando(true);
      const [resMesas, resZonas, resCats, resPlatos, resMeta, resGrupos, resUsers, resResenas, resConfig] = await Promise.allSettled([
        api.adminListarMesas(),
        api.adminListarZonas(),
        api.adminListarCategorias(),
        api.adminListarPlatos(),
        api.obtenerMetaAdmin(),
        api.adminListarGruposOpciones(),
        api.adminListarUsuarios(),
        api.adminObtenerResenas(),
        api.adminObtenerConfiguracion().catch(() => ({ ok: false }))
      ]);

      const val = (res) => (res.status === 'fulfilled' ? res.value : null);

      const dMesas = val(resMesas);
      const dZonas = val(resZonas);
      const dCats = val(resCats);
      const dPlatos = val(resPlatos);
      const dMeta = val(resMeta);
      const dGrupos = val(resGrupos);
      const dUsers = val(resUsers);
      const dResenas = val(resResenas);
      const dConfig = val(resConfig);

      if (dMesas?.ok && Array.isArray(dMesas.data)) setMesas(dMesas.data);
      if (dZonas?.ok && Array.isArray(dZonas.data)) setZonas(dZonas.data);
      if (dCats?.ok && Array.isArray(dCats.data)) setCategorias(dCats.data);
      if (dPlatos?.ok && Array.isArray(dPlatos.data)) setPlatos(dPlatos.data);
      if (dMeta?.ok && dMeta.data) setMetaOpciones(dMeta.data);
      if (dGrupos?.ok && Array.isArray(dGrupos.data)) setGruposOpciones(dGrupos.data);
      if (dUsers?.ok && Array.isArray(dUsers.data)) setUsuarios(dUsers.data);
      if (dResenas?.ok && dResenas.data) setDatosResenas(dResenas.data);
      if (dConfig?.ok && dConfig.data) setConfiguracionGPS(dConfig.data);
    } catch (e) {
      console.error('Error cargando panel de control:', e);
      showToast('error', 'Error al cargar datos', 'Revisa la conexión o intenta refrescar.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarTodo();
  }, []);

  // 2. Sockets en vivo para Salón y alertas
  useEffect(() => {
    socket.emit('unirse_mozos');

    socket.on('llamar_mozo', (alerta) => {
      setAlertas(prev => [
        {
          id_alerta: alerta.id_alerta || `alerta-${Date.now()}`,
          tipo: 'LLAMAR_MOZO',
          numero_mesa: alerta.numero_mesa,
          id_sesion: alerta.id_sesion,
          motivo: alerta.motivo,
          mensaje: alerta.mensaje || `Mesa ${alerta.numero_mesa}: ${alerta.motivo || 'Solicita atención'}`,
          hora: alerta.hora || new Date().toISOString()
        },
        ...prev
      ]);
      playNotificationSound('alerta');
      showToast('info', `🔔 Mesa ${alerta.numero_mesa}`, alerta.motivo || 'Solicita atención');
    });

    socket.on('alerta_mesa', (alerta) => {
      setAlertas(prev => [
        {
          id_alerta: alerta.id_alerta || `alerta-${Date.now()}`,
          ...alerta
        },
        ...prev
      ]);
      playNotificationSound('alerta');
    });

    socket.on('estado_plato_actualizado', (data) => {
      if (data.estado_estacion === 'LISTO') {
        setAlertas(prev => [
          {
            id_alerta: `listo-${Date.now()}-${Math.random()}`,
            tipo: 'PLATO_LISTO',
            numero_mesa: data.numero_mesa,
            mensaje: `Plato listo en cocina: "${data.plato}" para Mesa ${data.numero_mesa}`,
            hora: new Date().toISOString()
          },
          ...prev
        ]);
        playNotificationSound('listo');
      }
    });

    socket.on('mesa_estado_cambiado', () => {
      api.adminListarMesas().then(r => r.ok && setMesas(r.data));
    });

    socket.on('pago_notificado', (data) => {
      api.adminListarMesas().then(r => r.ok && setMesas(r.data));
    });

    return () => {
      socket.off('llamar_mozo');
      socket.off('alerta_mesa');
      socket.off('estado_plato_actualizado');
      socket.off('mesa_estado_cambiado');
      socket.off('pago_notificado');
    };
  }, [sonidoActivo]);

  const handleCerrarSesion = () => {
    cerrarSesion();
    navigate('/login');
  };

  // --- COBRO MANUAL DE CAJERO / ADMIN ---
  const abrirCobro = async (mesa) => {
    try {
      const resSesion = await api.adminObtenerSesionMesa(mesa.id_mesa);
      if (!resSesion.ok || !resSesion.data) {
        showToast('warning', 'Mesa sin sesión', 'Esta mesa no tiene una sesión de consumo abierta.');
        return;
      }
      const resCuenta = await api.obtenerCuenta(resSesion.data.id_sesion);
      if (resCuenta.ok) {
        setModalCobroMesa({
          abierto: true,
          mesa,
          cuenta: resCuenta.data,
          metodo: 'EFECTIVO',
          propina: 0,
          procesando: false
        });
      }
    } catch (e) {
      showToast('error', 'Error de cuenta', 'No se pudo consultar la cuenta de la mesa.');
    }
  };

  const ejecutarCobroAdmin = async () => {
    if (!modalCobroMesa.cuenta) return;
    setModalCobroMesa(prev => ({ ...prev, procesando: true }));
    try {
      const res = await api.pagar({
        id_sesion: modalCobroMesa.cuenta.id_sesion,
        metodo_pago: modalCobroMesa.metodo,
        monto: modalCobroMesa.cuenta.saldo_pendiente,
        propina: Number(modalCobroMesa.propina) || 0,
        referencia_pasarela: `CAJA-${usuario?.nombres}`,
        id_cajero: usuario?.id_usuario
      });

      if (res.ok) {
        showToast('success', '✅ Cobro registrado', `Cobro exitoso por ${usuario?.nombres}`);
        setModalCobroMesa({ abierto: false, mesa: null, cuenta: null, metodo: 'EFECTIVO', propina: 0, procesando: false });
        cargarTodo();
      } else showToast('error', 'Error del servidor', res.error || 'Ocurrió un error inesperado.');
    } catch (e) {
      showToast('error', 'Error de pago', 'No se pudo registrar el pago.');
    }
  };

  // --- ASIGNAR MOZO A MESA ---
  const abrirAsignarMozo = async (mesa) => {
    const res = await api.adminObtenerSesionMesa(mesa.id_mesa);
    if (!res.ok || !res.data) {
      showToast('warning', 'Sesión requerida', 'La mesa debe tener una sesión abierta para asignarle mozo.');
      return;
    }
    setModalAsignarMozo({
      abierto: true,
      mesa,
      mozoId: res.data.id_mozo_asignado || ''
    });
  };

  const guardarAsignacionMozo = async () => {
    try {
      const res = await api.adminAsignarMozo(modalAsignarMozo.mesa.id_mesa, modalAsignarMozo.mozoId);
      if (res.ok) {
        showToast('success', '✅ Mozo asignado', 'El mozo fue asignado a la mesa correctamente.');
        setModalAsignarMozo({ abierto: false, mesa: null, mozoId: '' });
      } else showToast('error', 'Error del servidor', res.error || 'Ocurrió un error inesperado.');
    } catch (e) {
      showToast('error', 'Error', e.message || 'Ocurrió un error inesperado.');
    }
  };

  // --- REGISTRAR PEDIDO DESDE MOZO ---
  const abrirPedidoMozo = async (mesa) => {
    const res = await api.adminObtenerSesionMesa(mesa.id_mesa);
    if (!res.ok || !res.data) {
      showToast('warning', 'Mesa sin sesión', 'Esta mesa no tiene sesión abierta. Primero abra la mesa.');
      return;
    }
    setModalPedidoMozo({
      abierto: true,
      mesa,
      sesion: res.data,
      items: [],
      obs: ''
    });
  };

  const agregarItemMozo = (plato) => {
    setModalPedidoMozo(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id_plato: plato.id_plato,
          nombre: plato.nombre,
          precio_base: plato.precio_base,
          cantidad: 1,
          observaciones_item: '',
          opciones_ids: []
        }
      ]
    }));
  };

  const enviarPedidoMozo = async () => {
    if (modalPedidoMozo.items.length === 0) {
      showToast('warning', 'Comanda vacía', 'Agrega al menos un plato a la comanda.');
      return;
    }

    try {
      const res = await api.crearPedido({
        id_sesion: modalPedidoMozo.sesion.id_sesion,
        notas_generales: modalPedidoMozo.obs || 'Pedido tomado por mozo',
        items: modalPedidoMozo.items,
        origen: 'MOZO_APP'
      });

      if (res.ok) {
        showToast('success', '✅ Comanda enviada', `Ticket ${res.data.numero_ticket} enviado a cocina.`);
        setModalPedidoMozo({ abierto: false, mesa: null, sesion: null, items: [], obs: '' });
      } else showToast('error', 'Error del servidor', res.error || 'Ocurrió un error inesperado.');
    } catch (e) {
      showToast('error', 'Error', e.message || 'Ocurrió un error inesperado.');
    }
  };

  // --- OPERACIONES: USUARIOS / PERSONAL ---
  const guardarUsuario = async (e) => {
    e.preventDefault();
    try {
      const res = await api.adminCrearUsuario(modalUsuario.datos);
      if (res.ok) {
        setUsuarios(prev => [...prev, res.data]);
        setModalUsuario({ abierto: false, datos: { nombres: '', apellidos: '', email: '', password: '', rol: 'MOZO' } });
        showToast('success', '✅ Personal creado', 'La cuenta de personal fue creada con éxito.');
      } else showToast('error', 'Error del servidor', res.error || 'Ocurrió un error inesperado.');
    } catch (err) {
      showToast('error', 'Error', err.message || 'Ocurrió un error inesperado.');
    }
  };

  const toggleUsuarioActivo = async (usr) => {
    try {
      const res = await api.adminActualizarUsuario(usr.id_usuario, { activo: !usr.activo });
      if (res.ok) {
        setUsuarios(prev => prev.map(u => u.id_usuario === usr.id_usuario ? { ...u, activo: !usr.activo } : u));
      }
    } catch (e) {
      showToast('error', 'Error al actualizar', 'No se pudo actualizar el usuario.');
    }
  };

  // --- OPERACIONES: GRUPOS Y EXTRAS ---
  const guardarGrupoOp = async (e) => {
    e.preventDefault();
    try {
      if (modalGrupoOp.modo === 'crear') {
        const res = await api.adminCrearGrupoOpcion(modalGrupoOp.datos);
        if (res.ok) {
          setGruposOpciones(prev => [...prev, res.data]);
          setModalGrupoOp({ abierto: false, modo: 'crear', datos: {} });
        } else showToast('error', 'Error del servidor', res.error || 'Ocurrió un error inesperado.');
      } else {
        const res = await api.adminActualizarGrupoOpcion(modalGrupoOp.datos.id_grupo_opcion, modalGrupoOp.datos);
        if (res.ok) {
          setGruposOpciones(prev => prev.map(g => g.id_grupo_opcion === res.data.id_grupo_opcion ? res.data : g));
          setModalGrupoOp({ abierto: false, modo: 'crear', datos: {} });
        } else showToast('error', 'Error del servidor', res.error || 'Ocurrió un error inesperado.');
      }
    } catch (e) {
      showToast('error', 'Error', e.message || 'Ocurrió un error inesperado.');
    }
  };

  const eliminarGrupoOp = (id_grupo) => {
    abrirConfirmacion({
      titulo: '¿Eliminar grupo de opciones?',
      mensaje: 'Esta acción eliminará el grupo y todas sus opciones personalizadas asociadas.',
      tipo: 'peligro',
      textoBoton: 'Sí, eliminar grupo',
      onConfirmar: async () => {
        try {
          const res = await api.adminEliminarGrupoOpcion(id_grupo);
          if (res.ok) {
            setGruposOpciones(prev => prev.filter(g => g.id_grupo_opcion !== id_grupo));
            showToast('success', 'Grupo eliminado', 'El grupo de opciones fue removido.');
          } else showToast('error', 'Error del servidor', res.error || 'Ocurrió un error inesperado.');
        } catch (e) {
          showToast('error', 'Error', e.message || 'Ocurrió un error inesperado.');
        }
      }
    });
  };

  const guardarOpcionExtra = async (e) => {
    e.preventDefault();
    try {
      const res = await api.adminCrearOpcionPersonalizacion({
        id_grupo_opcion: modalNuevaOpcion.id_grupo_opcion,
        ...modalNuevaOpcion.datos
      });
      if (res.ok) {
        setGruposOpciones(prev => prev.map(g => {
          if (g.id_grupo_opcion === modalNuevaOpcion.id_grupo_opcion) {
            return {
              ...g,
              opciones_personalizacion: [...(g.opciones_personalizacion || []), res.data]
            };
          }
          return g;
        }));
        setModalNuevaOpcion({ abierto: false, id_grupo_opcion: null, nombreGrupo: '', datos: { nombre: '', precio_adicional: 0, disponible: true } });
      } else showToast('error', 'Error del servidor', res.error || 'Ocurrió un error inesperado.');
    } catch (e) {
      showToast('error', 'Error', e.message || 'Ocurrió un error inesperado.');
    }
  };

  const toggleDisponibilidadOpcion = async (op) => {
    try {
      const res = await api.adminActualizarOpcionPersonalizacion(op.id_opcion, { disponible: !op.disponible });
      if (res.ok) {
        setGruposOpciones(prev => prev.map(g => ({
          ...g,
          opciones_personalizacion: (g.opciones_personalizacion || []).map(o => o.id_opcion === op.id_opcion ? { ...o, disponible: !op.disponible } : o)
        })));
      }
    } catch (e) {
      showToast('error', 'Error al actualizar', 'No se pudo actualizar la opción.');
    }
  };

  const eliminarOpcionExtra = (id_opcion, id_grupo) => {
    abrirConfirmacion({
      titulo: '¿Eliminar opción?',
      mensaje: '¿Deseas eliminar permanentemente esta opción de personalización?',
      tipo: 'peligro',
      textoBoton: 'Sí, eliminar',
      onConfirmar: async () => {
        try {
          const res = await api.adminEliminarOpcionPersonalizacion(id_opcion);
          if (res.ok) {
            setGruposOpciones(prev => prev.map(g => {
              if (g.id_grupo_opcion === id_grupo) {
                return {
                  ...g,
                  opciones_personalizacion: g.opciones_personalizacion.filter(o => o.id_opcion !== id_opcion)
                };
              }
              return g;
            }));
            showToast('success', 'Opción eliminada', 'La opción fue removida exitosamente.');
          } else showToast('error', 'Error del servidor', res.error || 'Ocurrió un error inesperado.');
        } catch (e) {
          showToast('error', 'Error', e.message || 'Ocurrió un error inesperado.');
        }
      }
    });
  };

  // --- OPERACIONES: ZONAS Y MESAS ---
  const guardarZona = async (e) => {
    e.preventDefault();
    try {
      if (modalZona.modo === 'crear') {
        const res = await api.adminCrearZona(modalZona.datos);
        if (res.ok) {
          setZonas(prev => [...prev, res.data]);
          setModalZona({ abierto: false, modo: 'crear', datos: {} });
        } else showToast('error', 'Error del servidor', res.error || 'Ocurrió un error inesperado.');
      } else {
        const res = await api.adminActualizarZona(modalZona.datos.id_zona, modalZona.datos);
        if (res.ok) {
          setZonas(prev => prev.map(z => z.id_zona === res.data.id_zona ? res.data : z));
          setModalZona({ abierto: false, modo: 'crear', datos: {} });
        } else showToast('error', 'Error del servidor', res.error || 'Ocurrió un error inesperado.');
      }
    } catch (err) {
      showToast('error', 'Error', err.message || 'Ocurrió un error inesperado.');
    }
  };

  const eliminarZona = (id_zona) => {
    abrirConfirmacion({
      titulo: '¿Eliminar zona?',
      mensaje: '¿Seguro que deseas eliminar esta zona del salón? Las mesas asociadas podrían verse afectadas.',
      tipo: 'peligro',
      textoBoton: 'Sí, eliminar zona',
      onConfirmar: async () => {
        try {
          const res = await api.adminEliminarZona(id_zona);
          if (res.ok) {
            setZonas(prev => prev.filter(z => z.id_zona !== id_zona));
            showToast('success', 'Zona eliminada', 'La zona ha sido removida.');
          } else showToast('error', 'Error del servidor', res.error || 'Ocurrió un error inesperado.');
        } catch (err) {
          showToast('error', 'Error', err.message || 'Ocurrió un error inesperado.');
        }
      }
    });
  };

  const guardarMesa = async (e) => {
    e.preventDefault();
    try {
      if (modalMesa.modo === 'crear') {
        const res = await api.adminCrearMesa(modalMesa.datos);
        if (res.ok) {
          setMesas(prev => [...prev, res.data]);
          setModalMesa({ abierto: false, modo: 'crear', datos: {} });
        } else showToast('error', 'Error del servidor', res.error || 'Ocurrió un error inesperado.');
      } else {
        const res = await api.adminActualizarMesa(modalMesa.datos.id_mesa, modalMesa.datos);
        if (res.ok) {
          setMesas(prev => prev.map(m => m.id_mesa === res.data.id_mesa ? res.data : m));
          setModalMesa({ abierto: false, modo: 'crear', datos: {} });
        } else showToast('error', 'Error del servidor', res.error || 'Ocurrió un error inesperado.');
      }
    } catch (err) {
      showToast('error', 'Error', err.message || 'Ocurrió un error inesperado.');
    }
  };

  const regenerarQr = (id_mesa) => {
    abrirConfirmacion({
      titulo: '¿Regenerar código QR?',
      mensaje: 'El código QR anterior quedará invalidado y cualquier cliente que lo escanee necesitará el nuevo.',
      tipo: 'advertencia',
      textoBoton: 'Regenerar QR',
      onConfirmar: async () => {
        try {
          const res = await api.adminRegenerarQrMesa(id_mesa);
          if (res.ok) {
            setMesas(prev => prev.map(m => m.id_mesa === id_mesa ? { ...m, codigo_qr_token: res.data.nuevo_codigo_qr_token } : m));
            showToast('success', '✅ QR generado', 'Nuevo código QR generado exitosamente.');
          } else showToast('error', 'Error del servidor', res.error || 'Ocurrió un error inesperado.');
        } catch (err) {
          showToast('error', 'Error', err.message || 'Ocurrió un error inesperado.');
        }
      }
    });
  };

  const eliminarMesa = (id_mesa) => {
    abrirConfirmacion({
      titulo: '¿Eliminar mesa?',
      mensaje: '¿Deseas eliminar permanentemente esta mesa del salón?',
      tipo: 'peligro',
      textoBoton: 'Sí, eliminar mesa',
      onConfirmar: async () => {
        try {
          const res = await api.adminEliminarMesa(id_mesa);
          if (res.ok) {
            setMesas(prev => prev.filter(m => m.id_mesa !== id_mesa));
            showToast('success', 'Mesa eliminada', 'La mesa ha sido removida.');
          } else showToast('error', 'Error del servidor', res.error || 'Ocurrió un error inesperado.');
        } catch (err) {
          showToast('error', 'Error', err.message || 'Ocurrió un error inesperado.');
        }
      }
    });
  };

  // --- OPERACIONES: PLATOS ---
  const guardarPlato = async (e) => {
    e.preventDefault();
    try {
      if (modalPlato.modo === 'crear') {
        const res = await api.adminCrearPlato(modalPlato.datos);
        if (res.ok) {
          api.adminListarPlatos().then(r => r.ok && setPlatos(r.data));
          setModalPlato({ abierto: false, modo: 'crear', datos: {} });
        } else showToast('error', 'Error del servidor', res.error || 'Ocurrió un error inesperado.');
      } else {
        const res = await api.adminActualizarPlato(modalPlato.datos.id_plato, modalPlato.datos);
        if (res.ok) {
          api.adminListarPlatos().then(r => r.ok && setPlatos(r.data));
          setModalPlato({ abierto: false, modo: 'crear', datos: {} });
        } else showToast('error', 'Error del servidor', res.error || 'Ocurrió un error inesperado.');
      }
    } catch (err) {
      showToast('error', 'Error', err.message || 'Ocurrió un error inesperado.');
    }
  };

  const toggleDisponibilidadPlato = async (plato) => {
    try {
      const nuevoEstado = !plato.disponible;
      const res = await api.adminActualizarPlato(plato.id_plato, { disponible: nuevoEstado });
      if (res.ok) {
        setPlatos(prev => prev.map(p => p.id_plato === plato.id_plato ? { ...p, disponible: nuevoEstado } : p));
      }
    } catch (e) {
      showToast('error', 'Error de disponibilidad', 'No se pudo actualizar la disponibilidad.');
    }
  };

  const eliminarPlato = (id_plato) => {
    abrirConfirmacion({
      titulo: '¿Eliminar plato?',
      mensaje: '¿Deseas eliminar este plato de la carta de SIN ESPINAS? Esta acción no se puede deshacer.',
      tipo: 'peligro',
      textoBoton: 'Sí, eliminar plato',
      onConfirmar: async () => {
        try {
          const res = await api.adminEliminarPlato(id_plato);
          if (res.ok) {
            showToast('success', 'Plato eliminado', res.data.mensaje || 'Plato eliminado exitosamente.');
            api.adminListarPlatos().then(r => r.ok && setPlatos(r.data));
          } else showToast('error', 'Error del servidor', res.error || 'Ocurrió un error inesperado.');
        } catch (err) {
          showToast('error', 'Error', err.message || 'Ocurrió un error inesperado.');
        }
      }
    });
  };

  // --- OPERACIONES: CATEGORÍAS ---
  const guardarCategoria = async (e) => {
    e.preventDefault();
    try {
      if (modalCategoria.modo === 'crear') {
        const res = await api.adminCrearCategoria(modalCategoria.datos);
        if (res.ok) {
          setCategorias(prev => [...prev, res.data].sort((a,b) => a.orden_visualizacion - b.orden_visualizacion));
          setModalCategoria({ abierto: false, modo: 'crear', datos: {} });
        } else showToast('error', 'Error del servidor', res.error || 'Ocurrió un error inesperado.');
      } else {
        const res = await api.adminActualizarCategoria(modalCategoria.datos.id_categoria, modalCategoria.datos);
        if (res.ok) {
          setCategorias(prev => prev.map(c => c.id_categoria === res.data.id_categoria ? res.data : c).sort((a,b) => a.orden_visualizacion - b.orden_visualizacion));
          setModalCategoria({ abierto: false, modo: 'crear', datos: {} });
        } else showToast('error', 'Error del servidor', res.error || 'Ocurrió un error inesperado.');
      }
    } catch (err) {
      showToast('error', 'Error', err.message || 'Ocurrió un error inesperado.');
    }
  };

  const eliminarCategoria = (id_categoria) => {
    abrirConfirmacion({
      titulo: '¿Eliminar categoría?',
      mensaje: '¿Deseas eliminar esta categoría? Los platos asignados a ella quedarán sin categoría visible.',
      tipo: 'peligro',
      textoBoton: 'Sí, eliminar categoría',
      onConfirmar: async () => {
        try {
          const res = await api.adminEliminarCategoria(id_categoria);
          if (res.ok) {
            setCategorias(prev => prev.filter(c => c.id_categoria !== id_categoria));
            showToast('success', 'Categoría eliminada', 'La categoría ha sido removida.');
          } else showToast('error', 'Error del servidor', res.error || 'Ocurrió un error inesperado.');
        } catch (err) {
          showToast('error', 'Error', err.message || 'Ocurrió un error inesperado.');
        }
      }
    });
  };

  // --- IMPRESIÓN QR ---
  const descargarPngQr = (numeroMesa) => {
    const svg = document.getElementById(`qr-svg-${numeroMesa}`);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = 400;
      canvas.height = 400;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 400, 400);
      ctx.drawImage(img, 20, 20, 360, 360);
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `QR-Mesa-${numeroMesa}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const triggerImpresion = () => {
    window.print();
  };

  const platosFiltrados = platos.filter(p => {
    const coincideCat = filtroCategoria === 'TODAS' || String(p.id_categoria) === String(filtroCategoria);
    const coincideTexto = p.nombre.toLowerCase().includes(busquedaPlato.toLowerCase());
    return coincideCat && coincideTexto;
  });

  const mozosDisponibles = usuarios.filter(u => u.rol === 'MOZO' && u.activo);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {/* Estilos para impresión limpia de QRs */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #seccion-impresion-qr, #seccion-impresion-qr * {
            visibility: visible;
          }
          #seccion-impresion-qr {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* HEADER DE ADMINISTRACIÓN */}
      <header className="no-print bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <img
            src="/logo.jpg"
            alt="Sin Espinas"
            className="w-11 h-11 rounded-2xl object-cover border border-ocean-200 shadow-sm"
          />
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none uppercase">
              SIN ESPINAS — Panel Integral
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Usuario: <strong className="text-slate-800">{usuario?.nombres}</strong> ({usuario?.rol})
            </p>
          </div>
        </div>

        {/* Pestañas de Navegación Principal */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold flex-wrap">
          <button
            onClick={() => setPestanaActiva('salon')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              pestanaActiva === 'salon' ? 'bg-white text-ocean-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            Salón y Cobros
          </button>
          <button
            onClick={() => setPestanaActiva('mesas_qr')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              pestanaActiva === 'mesas_qr' ? 'bg-white text-ocean-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Mesas & QR
          </button>
          <button
            onClick={() => setPestanaActiva('carta')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              pestanaActiva === 'carta' ? 'bg-white text-ocean-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" />
            Carta y Extras
          </button>
          <button
            onClick={() => setPestanaActiva('personal')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              pestanaActiva === 'personal' ? 'bg-white text-ocean-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Personal
          </button>
          <button
            onClick={() => setPestanaActiva('resenas')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              pestanaActiva === 'resenas' ? 'bg-white text-ocean-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Star className="w-4 h-4" />
            Reseñas & Métricas
          </button>
        </div>

        {/* Acciones Rápidas */}
        <div className="flex items-center gap-2">
          {/* Botón de Sonido de Cocina / Alertas */}
          <button
            onClick={() => {
              const nuevoEstado = !sonidoActivo;
              setSonidoActivo(nuevoEstado);
              showToast(
                nuevoEstado ? 'info' : 'warning',
                nuevoEstado ? 'Sonido activado' : 'Sonido silenciado',
                nuevoEstado ? 'Sonarán campanas de cocina y llamados de mozo' : 'Alertas sonoras desactivadas'
              );
              if (nuevoEstado) playNotificationSound('alerta');
            }}
            className={`p-2 rounded-xl border transition flex items-center gap-1.5 text-xs font-bold ${
              sonidoActivo
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                : 'bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-200'
            }`}
            title={sonidoActivo ? 'Silenciar alertas sonoras' : 'Activar alertas sonoras'}
          >
            {sonidoActivo ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{sonidoActivo ? 'Sonido ON' : 'Silencio'}</span>
          </button>

          <button
            onClick={cargarTodo}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold flex items-center gap-1"
            title="Refrescar datos"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleCerrarSesion}
            className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold px-3 py-2 rounded-xl transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Salir
          </button>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL SEGÚN PESTAÑA */}
      <main className="no-print flex-1 max-w-7xl w-full mx-auto p-6">
        {cargando ? (
          <div className="text-center py-24 text-slate-500 font-medium">Cargando módulos...</div>
        ) : (
          <>
            {/* ============================================================== */}
            {/* PESTAÑA 1: SALÓN Y COBROS EN VIVO                              */}
            {/* ============================================================== */}
            {pestanaActiva === 'salon' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  {zonas.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
                      <LayoutGrid className="w-12 h-12 text-ocean-300 mx-auto mb-3" />
                      <h4 className="font-extrabold text-slate-800 text-base">Aún no se han cargado zonas o mesas</h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                        Si el servidor en Render recién está despertando, pulsa el botón de refrescar para sincronizar.
                      </p>
                      <button
                        onClick={cargarTodo}
                        className="bg-ocean-600 hover:bg-ocean-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition inline-flex items-center gap-1.5 shadow-sm"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Refrescar Salón
                      </button>
                    </div>
                  ) : (
                    zonas.map(zona => {
                      const mesasZona = mesas.filter(m => m.id_zona === zona.id_zona);

                    return (
                      <div key={zona.id_zona} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                          <div>
                            <h3 className="font-extrabold text-slate-800 text-base">{zona.nombre}</h3>
                            <p className="text-xs text-slate-400">{zona.descripcion || 'Mesas de la zona'}</p>
                          </div>
                          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                            {mesasZona.length} mesas
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {mesasZona.map(mesa => {
                            let color = 'border-slate-200 bg-slate-50/50 text-slate-800';
                            let badge = 'bg-emerald-100 text-emerald-800';

                            if (mesa.estado === 'OCUPADA') {
                              color = 'border-blue-400 bg-blue-50/40 text-blue-900';
                              badge = 'bg-blue-100 text-blue-800';
                            } else if (mesa.estado === 'CUENTA_SOLICITADA') {
                              color = 'border-amber-400 bg-amber-50/50 text-amber-900 animate-pulse';
                              badge = 'bg-amber-100 text-amber-800';
                            } else if (mesa.estado === 'MANTENIMIENTO') {
                              color = 'border-slate-300 bg-slate-100 text-slate-400 opacity-60';
                              badge = 'bg-slate-200 text-slate-600';
                            }

                            return (
                              <div
                                key={mesa.id_mesa}
                                className={`rounded-xl border-2 p-3.5 flex flex-col justify-between ${color}`}
                              >
                                <div>
                                  <div className="flex justify-between items-start">
                                    <span className="text-xl font-black">{mesa.numero_mesa}</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge}`}>
                                      {mesa.estado}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-1">Capacidad: {mesa.capacidad} personas</p>
                                </div>

                                <div className="mt-3 pt-2 border-t border-slate-200/60 space-y-1.5">
                                  {mesa.estado !== 'LIBRE' && mesa.estado !== 'MANTENIMIENTO' ? (
                                    <>
                                      <div className="flex gap-1">
                                        <button
                                          onClick={() => abrirCobro(mesa)}
                                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 shadow-sm"
                                        >
                                          <DollarSign className="w-3.5 h-3.5" /> Cobrar
                                        </button>
                                        <button
                                          onClick={() => abrirPedidoMozo(mesa)}
                                          className="bg-ocean-600 hover:bg-ocean-700 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg flex items-center justify-center gap-1"
                                          title="Tomar comanda como Mozo"
                                        >
                                          <Plus className="w-3.5 h-3.5" /> Pedido
                                        </button>
                                      </div>

                                      <button
                                        onClick={() => abrirAsignarMozo(mesa)}
                                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold py-1 rounded-md"
                                      >
                                        👤 Asignar Mozo
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => setImpresionModal({ abierto: true, mesa, modoTodos: false })}
                                      className="w-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-center py-1 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1"
                                    >
                                      <Printer className="w-3 h-3 text-slate-500" />
                                      Ver QR
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }))}
                </div>

                {/* Panel Lateral: Alertas de Servicio en Vivo */}
                <div>
                  <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-500" />
                    Alertas en Vivo (Mozos / Cocina)
                  </h3>

                  <div className="space-y-3">
                    {alertas.length === 0 ? (
                      <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-xs text-slate-400">
                        No hay llamados pendientes ni platos por recoger.
                      </div>
                    ) : (
                      alertas.map((alerta, idx) => (
                        <div
                          key={idx}
                          className={`rounded-xl border p-3 flex justify-between items-start gap-2 text-xs shadow-sm ${
                            alerta.tipo === 'PLATO_LISTO'
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                              : 'border-amber-300 bg-amber-50 text-amber-900'
                          }`}
                        >
                          <div>
                            <span className="font-extrabold block text-sm">
                              {alerta.tipo === 'PLATO_LISTO' ? '🍽️ PLATO LISTO EN BARRA' : '🔔 LLAMADO DE MESA'}
                            </span>
                            <p className="mt-0.5 font-medium">{alerta.mensaje}</p>
                            <span className="text-[10px] text-slate-400 block mt-1">
                              {new Date(alerta.hora).toLocaleTimeString()}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              setAlertas(alertas.filter((_, i) => i !== idx));
                              showToast('info', 'Alerta atendida', 'Se retiró la notificación.');
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/90 hover:bg-white text-slate-700 hover:text-emerald-700 font-bold text-[11px] shadow-sm transition border border-slate-200 flex-shrink-0"
                            title="Marcar como atendida"
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Atendida</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* PESTAÑA 2: MESAS, ZONAS Y CÓDIGOS QR                           */}
            {/* ============================================================== */}
            {pestanaActiva === 'mesas_qr' && (
              <div className="space-y-8">
                {/* 1. SECCIÓN DE ZONAS */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">Zonas del Restaurante</h3>
                      <p className="text-xs text-slate-500">Distribución física (Salón Principal, Terrazas, Barras)</p>
                    </div>
                    <button
                      onClick={() => setModalZona({ abierto: true, modo: 'crear', datos: { nombre: '', descripcion: '', activa: true } })}
                      className="bg-ocean-600 hover:bg-ocean-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Nueva Zona
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {zonas.map(z => (
                      <div key={z.id_zona} className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 flex justify-between items-center">
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm">{z.nombre}</h4>
                          <p className="text-xs text-slate-400">{z.descripcion || 'Sin descripción'}</p>
                          <span className="text-[10px] font-semibold text-ocean-600 bg-ocean-50 px-2 py-0.5 rounded-md mt-1 inline-block">
                            {z.total_mesas} mesas asociadas
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setModalZona({ abierto: true, modo: 'editar', datos: { ...z } })}
                            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600"
                            title="Editar Zona"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => eliminarZona(z.id_zona)}
                            className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600"
                            title="Eliminar Zona"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. SECCIÓN DE MESAS Y CÓDIGOS QR */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">Mesas y Códigos QR Imprimibles</h3>
                      <p className="text-xs text-slate-500">Genera, descarga o imprime los códigos QR para cada mesa física</p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setImpresionModal({ abierto: true, mesa: null, modoTodos: true })}
                        className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition"
                      >
                        <Printer className="w-4 h-4 text-ocean-400" />
                        Imprimir Todos los QR
                      </button>
                      <button
                        onClick={() => setModalMesa({
                          abierto: true,
                          modo: 'crear',
                          datos: { id_zona: zonas[0]?.id_zona || '', numero_mesa: '', capacidad: 4, estado: 'LIBRE' }
                        })}
                        className="bg-ocean-600 hover:bg-ocean-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition shadow-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Nueva Mesa
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {mesas.map(mesa => {
                      const urlQr = `${window.location.origin}/mesa/${mesa.codigo_qr_token}`;

                      return (
                        <div key={mesa.id_mesa} className="border border-slate-200 rounded-2xl p-4 bg-slate-50 flex flex-col justify-between hover:shadow-md transition">
                          <div>
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <span className="text-xl font-black text-slate-900">{mesa.numero_mesa}</span>
                                <p className="text-xs text-slate-500">{mesa.zona_nombre}</p>
                              </div>
                              <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                                {mesa.capacidad} pers.
                              </span>
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-slate-200/80 flex justify-center my-3 shadow-inner">
                              <QRCodeSVG
                                id={`qr-svg-${mesa.numero_mesa}`}
                                value={urlQr}
                                size={120}
                                level="M"
                              />
                            </div>
                            <p className="text-[10px] text-slate-400 font-mono text-center truncate mb-3">
                              token: {mesa.codigo_qr_token?.slice(0, 8)}...
                            </p>
                          </div>

                          <div className="space-y-1.5 border-t border-slate-200 pt-3">
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => setImpresionModal({ abierto: true, mesa, modoTodos: false })}
                                className="flex-1 bg-ocean-600 hover:bg-ocean-700 text-white text-xs font-bold py-1.5 rounded-lg flex items-center justify-center gap-1"
                              >
                                <Printer className="w-3.5 h-3.5" /> Imprimir
                              </button>
                              <button
                                onClick={() => descargarPngQr(mesa.numero_mesa)}
                                className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold px-2.5 py-1.5 rounded-lg"
                                title="Descargar PNG"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                              <button
                                onClick={() => regenerarQr(mesa.id_mesa)}
                                className="hover:text-amber-600 font-medium"
                              >
                                Regenerar QR
                              </button>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setModalMesa({ abierto: true, modo: 'editar', datos: { ...mesa } })}
                                  className="hover:text-slate-800 font-medium"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => eliminarMesa(mesa.id_mesa)}
                                  className="hover:text-rose-600 font-medium"
                                >
                                  Borrar
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. CONTROL DE UBICACIÓN (GEOCERCA GPS) */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-ocean-600" />
                        Control de Ubicación (Geocerca del Restaurante)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Valida que los comensales estén físicamente en el local para ordenar por QR.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                        configuracionGPS.validar_gps
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {configuracionGPS.validar_gps ? '🛡️ Geocerca ACTIVA' : '⚪ Geocerca INACTIVA (Modo Demo)'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-5">
                    {/* Switch Validar GPS */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-700 block mb-1">Validación de GPS</span>
                        <p className="text-[11px] text-slate-400">
                          {configuracionGPS.validar_gps
                            ? 'Bloquea el acceso a clientes fuera del radio del local.'
                            : 'Permite abrir mesas remotamente para pruebas o demostraciones.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setConfiguracionGPS(prev => ({ ...prev, validar_gps: !prev.validar_gps }))}
                        className={`mt-4 w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                          configuracionGPS.validar_gps
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                            : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                        }`}
                      >
                        {configuracionGPS.validar_gps ? 'Desactivar Geocerca' : 'Activar Geocerca GPS'}
                      </button>
                    </div>

                    {/* Radio permitido en metros */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <span className="text-xs font-bold text-slate-700 block mb-1">Radio Permitido</span>
                      <p className="text-[11px] text-slate-400 mb-2">
                        Distancia máxima permitida en metros a la redonda:
                      </p>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="20"
                          max="300"
                          step="10"
                          value={configuracionGPS.radio_permitido_metros || 80}
                          onChange={e => setConfiguracionGPS(prev => ({ ...prev, radio_permitido_metros: parseInt(e.target.value) || 80 }))}
                          className="flex-1 accent-ocean-600"
                        />
                        <span className="font-extrabold text-sm text-ocean-700 bg-ocean-50 border border-ocean-200 px-2.5 py-1 rounded-lg">
                          {configuracionGPS.radio_permitido_metros || 80} m
                        </span>
                      </div>
                    </div>

                    {/* Coordenadas actuales del local */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <span className="text-xs font-bold text-slate-700 block mb-1">Coordenadas del Local</span>
                      <div className="space-y-1.5 text-xs font-mono">
                        <div className="flex justify-between bg-white px-2 py-1 rounded border border-slate-200">
                          <span className="text-slate-400">Lat:</span>
                          <span className="font-bold text-slate-800">{configuracionGPS.latitud ?? -16.4090474}</span>
                        </div>
                        <div className="flex justify-between bg-white px-2 py-1 rounded border border-slate-200">
                          <span className="text-slate-400">Lon:</span>
                          <span className="font-bold text-slate-800">{configuracionGPS.longitud ?? -71.5374510}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={obtenerMiUbicacionGPS}
                        disabled={obteniendoUbicacion}
                        className="mt-3 w-full bg-white hover:bg-ocean-50 border border-ocean-300 text-ocean-700 text-xs font-bold py-1.5 px-3 rounded-lg transition flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        {obteniendoUbicacion ? 'Obteniendo GPS...' : 'Usar mi ubicación actual como local'}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={guardarConfiguracionGPS}
                      disabled={guardandoConfig}
                      className="bg-ocean-600 hover:bg-ocean-700 disabled:opacity-50 text-white font-bold text-xs py-2.5 px-5 rounded-xl shadow-md transition flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      {guardandoConfig ? 'Guardando ajustes...' : 'Guardar Configuración de Geocerca'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* PESTAÑA 3: ADMINISTRACIÓN DE CARTA Y PERSONALIZACIONES          */}
            {/* ============================================================== */}
            {pestanaActiva === 'carta' && (
              <div className="space-y-8">
                {/* 1. SECCIONES / CATEGORÍAS */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">Secciones de la Carta</h3>
                      <p className="text-xs text-slate-500">Organización y orden visual de categorías para el cliente</p>
                    </div>
                    <button
                      onClick={() => setModalCategoria({
                        abierto: true,
                        modo: 'crear',
                        datos: { nombre: '', descripcion: '', orden_visualizacion: categorias.length + 1, activa: true }
                      })}
                      className="bg-ocean-600 hover:bg-ocean-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Nueva Sección
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {categorias.map(cat => (
                      <div key={cat.id_categoria} className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 bg-ocean-100 text-ocean-700 rounded-full flex items-center justify-center font-bold text-[10px]">
                              {cat.orden_visualizacion}
                            </span>
                            <h4 className="font-bold text-slate-800 text-xs">{cat.nombre}</h4>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{cat.descripcion}</p>
                          <span className="text-[10px] text-slate-500 mt-1 block">
                            {cat.total_platos} platos en carta
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setModalCategoria({ abierto: true, modo: 'editar', datos: { ...cat } })}
                            className="p-1 rounded hover:bg-slate-200 text-slate-600"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => eliminarCategoria(cat.id_categoria)}
                            className="p-1 rounded hover:bg-rose-100 text-rose-600"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. GESTIÓN DE PERSONALIZACIONES Y EXTRAS */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">Grupos de Personalización y Extras</h3>
                      <p className="text-xs text-slate-500">Nivel de ají, tipos de pesca del día, guarniciones y adicionales</p>
                    </div>
                    <button
                      onClick={() => setModalGrupoOp({ abierto: true, modo: 'crear', datos: { nombre: '', es_obligatorio: false, seleccion_multiple: false } })}
                      className="bg-ocean-600 hover:bg-ocean-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Nuevo Grupo
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {gruposOpciones.map(g => (
                      <div key={g.id_grupo_opcion} className="border border-slate-200 rounded-2xl p-4 bg-slate-50 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-extrabold text-slate-900 text-sm">{g.nombre}</h4>
                              <div className="flex gap-2 text-[10px] text-slate-500 mt-0.5">
                                <span>{g.es_obligatorio ? '🔴 Obligatorio' : '⚪ Opcional'}</span>
                                <span>•</span>
                                <span>{g.seleccion_multiple ? 'Múltiple' : 'Único'}</span>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => setModalGrupoOp({ abierto: true, modo: 'editar', datos: { ...g } })}
                                className="p-1 rounded hover:bg-slate-200 text-slate-600"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => eliminarGrupoOp(g.id_grupo_opcion)}
                                className="p-1 rounded hover:bg-rose-100 text-rose-600"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Lista de Opciones */}
                          <div className="space-y-1.5 my-3">
                            {(g.opciones_personalizacion || []).map(op => (
                              <div key={op.id_opcion} className="flex justify-between items-center text-xs bg-white p-2 rounded-xl border border-slate-200/80">
                                <div>
                                  <span className={`font-semibold ${!op.disponible ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                    {op.nombre}
                                  </span>
                                  {Number(op.precio_adicional) > 0 && (
                                    <span className="text-[10px] text-emerald-600 font-bold ml-1.5">
                                      +S/ {Number(op.precio_adicional).toFixed(2)}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => toggleDisponibilidadOpcion(op)}
                                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                                      op.disponible ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                    }`}
                                  >
                                    {op.disponible ? 'Activo' : 'Agotado'}
                                  </button>
                                  <button
                                    onClick={() => eliminarOpcionExtra(op.id_opcion, g.id_grupo_opcion)}
                                    className="p-1 text-slate-400 hover:text-rose-600"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <button
                          onClick={() => setModalNuevaOpcion({
                            abierto: true,
                            id_grupo_opcion: g.id_grupo_opcion,
                            nombreGrupo: g.nombre,
                            datos: { nombre: '', precio_adicional: 0, disponible: true }
                          })}
                          className="w-full mt-2 bg-white hover:bg-slate-100 border border-slate-200 text-ocean-700 text-xs font-bold py-1.5 rounded-xl transition flex items-center justify-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Agregar Opción
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. GESTIÓN DE PLATOS */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">Catálogo de Platos</h3>
                      <p className="text-xs text-slate-500">Precios base, estaciones KDS, tiempo de cocción, modelo 3D y disponibilidad en vivo</p>
                    </div>

                    <button
                      onClick={() => setModalPlato({
                        abierto: true,
                        modo: 'crear',
                        datos: {
                          id_categoria: categorias[0]?.id_categoria || '',
                          id_estacion: 1,
                          nombre: '',
                          descripcion: '',
                          precio_base: '',
                          tiempo_prep_estimado_min: 10,
                          imagen_url: '',
                          modelo_3d_url: '',
                          disponible: true,
                          es_recomendado_ia: false,
                          grupos_opciones_ids: []
                        }
                      })}
                      className="bg-ocean-600 hover:bg-ocean-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Nuevo Plato
                    </button>
                  </div>

                  {/* Filtros */}
                  <div className="flex flex-wrap gap-3 mb-5">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={busquedaPlato}
                        onChange={(e) => setBusquedaPlato(e.target.value)}
                        placeholder="Buscar plato por nombre..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:ring-1 focus:ring-ocean-500 focus:outline-none"
                      />
                    </div>

                    <select
                      value={filtroCategoria}
                      onChange={(e) => setFiltroCategoria(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-1 focus:ring-ocean-500 focus:outline-none"
                    >
                      <option value="TODAS">Todas las Secciones</option>
                      {categorias.map(c => (
                        <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>

                  {/* Grid de Platos */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {platosFiltrados.map(plato => (
                      <div
                        key={plato.id_plato}
                        className={`rounded-2xl border p-4 flex flex-col justify-between transition ${
                          plato.disponible ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-100 border-slate-200 opacity-70'
                        }`}
                      >
                        <div>
                          <div className="flex gap-3 mb-3">
                            <img
                              src={plato.imagen_url || 'https://images.unsplash.com/photo-1535399831218-d5bd36d1a6b3?w=300'}
                              alt={plato.nombre}
                              className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-1">
                                <h4 className="font-bold text-slate-800 text-sm truncate">{plato.nombre}</h4>
                                {plato.es_recomendado_ia && (
                                  <span className="text-amber-500" title="Recomendado IA">⭐</span>
                                )}
                              </div>
                              <span className="text-[11px] text-ocean-600 font-semibold">{plato.categoria_nombre}</span>
                              <p className="text-sm font-extrabold text-slate-900 mt-1">S/ {Number(plato.precio_base).toFixed(2)}</p>
                            </div>
                          </div>

                          <p className="text-xs text-slate-500 line-clamp-2 mb-3">{plato.descripcion}</p>

                          <div className="flex flex-wrap gap-1 mb-3">
                            <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded">
                              📍 {plato.estacion_nombre}
                            </span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded">
                              ⏱️ {plato.tiempo_prep_estimado_min} min
                            </span>
                            {plato.modelo_3d_url && (
                              <span className="text-[10px] bg-purple-50 text-purple-700 font-semibold px-2 py-0.5 rounded border border-purple-200">
                                📦 Vista 3D
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                          <button
                            onClick={() => toggleDisponibilidadPlato(plato)}
                            className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg transition ${
                              plato.disponible
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                            }`}
                          >
                            {plato.disponible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            {plato.disponible ? 'Disponible' : 'Agotado'}
                          </button>

                          <div className="flex gap-1">
                            <button
                              onClick={() => setModalPlato({
                                abierto: true,
                                modo: 'editar',
                                datos: {
                                  ...plato,
                                  grupos_opciones_ids: (plato.grupos_opciones || []).map(g => g.id_grupo_opcion)
                                }
                              })}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                              title="Editar Plato"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => eliminarPlato(plato.id_plato)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600"
                              title="Eliminar o Desactivar Plato"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* PESTAÑA 4: GESTIÓN DE PERSONAL (USUARIOS Y ROLES)              */}
            {/* ============================================================== */}
            {pestanaActiva === 'personal' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Personal del Restaurante</h3>
                    <p className="text-xs text-slate-500">Cuentas con roles RBAC (Administrador, Cajero, Mozo, Cocina Fría, Cocina Caliente)</p>
                  </div>
                  <button
                    onClick={() => setModalUsuario({
                      abierto: true,
                      datos: { nombres: '', apellidos: '', email: '', password: '', rol: 'MOZO' }
                    })}
                    className="bg-ocean-600 hover:bg-ocean-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition shadow-sm"
                  >
                    <UserPlus className="w-4 h-4" />
                    Nuevo Empleado
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider border-y border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Nombres y Apellidos</th>
                        <th className="py-3 px-4">Correo</th>
                        <th className="py-3 px-4">Rol</th>
                        <th className="py-3 px-4">Estado</th>
                        <th className="py-3 px-4 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {usuarios.map(u => (
                        <tr key={u.id_usuario} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4 font-bold text-slate-800">
                            {u.nombres} {u.apellidos}
                          </td>
                          <td className="py-3 px-4 text-slate-600">{u.email}</td>
                          <td className="py-3 px-4">
                            <span className="font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md">
                              {u.rol}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                              u.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {u.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => toggleUsuarioActivo(u)}
                              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                                u.activo ? 'border-rose-200 text-rose-600 hover:bg-rose-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              {u.activo ? 'Desactivar' : 'Reactivar'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* PESTAÑA 5: RESEÑAS, SATISFACCIÓN Y MÉTRICAS                    */}
            {/* ============================================================== */}
            {pestanaActiva === 'resenas' && (
              <div className="space-y-6">
                {/* Métricas Principales */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <span className="text-xs text-slate-400 font-semibold uppercase">Calificación Promedio</span>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-black text-amber-500">⭐ {datosResenas.resumen?.promedio_estrellas}</span>
                      <span className="text-xs text-slate-500">/ 5.0</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <span className="text-xs text-slate-400 font-semibold uppercase">Total Reseñas</span>
                    <p className="text-3xl font-black text-slate-900 mt-2">{datosResenas.resumen?.total_resenas}</p>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <span className="text-xs text-slate-400 font-semibold uppercase">Redirigidas a Google</span>
                    <p className="text-3xl font-black text-emerald-600 mt-2">{datosResenas.resumen?.enviadas_a_google}</p>
                    <span className="text-[10px] text-slate-400">Calificaciones de 4 y 5 estrellas</span>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <span className="text-xs text-slate-400 font-semibold uppercase">Quejas Internas</span>
                    <p className="text-3xl font-black text-rose-600 mt-2">{datosResenas.resumen?.quejas_internas_count}</p>
                    <span className="text-[10px] text-slate-400">Filtradas (1 a 3 estrellas)</span>
                  </div>
                </div>

                {/* Bandeja de Quejas Internas (1 a 3 estrellas) */}
                <div className="bg-white rounded-2xl border border-rose-200 p-6 shadow-sm">
                  <h3 className="text-base font-extrabold text-slate-900 mb-1 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                    Bandeja de Quejas y Sugerencias Internas (Filtro Inteligente)
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">Estas opiniones no llegaron a Google Reviews para proteger la reputación del local y permitir resolver problemas en sala</p>

                  {datosResenas.quejas_internas?.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                      🎉 ¡Excelente servicio! No se registran quejas internas en el sistema.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {datosResenas.quejas_internas?.map(q => (
                        <div key={q.id_resena} className="border border-rose-100 bg-rose-50/40 rounded-xl p-4 flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-black text-slate-800">Mesa {q.numero_mesa}</span>
                              <span className="text-amber-500 font-bold text-xs">{'⭐'.repeat(q.calificacion)}</span>
                              <span className="text-[10px] text-slate-400">{new Date(q.creado_en).toLocaleString()}</span>
                            </div>
                            <p className="text-xs text-slate-700 italic">"{q.comentario || 'Sin comentario específico'}"</p>
                          </div>
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                            Atención requerida
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Historial General */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <h3 className="text-base font-extrabold text-slate-900 mb-4">Todas las Opiniones Registradas</h3>
                  <div className="space-y-2">
                    {datosResenas.resenas?.map(r => (
                      <div key={r.id_resena} className="flex justify-between items-center text-xs p-3 rounded-xl border border-slate-100 hover:bg-slate-50">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">Mesa {r.numero_mesa}</span>
                            <span className="text-amber-500 font-bold">{'⭐'.repeat(r.calificacion)}</span>
                            <span className="text-[10px] text-slate-400">{new Date(r.creado_en).toLocaleDateString()}</span>
                          </div>
                          <p className="text-slate-600 mt-1">{r.comentario || 'Sin comentario'}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          r.redirigido_google ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {r.redirigido_google ? 'Google Reviews' : 'Bandeja Interna'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ============================================================== */}
      {/* MODAL COBRO EN CAJA CON REGISTRO DE id_cajero                  */}
      {/* ============================================================== */}
      {modalCobroMesa.abierto && (
        <div className="no-print fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-extrabold text-slate-900 text-base">Cobro en Caja - Mesa {modalCobroMesa.mesa?.numero_mesa}</h3>
              <button onClick={() => setModalCobroMesa({ abierto: false, mesa: null, cuenta: null, metodo: 'EFECTIVO', propina: 0, procesando: false })}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 text-center mb-4 border border-slate-200">
              <span className="text-xs text-slate-500">Saldo Pendiente a Cobrar</span>
              <p className="text-2xl font-black text-slate-900">S/ {modalCobroMesa.cuenta?.saldo_pendiente.toFixed(2)}</p>
              <span className="text-[10px] text-slate-400 block mt-1">Cajero: {usuario?.nombres}</span>
            </div>

            <label className="text-xs font-bold text-slate-700 block mb-2">Método de Cobro:</label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { id: 'EFECTIVO', label: '💵 Efectivo' },
                { id: 'POS_FISICO', label: '📟 POS Tarjeta' },
                { id: 'YAPE', label: '💜 Yape' },
                { id: 'PLIN', label: '💙 Plin' }
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => setModalCobroMesa(prev => ({ ...prev, metodo: m.id }))}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border ${
                    modalCobroMesa.metodo === m.id ? 'border-ocean-600 bg-ocean-50 text-ocean-800' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold text-slate-700 block mb-1">Propina recibida (S/)</label>
              <input
                type="number"
                min="0"
                value={modalCobroMesa.propina}
                onChange={e => setModalCobroMesa(prev => ({ ...prev, propina: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-ocean-500 focus:outline-none"
              />
            </div>

            <button
              onClick={ejecutarCobroAdmin}
              disabled={modalCobroMesa.procesando}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs shadow-md"
            >
              {modalCobroMesa.procesando ? 'Confirmando...' : `Confirmar y Liberar Mesa (S/ ${(modalCobroMesa.cuenta?.saldo_pendiente + Number(modalCobroMesa.propina || 0)).toFixed(2)})`}
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL ASIGNAR MOZO A MESA                                      */}
      {/* ============================================================== */}
      {modalAsignarMozo.abierto && (
        <div className="no-print fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-extrabold text-slate-900 text-base mb-3">
              Asignar Mozo a Mesa {modalAsignarMozo.mesa?.numero_mesa}
            </h3>
            <select
              value={modalAsignarMozo.mozoId}
              onChange={e => setModalAsignarMozo(prev => ({ ...prev, mozoId: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 mb-4 focus:ring-1 focus:ring-ocean-500 focus:outline-none"
            >
              <option value="">Selecciona Mozo</option>
              {mozosDisponibles.map(m => (
                <option key={m.id_usuario} value={m.id_usuario}>{m.nombres} {m.apellidos}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => setModalAsignarMozo({ abierto: false, mesa: null, mozoId: '' })}
                className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={guardarAsignacionMozo}
                className="flex-1 bg-ocean-600 text-white py-2 rounded-xl text-xs font-bold"
              >
                Asignar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL CREAR USUARIO / PERSONAL                                 */}
      {/* ============================================================== */}
      {modalUsuario.abierto && (
        <div className="no-print fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="font-extrabold text-slate-900 text-base mb-4">Registrar Personal</h3>
            <form onSubmit={guardarUsuario} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Nombres</label>
                  <input
                    type="text"
                    required
                    value={modalUsuario.datos.nombres}
                    onChange={e => setModalUsuario({ ...modalUsuario, datos: { ...modalUsuario.datos, nombres: e.target.value } })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-ocean-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Apellidos</label>
                  <input
                    type="text"
                    required
                    value={modalUsuario.datos.apellidos}
                    onChange={e => setModalUsuario({ ...modalUsuario, datos: { ...modalUsuario.datos, apellidos: e.target.value } })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-ocean-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  value={modalUsuario.datos.email}
                  onChange={e => setModalUsuario({ ...modalUsuario, datos: { ...modalUsuario.datos, email: e.target.value } })}
                  placeholder="usuario@cevicheria.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-ocean-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Contraseña</label>
                <input
                  type="password"
                  required
                  value={modalUsuario.datos.password}
                  onChange={e => setModalUsuario({ ...modalUsuario, datos: { ...modalUsuario.datos, password: e.target.value } })}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-ocean-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Rol Operativo</label>
                <select
                  value={modalUsuario.datos.rol}
                  onChange={e => setModalUsuario({ ...modalUsuario, datos: { ...modalUsuario.datos, rol: e.target.value } })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-1 focus:ring-ocean-500 focus:outline-none"
                >
                  <option value="MOZO">MOZO (Atención en mesas)</option>
                  <option value="CAJERO">CAJERO (Cobros y caja)</option>
                  <option value="COCINA_FRIA">COCINA FRIA (Ceviches y tiraditos)</option>
                  <option value="COCINA_CALIENTE">COCINA CALIENTE (Chicharrones y arroces)</option>
                  <option value="ADMIN">ADMIN (Acceso total)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalUsuario({ abierto: false, datos: {} })}
                  className="flex-1 bg-slate-100 text-slate-700 font-bold py-2.5 rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-ocean-600 hover:bg-ocean-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md"
                >
                  Crear Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL CREAR GRUPO DE OPCIONES                                  */}
      {/* ============================================================== */}
      {modalGrupoOp.abierto && (
        <div className="no-print fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-extrabold text-slate-900 text-base mb-4">
              {modalGrupoOp.modo === 'crear' ? 'Nuevo Grupo de Opciones' : 'Editar Grupo'}
            </h3>
            <form onSubmit={guardarGrupoOp} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nombre del Grupo</label>
                <input
                  type="text"
                  required
                  value={modalGrupoOp.datos.nombre}
                  onChange={e => setModalGrupoOp({ ...modalGrupoOp, datos: { ...modalGrupoOp.datos, nombre: e.target.value } })}
                  placeholder="Ej: Nivel de Ají o Guarniciones"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-ocean-500 focus:outline-none"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={modalGrupoOp.datos.es_obligatorio}
                    onChange={e => setModalGrupoOp({ ...modalGrupoOp, datos: { ...modalGrupoOp.datos, es_obligatorio: e.target.checked } })}
                    className="rounded text-ocean-600"
                  />
                  <span>Elección Obligatoria</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={modalGrupoOp.datos.seleccion_multiple}
                    onChange={e => setModalGrupoOp({ ...modalGrupoOp, datos: { ...modalGrupoOp.datos, seleccion_multiple: e.target.checked } })}
                    className="rounded text-ocean-600"
                  />
                  <span>Permitir Selección Múltiple</span>
                </label>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalGrupoOp({ abierto: false, modo: 'crear', datos: {} })}
                  className="flex-1 bg-slate-100 text-slate-700 font-bold py-2 rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-ocean-600 text-white font-bold py-2 rounded-xl text-xs"
                >
                  Guardar Grupo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL CREAR OPCIÓN / EXTRA EN GRUPO                            */}
      {/* ============================================================== */}
      {modalNuevaOpcion.abierto && (
        <div className="no-print fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-extrabold text-slate-900 text-base mb-1">Agregar Opción / Extra</h3>
            <p className="text-xs text-slate-500 mb-4">Grupo: {modalNuevaOpcion.nombreGrupo}</p>

            <form onSubmit={guardarOpcionExtra} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nombre de la Opción</label>
                <input
                  type="text"
                  required
                  value={modalNuevaOpcion.datos.nombre}
                  onChange={e => setModalNuevaOpcion({ ...modalNuevaOpcion, datos: { ...modalNuevaOpcion.datos, nombre: e.target.value } })}
                  placeholder="Ej: Ají Limo Picante o Porción Extra Chicharrón"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-ocean-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Precio Adicional (S/)</label>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  value={modalNuevaOpcion.datos.precio_adicional}
                  onChange={e => setModalNuevaOpcion({ ...modalNuevaOpcion, datos: { ...modalNuevaOpcion.datos, precio_adicional: e.target.value } })}
                  placeholder="0.00"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-ocean-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalNuevaOpcion({ abierto: false, id_grupo_opcion: null, nombreGrupo: '', datos: {} })}
                  className="flex-1 bg-slate-100 text-slate-700 font-bold py-2 rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-ocean-600 text-white font-bold py-2 rounded-xl text-xs"
                >
                  Agregar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL TOMAR PEDIDO MOZO DIRECTO                                */}
      {/* ============================================================== */}
      {modalPedidoMozo.abierto && (
        <div className="no-print fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl">
            <h3 className="font-extrabold text-slate-900 text-base mb-1">Tomar Pedido - Mesa {modalPedidoMozo.mesa?.numero_mesa}</h3>
            <p className="text-xs text-slate-500 mb-4">Registrado como comanda de mozo (MOZO_APP)</p>

            <div className="border border-slate-200 rounded-xl p-3 mb-4 max-h-48 overflow-y-auto bg-slate-50">
              <span className="text-xs font-bold text-slate-700 block mb-2">Selecciona Platos para agregar:</span>
              <div className="grid grid-cols-2 gap-2">
                {platos.filter(p => p.disponible).map(p => (
                  <button
                    key={p.id_plato}
                    type="button"
                    onClick={() => agregarItemMozo(p)}
                    className="p-2 bg-white hover:bg-ocean-50 border border-slate-200 rounded-lg text-left text-xs font-semibold"
                  >
                    <span className="block truncate">{p.nombre}</span>
                    <span className="text-[10px] text-ocean-700 font-bold">S/ {Number(p.precio_base).toFixed(2)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Comanda en construcción */}
            <div className="space-y-2 mb-4">
              <span className="text-xs font-bold text-slate-800 block">Platos en Comanda ({modalPedidoMozo.items.length})</span>
              {modalPedidoMozo.items.map((it, idx) => (
                <div key={idx} className="flex justify-between items-center bg-slate-100 p-2 rounded-xl text-xs">
                  <span>{it.nombre} - S/ {Number(it.precio_base).toFixed(2)}</span>
                  <button
                    onClick={() => setModalPedidoMozo(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))}
                    className="text-rose-600 font-bold text-xs"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>

            <textarea
              value={modalPedidoMozo.obs}
              onChange={e => setModalPedidoMozo(prev => ({ ...prev, obs: e.target.value }))}
              placeholder="Notas generales de la comanda..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs mb-4 focus:ring-1 focus:ring-ocean-500 focus:outline-none"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setModalPedidoMozo({ abierto: false, mesa: null, sesion: null, items: [], obs: '' })}
                className="flex-1 bg-slate-100 text-slate-700 font-bold py-2.5 rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={enviarPedidoMozo}
                className="flex-1 bg-ocean-600 hover:bg-ocean-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md"
              >
                Enviar a Cocina
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VISTA PREVIA IMPRESIÓN QR MODAL Y VISTA OCULTA PARA WINDOW.PRINT */}
      {/* ============================================================== */}
      {impresionModal.abierto && (
        <div className="no-print fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-extrabold text-slate-800 text-base">
                {impresionModal.modoTodos ? 'Imprimir Todos los QRs' : `Tarjeta QR Mesa ${impresionModal.mesa?.numero_mesa}`}
              </h3>
              <button
                onClick={() => setImpresionModal({ abierto: false, mesa: null, modoTodos: false })}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border-2 border-dashed border-ocean-300 rounded-2xl p-6 text-center bg-slate-50 mb-5">
              <span className="text-xs font-black text-ocean-800 uppercase tracking-widest block mb-1">CEVICHERÍA SIN ESPINAS</span>
              <h2 className="text-2xl font-black text-slate-900 mb-1">
                {impresionModal.modoTodos ? 'Todas las Mesas' : `MESA ${impresionModal.mesa?.numero_mesa}`}
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                {impresionModal.modoTodos ? 'Se generará una hoja con cada mesa' : impresionModal.mesa?.zona_nombre}
              </p>

              {!impresionModal.modoTodos && impresionModal.mesa && (
                <div className="bg-white p-4 rounded-xl border border-slate-200 inline-block shadow-sm mb-3">
                  <QRCodeSVG
                    value={`${window.location.origin}/mesa/${impresionModal.mesa.codigo_qr_token}`}
                    size={160}
                    level="H"
                  />
                </div>
              )}

              <p className="text-xs font-bold text-slate-700">📱 Escanea con tu cámara para ver la carta y pedir</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setImpresionModal({ abierto: false, mesa: null, modoTodos: false })}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={triggerImpresion}
                className="flex-1 bg-ocean-600 hover:bg-ocean-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md"
              >
                <Printer className="w-4 h-4" /> Mandar a Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN OCULTA QUE SE MUESTRA AL IMPRIMIR (@media print) */}
      <div id="seccion-impresion-qr" className="hidden print:block">
        <div className="grid grid-cols-2 gap-8 p-6">
          {(impresionModal.modoTodos ? mesas : (impresionModal.mesa ? [impresionModal.mesa] : [])).map(m => (
            <div key={m.id_mesa} className="border-4 border-slate-900 rounded-3xl p-8 text-center flex flex-col items-center justify-between min-h-[360px]">
              <div>
                <span className="text-sm font-black text-slate-800 uppercase tracking-widest block">CEVICHERÍA SIN ESPINAS</span>
                <h1 className="text-4xl font-black text-slate-950 mt-1 mb-1">MESA {m.numero_mesa}</h1>
                <span className="text-xs font-semibold text-slate-500">{m.zona_nombre}</span>
              </div>

              <div className="my-4 p-4 bg-white border-2 border-slate-900 rounded-2xl">
                <QRCodeSVG
                  value={`${window.location.origin}/mesa/${m.codigo_qr_token}`}
                  size={200}
                  level="H"
                />
              </div>

              <div>
                <p className="text-sm font-black text-slate-900">📱 Escanea para ver la carta digital</p>
                <p className="text-xs text-slate-500 mt-0.5">Pide al instante sin esperar al mozo</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL: CREAR / EDITAR ZONA                                      */}
      {/* ============================================================== */}
      {modalZona.abierto && (
        <div className="no-print fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-extrabold text-slate-800 text-base mb-4">
              {modalZona.modo === 'crear' ? 'Crear Nueva Zona' : 'Editar Zona'}
            </h3>
            <form onSubmit={guardarZona} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nombre de la Zona</label>
                <input
                  type="text"
                  required
                  value={modalZona.datos.nombre}
                  onChange={e => setModalZona({ ...modalZona, datos: { ...modalZona.datos, nombre: e.target.value } })}
                  placeholder="Ej: Terraza Marina"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-ocean-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Descripción</label>
                <input
                  type="text"
                  value={modalZona.datos.descripcion}
                  onChange={e => setModalZona({ ...modalZona, datos: { ...modalZona.datos, descripcion: e.target.value } })}
                  placeholder="Ej: Vista directa a la barra..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-ocean-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalZona({ abierto: false, modo: 'crear', datos: {} })}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-ocean-600 hover:bg-ocean-700 text-white font-bold py-2 rounded-xl text-xs"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CREAR / EDITAR MESA                                      */}
      {/* ============================================================== */}
      {modalMesa.abierto && (
        <div className="no-print fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-extrabold text-slate-800 text-base mb-4">
              {modalMesa.modo === 'crear' ? 'Crear Nueva Mesa' : 'Editar Mesa'}
            </h3>
            <form onSubmit={guardarMesa} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Zona</label>
                <select
                  required
                  value={modalMesa.datos.id_zona}
                  onChange={e => setModalMesa({ ...modalMesa, datos: { ...modalMesa.datos, id_zona: e.target.value } })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-ocean-500 focus:outline-none"
                >
                  <option value="">Selecciona Zona</option>
                  {zonas.map(z => (
                    <option key={z.id_zona} value={z.id_zona}>{z.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Número de Mesa</label>
                <input
                  type="text"
                  required
                  value={modalMesa.datos.numero_mesa}
                  onChange={e => setModalMesa({ ...modalMesa, datos: { ...modalMesa.datos, numero_mesa: e.target.value } })}
                  placeholder="Ej: M-08"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-ocean-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Capacidad (Comensales)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={modalMesa.datos.capacidad}
                  onChange={e => setModalMesa({ ...modalMesa, datos: { ...modalMesa.datos, capacidad: e.target.value } })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-ocean-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMesa({ abierto: false, modo: 'crear', datos: {} })}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-ocean-600 hover:bg-ocean-700 text-white font-bold py-2 rounded-xl text-xs"
                >
                  Guardar Mesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CREAR / EDITAR CATEGORÍA                                */}
      {/* ============================================================== */}
      {modalCategoria.abierto && (
        <div className="no-print fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-extrabold text-slate-800 text-base mb-4">
              {modalCategoria.modo === 'crear' ? 'Nueva Sección de Carta' : 'Editar Sección'}
            </h3>
            <form onSubmit={guardarCategoria} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nombre</label>
                <input
                  type="text"
                  required
                  value={modalCategoria.datos.nombre}
                  onChange={e => setModalCategoria({ ...modalCategoria, datos: { ...modalCategoria.datos, nombre: e.target.value } })}
                  placeholder="Ej: Tiraditos"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-ocean-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Descripción</label>
                <input
                  type="text"
                  value={modalCategoria.datos.descripcion}
                  onChange={e => setModalCategoria({ ...modalCategoria, datos: { ...modalCategoria.datos, descripcion: e.target.value } })}
                  placeholder="Ej: Finas láminas de pesca del día..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-ocean-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Orden de visualización</label>
                <input
                  type="number"
                  required
                  value={modalCategoria.datos.orden_visualizacion}
                  onChange={e => setModalCategoria({ ...modalCategoria, datos: { ...modalCategoria.datos, orden_visualizacion: e.target.value } })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-ocean-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalCategoria({ abierto: false, modo: 'crear', datos: {} })}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-ocean-600 hover:bg-ocean-700 text-white font-bold py-2 rounded-xl text-xs"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CREAR / EDITAR PLATO COMPLETO CON MODELO 3D             */}
      {/* ============================================================== */}
      {modalPlato.abierto && (
        <div className="no-print fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <h3 className="font-extrabold text-slate-800 text-base mb-4">
              {modalPlato.modo === 'crear' ? 'Registrar Nuevo Plato Marino' : 'Editar Plato'}
            </h3>

            <form onSubmit={guardarPlato} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Sección / Categoría</label>
                  <select
                    required
                    value={modalPlato.datos.id_categoria}
                    onChange={e => setModalPlato({ ...modalPlato, datos: { ...modalPlato.datos, id_categoria: e.target.value } })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-ocean-500 focus:outline-none"
                  >
                    <option value="">Selecciona Sección</option>
                    {categorias.map(c => (
                      <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Estación KDS Cocina</label>
                  <select
                    required
                    value={modalPlato.datos.id_estacion}
                    onChange={e => setModalPlato({ ...modalPlato, datos: { ...modalPlato.datos, id_estacion: e.target.value } })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-ocean-500 focus:outline-none"
                  >
                    {metaOpciones.estaciones_cocina?.map(est => (
                      <option key={est.id_estacion} value={est.id_estacion}>{est.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nombre del Plato</label>
                <input
                  type="text"
                  required
                  value={modalPlato.datos.nombre}
                  onChange={e => setModalPlato({ ...modalPlato, datos: { ...modalPlato.datos, nombre: e.target.value } })}
                  placeholder="Ej: Ceviche Mixto Especial"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-ocean-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Descripción</label>
                <textarea
                  value={modalPlato.datos.descripcion}
                  onChange={e => setModalPlato({ ...modalPlato, datos: { ...modalPlato.datos, descripcion: e.target.value } })}
                  placeholder="Detalla los ingredientes frescos..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-ocean-500 focus:outline-none h-16"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Precio Base (S/)</label>
                  <input
                    type="number"
                    step="0.10"
                    required
                    value={modalPlato.datos.precio_base}
                    onChange={e => setModalPlato({ ...modalPlato, datos: { ...modalPlato.datos, precio_base: e.target.value } })}
                    placeholder="35.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-ocean-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Tiempo Estimado (Minutos)</label>
                  <input
                    type="number"
                    required
                    value={modalPlato.datos.tiempo_prep_estimado_min}
                    onChange={e => setModalPlato({ ...modalPlato, datos: { ...modalPlato.datos, tiempo_prep_estimado_min: e.target.value } })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-ocean-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">URL de Imagen</label>
                  <input
                    type="url"
                    value={modalPlato.datos.imagen_url}
                    onChange={e => setModalPlato({ ...modalPlato, datos: { ...modalPlato.datos, imagen_url: e.target.value } })}
                    placeholder="https://..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-ocean-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">URL Modelo 3D (.glb/.usdz)</label>
                  <input
                    type="url"
                    value={modalPlato.datos.modelo_3d_url || ''}
                    onChange={e => setModalPlato({ ...modalPlato, datos: { ...modalPlato.datos, modelo_3d_url: e.target.value } })}
                    placeholder="https://.../ceviche.glb"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-ocean-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Checkboxes de Opciones Personalizables */}
              <div className="border border-slate-100 rounded-xl p-3 bg-slate-50">
                <label className="text-xs font-bold text-slate-800 block mb-2">Grupos de Opciones Disponibles</label>
                <div className="space-y-1.5">
                  {gruposOpciones.map(g => {
                    const seleccionado = (modalPlato.datos.grupos_opciones_ids || []).includes(g.id_grupo_opcion);
                    return (
                      <label key={g.id_grupo_opcion} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={seleccionado}
                          onChange={(e) => {
                            const ids = modalPlato.datos.grupos_opciones_ids || [];
                            const nuevosIds = e.target.checked
                              ? [...ids, g.id_grupo_opcion]
                              : ids.filter(id => id !== g.id_grupo_opcion);
                            setModalPlato({ ...modalPlato, datos: { ...modalPlato.datos, grupos_opciones_ids: nuevosIds } });
                          }}
                          className="rounded text-ocean-600 focus:ring-ocean-500"
                        />
                        <span>{g.nombre} ({g.es_obligatorio ? 'Obligatorio' : 'Opcional'})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="chk-ia"
                  checked={modalPlato.datos.es_recomendado_ia}
                  onChange={e => setModalPlato({ ...modalPlato, datos: { ...modalPlato.datos, es_recomendado_ia: e.target.checked } })}
                  className="rounded text-ocean-600 focus:ring-ocean-500"
                />
                <label htmlFor="chk-ia" className="text-xs text-slate-700 font-semibold cursor-pointer flex items-center gap-1">
                  ⭐ Destacar como Plato Recomendado por IA
                </label>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalPlato({ abierto: false, modo: 'crear', datos: {} })}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-ocean-600 hover:bg-ocean-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md"
                >
                  Guardar Plato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL DE CONFIRMACIÓN ESTILIZADO (Reemplazo window.confirm)    */}
      {/* ============================================================== */}
      {modalConfirmacion.abierto && (
        <div className="no-print fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-ocean-950 border border-ocean-800 text-white rounded-3xl p-6 max-w-sm w-full shadow-2xl relative overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-1.5 ${modalConfirmacion.tipo === 'peligro' ? 'bg-rose-500' : 'bg-amber-400'}`} />
            
            <div className="flex items-start gap-3.5 mb-4 mt-1">
              <div className={`p-2.5 rounded-2xl shrink-0 ${modalConfirmacion.tipo === 'peligro' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                <AlertCircle size={22} strokeWidth={2.2} />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-white leading-snug">
                  {modalConfirmacion.titulo}
                </h4>
                <p className="text-xs text-ocean-300 mt-1 leading-relaxed">
                  {modalConfirmacion.mensaje}
                </p>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setModalConfirmacion(prev => ({ ...prev, abierto: false }))}
                className="flex-1 py-2.5 px-3 bg-ocean-900/80 hover:bg-ocean-800 text-ocean-200 font-bold text-xs rounded-xl transition-all border border-ocean-700/50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={modalConfirmacion.onConfirmar}
                className={`flex-1 py-2.5 px-3 font-extrabold text-xs rounded-xl shadow-lg transition-all ${
                  modalConfirmacion.tipo === 'peligro'
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-900/40'
                    : 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-900/40'
                }`}
              >
                {modalConfirmacion.textoBoton}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

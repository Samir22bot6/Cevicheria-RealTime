import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api, socket } from '../services/api';
import { useToast, ToastContainer } from '../components/Toast';
import {
  Utensils,
  Sparkles,
  Receipt,
  Plus,
  Minus,
  CheckCircle2,
  Clock,
  Star,
  ExternalLink,
  Bell,
  X,
  CreditCard,
  ChefHat,
  ShieldCheck,
  Check,
  AlertTriangle,
  RotateCcw,
  MapPin,
  Timer,
  Users,
  ShoppingCart
} from 'lucide-react';

export default function ClienteView() {
  const { qrToken } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast, toasts, dismissToast } = useToast();
  const timerRef = useRef(null);

  const [sesion, setSesion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [segundosCargando, setSegundosCargando] = useState(0);
  const [errorSesion, setErrorSesion] = useState(null);
  const [errorCodigo, setErrorCodigo] = useState(null); // 'GPS_REQUERIDO' | 'FUERA_DE_RANGO'
  const [pestana, setPestana] = useState('carta');
  const [tiempoRestante, setTiempoRestante] = useState(null); // segundos restantes de sesión

  // Llamar mozo — botón flotante con opciones
  const [mostrarOpcionesMozo, setMostrarOpcionesMozo] = useState(false);
  const MOTIVOS_MOZO = [
    '🌶️ Más ají / limón / cancha',
    '🧻 Servilletas / Cubiertos',
    '👨‍🍳 Asistencia de mozo',
    '💳 Pedir la cuenta en efectivo',
  ];
  // (estado ya declarado arriba)

  // Carta y filtros
  const [carta, setCarta] = useState([]);
  const [catSeleccionada, setCatSeleccionada] = useState(null);
  const [platoModal, setPlatoModal] = useState(null);
  const [opcionesElegidas, setOpcionesElegidas] = useState([]);
  const [obsItem, setObsItem] = useState('');
  const [cantidadItem, setCantidadItem] = useState(1);

  // Carrito local para pedido
  const [carrito, setCarrito] = useState([]);

  // Cuenta y pedidos en vivo
  const [cuenta, setCuenta] = useState(null);

  // Chat IA — Don Lucho con combo sugerido
  const [chatMensajes, setChatMensajes] = useState([
    {
      remitente: 'ia',
      texto: '¡Hola causita! 🐟 Soy Don Lucho, tu maestro cevichero. ¿Buscas algo picantito, una combinación para compartir o quieres saber qué pesca fresca salió hoy?',
      items_sugeridos: null,
      total_estimado: null
    }
  ]);
  const [inputIa, setInputIa] = useState('');
  const [consultandoIa, setConsultandoIa] = useState(false);

  // Modal Reseña
  const [mostrarModalResena, setMostrarModalResena] = useState(false);
  const [calificacion, setCalificacion] = useState(5);
  const [comentarioResena, setComentarioResena] = useState('');
  const [resultadoResena, setResultadoResena] = useState(null);

  // Modal Pago y Mercado Pago — División de cuenta
  const [mostrarModalPago, setMostrarModalPago] = useState(false);
  const [metodoPago, setMetodoPago] = useState('YAPE');
  const [modoPago, setModoPago] = useState('completo'); // 'completo' | 'dividir'
  const [personasDivision, setPersonasDivision] = useState(2);
  const [propina, setPropina] = useState(0);
  const [referenciaPasarela, setReferenciaPasarela] = useState('');
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [ordenCreadaMP, setOrdenCreadaMP] = useState(null);
  const [comprobantePago, setComprobantePago] = useState(null);

  // Prepago de pedidos obligatorio (Flujo Cero Pedidos a Cocina sin Pago)
  const [pedidoEnPrepago, setPedidoEnPrepago] = useState(null);
  const [mostrarModalPrepago, setMostrarModalPrepago] = useState(false);
  const [cargandoPrepago, setCargandoPrepago] = useState(false);
  const [simulandoPago, setSimulandoPago] = useState(false);
  const [ticketConfirmadoCocina, setTicketConfirmadoCocina] = useState(null);

  // Temporizador de sesión
  const actualizarTiempoRestante = (expira_en) => {
    if (!expira_en) return;
    const diff = Math.max(0, Math.floor((new Date(expira_en) - Date.now()) / 1000));
    setTiempoRestante(diff);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(expira_en) - Date.now()) / 1000));
      setTiempoRestante(remaining);
      if (remaining === 0) clearInterval(timerRef.current);
    }, 15000); // actualizar cada 15s para no sobrecargar
  };

  const formatTiempo = (secs) => {
    if (secs === null || secs === undefined) return '';
    const m = Math.floor(secs / 60);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  };

  // GPS: obtener posición del cliente con timeout rápido para no bloquear
  const obtenerPosicion = () => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ latitud: null, longitud: null });
        return;
      }
      let terminado = false;
      const timer = setTimeout(() => {
        if (!terminado) {
          terminado = true;
          resolve({ latitud: null, longitud: null });
        }
      }, 3500);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!terminado) {
            terminado = true;
            clearTimeout(timer);
            resolve({ latitud: pos.coords.latitude, longitud: pos.coords.longitude });
          }
        },
        () => {
          if (!terminado) {
            terminado = true;
            clearTimeout(timer);
            resolve({ latitud: null, longitud: null });
          }
        },
        { timeout: 3500, maximumAge: 60000 }
      );
    });
  };

  // 1. Iniciar sesión con código QR y GPS (Carga paralela ultrarrápida)
  const cargarSesionMesa = async () => {
    if (!qrToken) {
      setErrorSesion('No se proporcionó ningún código QR en la URL.');
      setCargando(false);
      return;
    }

    sessionStorage.setItem('cevicheria_cliente_qr', qrToken);
    setErrorSesion(null);
    setErrorCodigo(null);
    setCargando(true);

    try {
      // Iniciar descarga de carta de inmediato en paralelo
      const promesaCarta = api.obtenerCarta();

      // Pedir ubicación GPS con timeout controlado
      const { latitud, longitud } = await obtenerPosicion();
      const res = await api.abrirSesion(qrToken, 1, latitud, longitud);

      // Esperar carta que ya venía descargándose
      const resCarta = await promesaCarta;
      if (resCarta.ok && resCarta.data) {
        setCarta(resCarta.data);
        if (resCarta.data.length > 0) setCatSeleccionada(resCarta.data[0].id_categoria);
      }

      if (res && res.ok && res.data) {
        setSesion(res.data);
        if (res.data.expira_en) actualizarTiempoRestante(res.data.expira_en);
        socket.emit('unirse_sesion', res.data.id_sesion);

        // Cargar cuenta de la mesa
        const resCuenta = await api.obtenerCuenta(res.data.id_sesion);
        if (resCuenta.ok) {
          setCuenta(resCuenta.data);
        }

        // Verificar si retornamos de Mercado Pago con parámetros de aprobación
        const idPagoUrl = searchParams.get('id_pago');
        const orderIdUrl = searchParams.get('order_id') || searchParams.get('merchant_order_id');
        const paymentIdUrl = searchParams.get('payment_id');
        const statusUrl = searchParams.get('status') || searchParams.get('collection_status');

        if (idPagoUrl) {
          confirmarRetornoDesdeUrl(idPagoUrl, orderIdUrl, paymentIdUrl, statusUrl, res.data.id_sesion);
        }
      } else if (res?._statusCode === 403 || res?.codigo === 'GPS_REQUERIDO' || res?.codigo === 'FUERA_DE_RANGO') {
        setErrorCodigo(res.codigo || 'FUERA_DE_RANGO');
        setErrorSesion(res.error || 'Debes estar dentro de SIN ESPINAS para ordenar en mesa.');
      } else {
        const msg = res?.error || res?.message || 'No fue posible abrir la sesión de la mesa.';
        setErrorSesion(msg);
      }
    } catch (e) {
      console.error('Error inicializando sesión:', e);
      setErrorSesion(
        e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError')
          ? 'El servidor en la nube está despertando o no responde. Por favor espera unos segundos y pulsa Reintentar.'
          : e.message || 'Error inesperado al conectar con el servidor.'
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarSesionMesa();
    // Cleanup timer al desmontar
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [qrToken]);

  // Contador de segundos para la pantalla de carga (útil cuando Render está despertando)
  useEffect(() => {
    let interval;
    if (cargando) {
      interval = setInterval(() => setSegundosCargando(s => s + 1), 1000);
    } else {
      setSegundosCargando(0);
    }
    return () => clearInterval(interval);
  }, [cargando]);

  // Función para confirmar retorno de pasarela
  const confirmarRetornoDesdeUrl = async (id_pago, order_id, payment_id, status, idSesionActual) => {
    try {
      const res = await api.confirmarRetornoMercadoPago({
        id_pago,
        order_id,
        payment_id,
        status: status || 'approved'
      });

      if (res.ok) {
        setComprobantePago({
          id_pago: res.id_pago,
          referencia: res.referencia_pasarela
        });

        // Limpiar parámetros de la URL
        navigate(`/mesa/${qrToken}`, { replace: true });

        // Actualizar cuenta y cambiar a pestaña cuenta
        setPestana('cuenta');
        const cRes = await api.obtenerCuenta(idSesionActual || sesion?.id_sesion);
        if (cRes.ok) setCuenta(cRes.data);

        // Desplegar modal de calificación
        setTimeout(() => {
          setMostrarModalResena(true);
        }, 1200);
      }
    } catch (err) {
      console.warn('Error confirmando retorno:', err);
    }
  };

  // 2. Escuchar cambios de estado en vivo vía WebSockets
  useEffect(() => {
    if (!sesion?.id_sesion) return;

    socket.on('estado_plato_actualizado', () => {
      // Refrescar cuenta y pedidos de la mesa
      api.obtenerCuenta(sesion.id_sesion).then(r => {
        if (r.ok) setCuenta(r.data);
      });
    });

    // Refrescar carta cuando el admin actualice disponibilidad
    socket.on('carta_actualizada', () => {
      api.obtenerCarta().then(r => { if (r.ok) setCarta(r.data); });
    });

    socket.on('pago_procesado', () => {
      api.obtenerCuenta(sesion.id_sesion).then(r => {
        if (r.ok) setCuenta(r.data);
      });
    });

    // Evento activado cuando el pedido en prepago es aprobado y enviado a cocina
    socket.on('pedido_pagado_confirmado', (data) => {
      setTicketConfirmadoCocina({
        numero_ticket: data.numero_ticket,
        mensaje: '¡Pago recibido! Tu pedido ya entró a cocina'
      });
      setMostrarModalPrepago(false);
      setPedidoEnPrepago(null);
      setCarrito([]);
      setPestana('cuenta');
      showToast('success', '¡Pedido confirmado!', `Ticket ${data.numero_ticket} ya entró a cocina 🐟`);
      api.obtenerCuenta(sesion.id_sesion).then(r => {
        if (r.ok) setCuenta(r.data);
      });
    });

    socket.on('pago_confirmado', (data) => {
      setComprobantePago({
        id_pago: data.id_pago,
        referencia: data.referencia_pasarela
      });
      api.obtenerCuenta(sesion.id_sesion).then(r => {
        if (r.ok) setCuenta(r.data);
      });
      setTimeout(() => {
        setMostrarModalResena(true);
      }, 1000);
    });

    return () => {
      socket.off('estado_plato_actualizado');
      socket.off('carta_actualizada');
      socket.off('pago_procesado');
      socket.off('pedido_pagado_confirmado');
      socket.off('pago_confirmado');
    };
  }, [sesion?.id_sesion]);

  const abrirModalPlato = (plato) => {
    setPlatoModal(plato);
    setCantidadItem(1);
    setObsItem('');

    // Preseleccionar opciones obligatorias por defecto (ej. Sin Ají, Pesca del Día)
    const defaults = [];
    (plato.grupos_opciones || []).forEach(grupo => {
      if (grupo.es_obligatorio && grupo.opciones && grupo.opciones.length > 0) {
        defaults.push(grupo.opciones[0].id_opcion);
      }
    });
    setOpcionesElegidas(defaults);
  };

  const alternarOpcion = (grupo, id_opcion) => {
    if (grupo.seleccion_multiple) {
      if (opcionesElegidas.includes(id_opcion)) {
        setOpcionesElegidas(opcionesElegidas.filter(id => id !== id_opcion));
      } else {
        setOpcionesElegidas([...opcionesElegidas, id_opcion]);
      }
    } else {
      // Reemplazar opción de este grupo
      const idsGrupo = grupo.opciones.map(o => o.id_opcion);
      const restantes = opcionesElegidas.filter(id => !idsGrupo.includes(id));
      setOpcionesElegidas([...restantes, id_opcion]);
    }
  };

  const agregarAlCarrito = () => {
    if (!platoModal) return;

    // Calcular precio con extras
    let extrasTotal = 0;
    const nombresOpciones = [];
    (platoModal.grupos_opciones || []).forEach(g => {
      g.opciones?.forEach(o => {
        if (opcionesElegidas.includes(o.id_opcion)) {
          extrasTotal += Number(o.precio_adicional || 0);
          nombresOpciones.push(o.nombre);
        }
      });
    });

    const subtotal = (Number(platoModal.precio_base) + extrasTotal) * cantidadItem;

    const itemCarrito = {
      id_temporal: Date.now() + Math.random(),
      id_plato: platoModal.id_plato,
      nombre_plato: platoModal.nombre,
      precio_base: Number(platoModal.precio_base),
      cantidad: cantidadItem,
      opciones_ids: opcionesElegidas,
      opciones_nombres: nombresOpciones,
      observaciones_item: obsItem,
      subtotal
    };

    setCarrito([...carrito, itemCarrito]);
    setPlatoModal(null);
  };

  const iniciarPrepagoPedido = async () => {
    if (!sesion || carrito.length === 0) return;

    try {
      setCargandoPrepago(true);
      const itemsPayload = carrito.map(c => ({
        id_plato: c.id_plato,
        cantidad: c.cantidad,
        observaciones_item: c.observaciones_item,
        opciones_ids: c.opciones_ids
      }));

      const res = await api.crearPedido({
        id_sesion: sesion.id_sesion,
        notas_generales: 'Pedido Prepago desde Carta QR',
        items: itemsPayload,
        qr_token: qrToken,
        metodo_preferido: metodoPago
      });

      if (res.ok && res.data) {
        setPedidoEnPrepago(res.data);
        setMostrarModalPrepago(true);

        // Si Mercado Pago devolvió URL real (Checkout Pro)
        if (!res.data.orden_pago?.modo_demo && res.data.orden_pago?.checkout_url) {
          window.location.href = res.data.orden_pago.checkout_url;
        }
      } else {
        showToast('error', 'Error al generar pedido', res?.error || 'No se pudo crear el pedido');
      }
    } catch (e) {
      showToast('error', 'Error al pedir', e.message || 'No se pudo generar el pedido.');
    } finally {
      setCargandoPrepago(false);
    }
  };

  const simularPagoPrepagoExitoso = async () => {
    if (!pedidoEnPrepago?.id_pedido) return;
    try {
      setSimulandoPago(true);
      const res = await api.simularAprobacionPedido(pedidoEnPrepago.id_pedido);
      if (res.ok) {
        setTicketConfirmadoCocina({
          numero_ticket: pedidoEnPrepago.numero_ticket,
          mensaje: '¡Pago recibido! Tu pedido ya entró a cocina'
        });
        setMostrarModalPrepago(false);
        setPedidoEnPrepago(null);
        setCarrito([]);
        setPestana('cuenta');
        showToast('success', '¡Pago aprobado!', 'Tu pedido fue enviado a cocina 🐟');
        const cRes = await api.obtenerCuenta(sesion.id_sesion);
        if (cRes.ok) setCuenta(cRes.data);
      } else {
        showToast('error', 'Error en simulación', res.error || 'No se pudo aprobar el pedido');
      }
    } catch (e) {
      showToast('error', 'Error', e.message || 'Error simulando el pago');
    } finally {
      setSimulandoPago(false);
    }
  };

  const enviarPreguntaIa = async (e) => {
    e.preventDefault();
    if (!inputIa.trim() || consultandoIa) return;

    const textoUsuario = inputIa;
    setInputIa('');
    setChatMensajes(prev => [...prev, { remitente: 'usuario', texto: textoUsuario }]);
    setConsultandoIa(true);

    try {
      const contexto = {
        platos_en_carrito: carrito.map(c => c.nombre_plato),
        total_consumido: cuenta?.total_consumido || 0
      };

      const res = await api.consultarIA(textoUsuario, contexto);
      if (res.ok && res.data) {
        setChatMensajes(prev => [...prev, {
          remitente: 'ia',
          texto: res.data.mensaje_lucho || res.data.respuesta || '¡Excelente elección, causa!',
          items_sugeridos: res.data.items_sugeridos || [],
          total_estimado: res.data.total_estimado || null
        }]);
      }
    } catch (err) {
      setChatMensajes(prev => [
        ...prev,
        { remitente: 'ia', texto: '¡Disculpa causita! Tuve un cruce con la comanda. Recomiendo que pruebes el Ceviche Clásico mientras arreglo esto.' }
      ]);
    } finally {
      setConsultandoIa(false);
    }
  };

  // 1. Iniciar pago con Mercado Pago (Orders API)
  const iniciarPagoMercadoPago = async () => {
    if (!sesion || !cuenta) return;
    setProcesandoPago(true);

    try {
      const montoAPagar = modoPago === 'dividir'
        ? parseFloat((cuenta.saldo_pendiente / personasDivision).toFixed(2))
        : cuenta.saldo_pendiente;

      const res = await api.crearOrdenMercadoPago({
        id_sesion: sesion.id_sesion,
        qr_token: qrToken,
        metodo_preferido: metodoPago === 'POS_FISICO' ? 'POS_FISICO' : metodoPago,
        monto: montoAPagar,
        propina: Number(propina) || 0
      });

      if (res.ok) {
        if (!res.modo_demo && res.checkout_url) {
          // Redirigir al Checkout Pro / Orders de Mercado Pago
          window.location.href = res.checkout_url;
        } else {
          // Modo Demo activo
          setOrdenCreadaMP(res);
        }
      } else {
        showToast('error', 'Error de pago', res.error || 'Error creando orden de pago');
      }
    } catch (e) {
      showToast('error', 'Sin conexión', 'No se pudo conectar con la pasarela de pago.');
    } finally {
      setProcesandoPago(false);
    }
  };

  // 2. Simular pago aprobado en Modo Demo
  const simularPagoAprobadoDemo = async () => {
    if (!ordenCreadaMP?.id_pago) return;
    setProcesandoPago(true);

    try {
      const res = await api.confirmarRetornoMercadoPago({
        id_pago: ordenCreadaMP.id_pago,
        order_id: `ORD-DEMO-${Date.now()}`,
        status: 'approved'
      });

      if (res.ok) {
        setComprobantePago({
          id_pago: res.id_pago,
          referencia: res.referencia_pasarela
        });
        setMostrarModalPago(false);
        setOrdenCreadaMP(null);
        setPropina(0);
        const cRes = await api.obtenerCuenta(sesion.id_sesion);
        if (cRes.ok) setCuenta(cRes.data);
        setTimeout(() => {
          setMostrarModalResena(true);
        }, 1000);
      } else {
        showToast('error', 'Error confirmando pago', res.error || 'No se pudo confirmar el pago');
      }
    } catch (e) {
      showToast('error', 'Error simulando aprobación', e.message || 'Intenta de nuevo');
    } finally {
      setProcesandoPago(false);
    }
  };

  const ejecutarPago = async () => {
    if (!sesion || !cuenta) return;
    // Si elige método online (Yape, Plin o Tarjeta), usar flujo Mercado Pago
    if (['YAPE', 'PLIN', 'TARJETA_ONLINE'].includes(metodoPago)) {
      return iniciarPagoMercadoPago();
    }

    // Si es POS Mozo o pago tradicional
    const montoAPagar = modoPago === 'dividir'
      ? parseFloat(((cuenta.saldo_pendiente / personasDivision)).toFixed(2))
      : cuenta.saldo_pendiente;

    setProcesandoPago(true);
    try {
      const res = await api.pagar({
        id_sesion: sesion.id_sesion,
        metodo_pago: metodoPago,
        monto: montoAPagar,
        propina: Number(propina) || 0,
        referencia_pasarela: referenciaPasarela.trim() || undefined
      });

      if (res.ok) {
        setMostrarModalPago(false);
        setPropina(0);
        setReferenciaPasarela('');
        const cRes = await api.obtenerCuenta(sesion.id_sesion);
        if (cRes.ok) setCuenta(cRes.data);
        setMostrarModalResena(true);
      }
    } catch (e) {
      showToast('error', 'Error de pago', e.message || 'No se pudo procesar el pago');
    } finally {
      setProcesandoPago(false);
    }
  };

  const enviarCalificacion = async () => {
    if (!sesion) return;
    try {
      const res = await api.enviarResena({
        id_sesion: sesion.id_sesion,
        calificacion,
        comentario: comentarioResena
      });

      if (res.ok) {
        setResultadoResena(res);
        if (res.redirigirGoogle && res.url) {
          setTimeout(() => {
            window.open(res.url, '_blank');
          }, 1500);
        }
      }
    } catch (e) {
      showToast('error', 'Error al registrar reseña', e.message || 'Intenta de nuevo');
    }
  };

  const llamarMozo = async (motivo) => {
    const motivoFinal = motivo || '👨‍🍳 Asistencia de mozo';
    socket.emit('llamar_mozo', {
      tipo: 'LLAMAR_MOZO',
      numero_mesa: sesion?.numero_mesa,
      id_sesion: sesion?.id_sesion,
      motivo: motivoFinal,
      mensaje: `Mesa ${sesion?.numero_mesa}: ${motivoFinal}`
    });
    // También emitir backward-compat
    socket.emit('solicitar_atencion', {
      tipo: 'LLAMAR_MOZO',
      numero_mesa: sesion?.numero_mesa,
      id_sesion: sesion?.id_sesion,
      mensaje: `Mesa ${sesion?.numero_mesa}: ${motivoFinal}`
    });
    // Llamada REST de respaldo
    if (sesion?.id_sesion) {
      api.llamarMozo(sesion.id_sesion, sesion.numero_mesa, motivoFinal).catch(() => {});
    }
    setMostrarOpcionesMozo(false);
    showToast('success', '🔔 Mozo notificado', `Un mozo se acercará en breve a tu mesa`);
  };

  if (cargando) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-slate-50">
        <div className="w-14 h-14 border-4 border-ocean-600 border-t-transparent rounded-full animate-spin mb-4 shadow-sm"></div>
        <h2 className="text-base font-bold text-slate-800 mb-1">Conectando con tu mesa...</h2>
        <p className="text-xs text-slate-500 max-w-xs leading-relaxed mb-4">
          Abriendo sesión y cargando carta fresca del día.
        </p>

        {segundosCargando >= 4 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 max-w-xs text-left animate-in fade-in shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
              <span>Despertando servidor en la nube ({segundosCargando}s)</span>
            </div>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              En el plan gratuito de Render, el servidor se apaga tras 15 minutos sin uso.
              El primer encendido toma entre <strong>40 a 60 segundos</strong>. Luego de eso, la carta cargará de inmediato.
            </p>
          </div>
        )}
      </div>
    );
  }

  if (errorSesion) {
    // Pantalla especial para error GPS (dentro del local)
    if (errorCodigo === 'GPS_REQUERIDO' || errorCodigo === 'FUERA_DE_RANGO') {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-gradient-to-b from-ocean-900 to-ocean-800">
          <div className="bg-white p-7 rounded-3xl shadow-2xl border border-ocean-100 max-w-sm w-full">
            <div className="w-16 h-16 bg-ocean-100 text-ocean-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-black text-ocean-900 mb-2">Acceso exclusivo en local</h2>
            <p className="text-sm text-slate-600 mb-5 leading-relaxed">
              Para ordenar en mesa debes estar dentro de <span className="font-bold text-ocean-700">SIN ESPINAS</span>.
              Acércate al restaurante y vuelve a escanear el QR.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-left">
              <p className="text-xs text-amber-700 font-medium break-words">{errorSesion}</p>
            </div>
            <button
              onClick={cargarSesionMesa}
              className="w-full bg-ocean-600 hover:bg-ocean-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-md"
            >
              <RotateCcw className="w-4 h-4" />
              Reintentar ubicación
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-slate-50">
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-red-100 max-w-sm w-full">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-800 mb-2">No pudimos conectar con la mesa</h2>
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5 text-left">
            <p className="text-xs text-red-700 font-medium break-words">{errorSesion}</p>
          </div>
          <button
            onClick={cargarSesionMesa}
            className="w-full bg-ocean-600 hover:bg-ocean-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-md"
          >
            <RotateCcw className="w-4 h-4" />
            Reintentar Conexión
          </button>
        </div>
      </div>
    );
  }

  const categoriaActual = carta.find(c => c.id_categoria === catSeleccionada);
  const totalCarrito = carrito.reduce((sum, item) => sum + item.subtotal, 0);

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white pb-24 shadow-lg border-x border-slate-100 flex flex-col justify-between">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {/* Cabecera Móvil */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.jpg"
            alt="Sin Espinas"
            className="w-9 h-9 rounded-full object-cover border border-ocean-200 shadow-sm"
          />
          <div>
            <span className="text-[10px] font-black text-ocean-800 tracking-wider block leading-none uppercase">
              SIN ESPINAS
            </span>
            <h1 className="text-base font-extrabold text-slate-800 flex items-center gap-1.5 leading-tight">
              Mesa {sesion?.numero_mesa || 'M-??'}
              <span className="inline-block w-2 h-2 rounded-full bg-lime-500 animate-pulse"></span>
              {tiempoRestante !== null && (
                <span className={`ml-1 flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                  tiempoRestante < 900
                    ? 'bg-amber-100 text-amber-700 border-amber-300'
                    : 'bg-ocean-100 text-ocean-700 border-ocean-200'
                }`}>
                  <Timer className="w-2.5 h-2.5" />
                  {formatTiempo(tiempoRestante)}
                </span>
              )}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1"
          >
            Salir
          </Link>
        </div>
      </header>

      {/* CUERPO PRINCIPAL SEGÚN PESTAÑA */}
      <main className="flex-1 p-4">
        {/* ==================== PESTAÑA 1: CARTA ==================== */}
        {pestana === 'carta' && (
          <div>
            {/* Categorías deslizables */}
            <div className="flex gap-2 overflow-x-auto pb-3 mb-4 no-scrollbar">
              {carta.map(cat => (
                <button
                  key={cat.id_categoria}
                  onClick={() => setCatSeleccionada(cat.id_categoria)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                    catSeleccionada === cat.id_categoria
                      ? 'bg-ocean-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.nombre}
                </button>
              ))}
            </div>

            {/* Listado de Platos */}
            <div className="space-y-4">
              {categoriaActual?.platos?.map(plato => (
                <div
                  key={plato.id_plato}
                  onClick={() => abrirModalPlato(plato)}
                  className="flex gap-3 bg-slate-50 hover:bg-ocean-50/50 border border-slate-200/80 rounded-2xl p-3 cursor-pointer transition"
                >
                  <img
                    src={plato.imagen_url || 'https://images.unsplash.com/photo-1535399831218-d5bd36d1a6b3?w=300'}
                    alt={plato.nombre}
                    className="w-24 h-24 rounded-xl object-cover flex-shrink-0"
                  />
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-slate-800 text-sm">{plato.nombre}</h4>
                          {plato.modelo_3d_url && (
                            <span className="bg-ocean-100 text-ocean-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-ocean-200">
                              📦 3D
                            </span>
                          )}
                        </div>
                        {plato.es_recomendado_ia && (
                          <span className="bg-amber-100 text-amber-700 text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0">
                            ⭐ Top
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1">{plato.descripcion}</p>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-extrabold text-ocean-700 text-sm">
                        S/ {Number(plato.precio_base).toFixed(2)}
                      </span>
                      <span className="text-[11px] text-ocean-600 font-semibold bg-ocean-100/70 px-2 py-0.5 rounded-md">
                        + Personalizar
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== PESTAÑA 2: ASISTENTE IA ==================== */}
        {pestana === 'ia' && (
          <div className="flex flex-col h-[70vh]">
            <div className="bg-gradient-to-r from-ocean-800 to-ocean-700 rounded-xl p-3 mb-3 flex items-center gap-2 text-xs text-white shadow-sm">
              <ChefHat className="w-5 h-5 text-lime-400 flex-shrink-0" />
              <div>
                <span className="font-bold block">Don Lucho — Maestro Cevichero 🐟</span>
                <span className="text-ocean-200 text-[10px]">Pídeme un combo, maridaje o lo que se te antoje causa</span>
              </div>
            </div>

            {/* Botones rápidos */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-2 no-scrollbar">
              {[
                '🍽️ Ármame algo para 2 con S/ 70',
                '🌊 Algo fresco y sin mucho picante',
                '🤕 Para curar la resaca'
              ].map(sugerencia => (
                <button
                  key={sugerencia}
                  onClick={() => {
                    setInputIa(sugerencia);
                    setTimeout(() => {
                      document.getElementById('ia-form')?.requestSubmit();
                    }, 50);
                  }}
                  className="whitespace-nowrap bg-ocean-100 text-ocean-800 text-[11px] font-semibold px-3 py-1.5 rounded-full border border-ocean-200 hover:bg-ocean-200 transition flex-shrink-0"
                >
                  {sugerencia}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {chatMensajes.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${m.remitente === 'usuario' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      m.remitente === 'usuario'
                        ? 'bg-ocean-600 text-white rounded-tr-none'
                        : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200'
                    }`}
                  >
                    {m.texto}
                  </div>
                  {/* Tarjeta de combo sugerido por Don Lucho */}
                  {m.remitente === 'ia' && m.items_sugeridos && m.items_sugeridos.length > 0 && (
                    <div className="mt-2 w-full max-w-[90%] bg-white border border-lime-300 rounded-2xl p-3 shadow-sm">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Sparkles className="w-3.5 h-3.5 text-lime-600" />
                        <span className="text-[11px] font-bold text-lime-700">Combo sugerido por Don Lucho</span>
                      </div>
                      <div className="space-y-1 mb-2">
                        {m.items_sugeridos.map((item, i) => (
                          <div key={i} className="flex justify-between text-xs text-slate-700">
                            <span>{item.cantidad}x {item.nombre_plato}</span>
                            <span className="font-semibold">S/ {Number(item.precio_unitario).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-lime-200 pt-1.5 flex justify-between text-xs font-bold text-ocean-800">
                        <span>Total estimado</span>
                        <span>S/ {Number(m.total_estimado || 0).toFixed(2)}</span>
                      </div>
                      <button
                        onClick={() => {
                          const nuevosItems = m.items_sugeridos.map(item => ({
                            id_temporal: Date.now() + Math.random(),
                            id_plato: item.id_plato,
                            nombre_plato: item.nombre_plato,
                            precio_base: Number(item.precio_unitario),
                            cantidad: item.cantidad,
                            opciones_ids: item.opciones_ids || [],
                            opciones_nombres: item.nombres_opciones || [],
                            observaciones_item: '',
                            subtotal: Number(item.precio_unitario) * item.cantidad
                          }));
                          setCarrito(prev => [...prev, ...nuevosItems]);
                          setPestana('carta');
                          showToast('success', '🛒 Combo agregado', 'Los platos de Don Lucho fueron al carrito');
                        }}
                        className="mt-2.5 w-full bg-lime-500 hover:bg-lime-600 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        Agregar todo al carrito
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {consultandoIa && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 text-slate-500 rounded-2xl rounded-tl-none px-4 py-2 text-xs flex items-center gap-1.5">
                    <span className="animate-bounce">●</span>
                    <span className="animate-bounce delay-100">●</span>
                    <span className="animate-bounce delay-200">●</span>
                    <span className="ml-1">Don Lucho está pensando...</span>
                  </div>
                </div>
              )}
            </div>

            <form id="ia-form" onSubmit={enviarPreguntaIa} className="mt-3 flex gap-2">
              <input
                type="text"
                value={inputIa}
                onChange={e => setInputIa(e.target.value)}
                placeholder="Ej: ¿Qué ceviche me recomiendas?"
                className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ocean-500"
              />
              <button
                type="submit"
                disabled={consultandoIa || !inputIa.trim()}
                className="bg-ocean-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-ocean-700 transition"
              >
                Preguntar
              </button>
            </form>
          </div>
        )}

        {/* ==================== PESTAÑA 3: CUENTA Y PEDIDOS ==================== */}
        {pestana === 'cuenta' && (
          <div>
            {/* Banner de Pedido Prepago Confirmado en Cocina */}
            {ticketConfirmadoCocina && (
              <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 mb-4 text-emerald-950 animate-in fade-in shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <span className="font-extrabold text-sm">{ticketConfirmadoCocina.mensaje}</span>
                </div>
                <p className="text-xs text-emerald-700 font-medium">
                  Ticket <strong>{ticketConfirmadoCocina.numero_ticket}</strong>. Cocina ya tiene tu comanda y puedes seguir el estado de preparación abajo en tiempo real.
                </p>
              </div>
            )}

            {/* Comprobante de Pago Confirmado */}
            {comprobantePago && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-5 text-emerald-900 animate-in fade-in">
                <div className="flex items-center gap-2 mb-1.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <span className="font-extrabold text-sm">¡Pago Aprobado y Confirmado!</span>
                </div>
                <p className="text-xs text-emerald-700">Tu mesa ha sido procesada correctamente.</p>
                <div className="mt-2.5 pt-2 border-t border-emerald-200/60 flex justify-between text-[11px] font-mono">
                  <span>Referencia:</span>
                  <span className="font-bold">{comprobantePago.referencia}</span>
                </div>
              </div>
            )}

            {/* Resumen de consumo */}
            <div className="bg-gradient-to-br from-ocean-700 to-ocean-900 text-white rounded-2xl p-4 shadow-sm mb-5">
              <span className="text-xs text-ocean-200 uppercase tracking-wider font-semibold">Estado de Mesa</span>
              <div className="flex items-baseline justify-between mt-1">
                <h3 className="text-2xl font-black">S/ {(cuenta?.total_consumido || 0).toFixed(2)}</h3>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                  {cuenta?.estado_sesion === 'ABIERTA' ? '🟢 En consumo' : '⚪ Cerrada'}
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-ocean-600/50 flex justify-between text-xs text-ocean-100">
                <span>Pagado: S/ {(cuenta?.total_pagado || 0).toFixed(2)}</span>
                <span className="font-bold text-white">Pendiente: S/ {(cuenta?.saldo_pendiente || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Pedidos activos y estado en cocina */}
            <h4 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-ocean-600" />
              Seguimiento de Platos en Cocina
            </h4>

            {cuenta?.pedidos?.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">Aún no has enviado pedidos a cocina.</p>
            ) : (
              <div className="space-y-3 mb-6">
                {cuenta?.pedidos?.map(ped => (
                  <div key={ped.id_pedido} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <div className="flex justify-between items-center text-xs text-slate-500 mb-2 border-b border-slate-200 pb-1.5">
                      <span className="font-mono font-bold text-slate-700">{ped.numero_ticket}</span>
                      <span>{new Date(ped.creado_en).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <div className="space-y-2">
                      {ped.detalle_pedidos?.map(det => {
                        const estado = det.estado_estacion;
                        let badgeColor = 'bg-slate-200 text-slate-700';
                        if (estado === 'PENDIENTE') badgeColor = 'bg-amber-100 text-amber-800';
                        if (estado === 'PREPARANDO') badgeColor = 'bg-blue-100 text-blue-800';
                        if (estado === 'LISTO') badgeColor = 'bg-emerald-100 text-emerald-800 animate-pulse';
                        if (estado === 'ENTREGADO') badgeColor = 'bg-slate-100 text-slate-500';

                        return (
                          <div key={det.id_detalle} className="flex justify-between items-center text-xs">
                            <div>
                              <span className="font-bold text-slate-800">{det.cantidad}x </span>
                              <span>{det.platos?.nombre}</span>
                              {det.detalle_pedido_opciones?.length > 0 && (
                                <p className="text-[10px] text-slate-400">
                                  {det.detalle_pedido_opciones.map(o => o.opciones_personalizacion?.nombre).join(', ')}
                                </p>
                              )}
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
                              {estado}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Acciones de Pago, Reseña y Nueva Orden */}
            <div className="space-y-2">
              {cuenta && cuenta.saldo_pendiente > 0 ? (
                <button
                  onClick={() => setMostrarModalPago(true)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition"
                >
                  <CreditCard className="w-4 h-4" />
                  Pagar Cuenta (S/ {cuenta.saldo_pendiente.toFixed(2)})
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setMostrarModalResena(true)}
                    className="w-full bg-ocean-600 hover:bg-ocean-700 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition"
                  >
                    <Star className="w-4 h-4" />
                    Calificar Experiencia
                  </button>

                  <button
                    onClick={() => setPestana('carta')}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition"
                  >
                    <Utensils className="w-4 h-4 text-ocean-600" />
                    Pedir más platos / Ver la Carta
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* BARRA FLOTANTE DE CARRITO SI HAY ÍTEMS */}
      {carrito.length > 0 && pestana === 'carta' && (
        <div className="fixed bottom-16 left-0 right-0 max-w-md mx-auto px-4 z-20">
          <div className="bg-slate-900 text-white rounded-2xl p-3 shadow-xl flex items-center justify-between border border-slate-700">
            <div>
              <span className="text-xs text-slate-300">{carrito.length} plato(s) listos</span>
              <p className="font-bold text-sm">S/ {totalCarrito.toFixed(2)}</p>
            </div>
            <button
              onClick={iniciarPrepagoPedido}
              disabled={cargandoPrepago}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-md"
            >
              <CreditCard className="w-4 h-4" />
              {cargandoPrepago ? 'Generando...' : `Ir a Pagar (S/ ${totalCarrito.toFixed(2)})`}
            </button>
          </div>
        </div>
      )}

      {/* BOTÓN FLOTANTE LLAMAR MOZO */}
      {sesion && (
        <div className="fixed bottom-20 right-4 max-w-md z-40" style={{ right: 'max(1rem, calc(50vw - 14rem))' }}>
          {/* Panel de motivos */}
          {mostrarOpcionesMozo && (
            <div className="mb-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-2">
              <div className="bg-ocean-700 text-white px-4 py-2.5 flex items-center justify-between">
                <span className="text-xs font-bold">¿En qué te ayudamos?</span>
                <button onClick={() => setMostrarOpcionesMozo(false)} className="p-0.5 rounded-full hover:bg-ocean-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-2 space-y-1">
                {MOTIVOS_MOZO.map(motivo => (
                  <button
                    key={motivo}
                    onClick={() => llamarMozo(motivo)}
                    className="w-full text-left text-xs font-medium text-slate-700 hover:bg-ocean-50 hover:text-ocean-800 px-3 py-2.5 rounded-xl transition"
                  >
                    {motivo}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={() => setMostrarOpcionesMozo(v => !v)}
            className="bg-ocean-700 hover:bg-ocean-800 text-white font-bold text-xs px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 transition border-2 border-ocean-500"
          >
            <Bell className="w-4 h-4 text-amber-300" />
            Llamar Mozo
          </button>
        </div>
      )}

      {/* NAVEGACIÓN INFERIOR (BOTTOM TABS) */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-200 px-6 py-2 flex justify-between z-30">
        <button
          onClick={() => setPestana('carta')}
          className={`flex flex-col items-center py-1 text-xs font-semibold ${
            pestana === 'carta' ? 'text-ocean-600' : 'text-slate-400'
          }`}
        >
          <Utensils className="w-5 h-5 mb-0.5" />
          Carta
        </button>

        <button
          onClick={() => setPestana('ia')}
          className={`flex flex-col items-center py-1 text-xs font-semibold ${
            pestana === 'ia' ? 'text-ocean-600' : 'text-slate-400'
          }`}
        >
          <Sparkles className="w-5 h-5 mb-0.5" />
          Asistente IA
        </button>

        <button
          onClick={() => setPestana('cuenta')}
          className={`flex flex-col items-center py-1 text-xs font-semibold relative ${
            pestana === 'cuenta' ? 'text-ocean-600' : 'text-slate-400'
          }`}
        >
          <Receipt className="w-5 h-5 mb-0.5" />
          Mi Cuenta
          {cuenta && cuenta.saldo_pendiente > 0 && (
            <span className="absolute top-0 right-2 w-2 h-2 bg-amber-500 rounded-full"></span>
          )}
        </button>
      </nav>

      {/* ================= MODAL DE PERSONALIZACIÓN DE PLATO ================= */}
      {platoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl max-h-[85vh] overflow-y-auto p-5 animate-in slide-in-from-bottom">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-extrabold text-slate-800 text-lg">{platoModal.nombre}</h3>
                <span className="text-ocean-600 font-extrabold text-sm">
                  S/ {Number(platoModal.precio_base).toFixed(2)}
                </span>
              </div>
              <button
                onClick={() => setPlatoModal(null)}
                className="p-1 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4">{platoModal.descripcion}</p>

            {/* Grupos de Opciones */}
            <div className="space-y-4 mb-4">
              {platoModal.grupos_opciones?.map(grupo => (
                <div key={grupo.id_grupo_opcion} className="border-t border-slate-100 pt-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-700">{grupo.nombre}</span>
                    <span className="text-[10px] text-slate-400">
                      {grupo.es_obligatorio ? 'Obligatorio' : 'Opcional'}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {grupo.opciones?.map(op => {
                      const seleccionada = opcionesElegidas.includes(op.id_opcion);
                      return (
                        <div
                          key={op.id_opcion}
                          onClick={() => alternarOpcion(grupo, op.id_opcion)}
                          className={`flex justify-between items-center p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                            seleccionada
                              ? 'border-ocean-500 bg-ocean-50/70 text-ocean-900 font-medium'
                              : 'border-slate-200 bg-white text-slate-700'
                          }`}
                        >
                          <span>{op.nombre}</span>
                          <div className="flex items-center gap-2">
                            {Number(op.precio_adicional) > 0 && (
                              <span className="text-[11px] text-slate-500">
                                +S/ {Number(op.precio_adicional).toFixed(2)}
                              </span>
                            )}
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                seleccionada ? 'border-ocean-600 bg-ocean-600' : 'border-slate-300'
                              }`}
                            >
                              {seleccionada && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Observaciones */}
              <div className="border-t border-slate-100 pt-3">
                <label className="text-xs font-bold text-slate-700 block mb-1">Notas especiales</label>
                <input
                  type="text"
                  value={obsItem}
                  onChange={e => setObsItem(e.target.value)}
                  placeholder="Ej: poco culantro, cebolla bien lavada..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-ocean-500 focus:outline-none"
                />
              </div>

              {/* Cantidad */}
              <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                <span className="text-xs font-bold text-slate-700">Cantidad</span>
                <div className="flex items-center gap-3 bg-slate-100 rounded-xl px-3 py-1">
                  <button
                    onClick={() => setCantidadItem(Math.max(1, cantidadItem - 1))}
                    className="text-slate-600 hover:text-slate-900"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-bold text-xs">{cantidadItem}</span>
                  <button
                    onClick={() => setCantidadItem(cantidadItem + 1)}
                    className="text-slate-600 hover:text-slate-900"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={agregarAlCarrito}
              className="w-full bg-ocean-600 hover:bg-ocean-700 text-white font-bold py-3 rounded-xl text-xs shadow-md transition"
            >
              Agregar a mi Pedido
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL DE PREPAGO OBLIGATORIO ================= */}
      {mostrarModalPrepago && pedidoEnPrepago && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center animate-in zoom-in-95">
            <div className="w-16 h-16 bg-ocean-100 text-ocean-700 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <CreditCard className="w-8 h-8" />
            </div>

            <span className="text-[11px] font-bold text-ocean-600 uppercase tracking-wider block mb-1">
              Ticket: {pedidoEnPrepago.numero_ticket}
            </span>
            <h3 className="text-lg font-black text-slate-800 mb-1">
              Esperando confirmación de pago...
            </h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Tu pedido se enviará inmediatamente a cocina en cuanto se confirme el pago.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-4 text-center">
              <span className="text-xs text-slate-400">Total a pagar</span>
              <p className="text-2xl font-black text-slate-900">
                S/ {Number(pedidoEnPrepago.monto_total || 0).toFixed(2)}
              </p>
              <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-slate-600">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                <span className="font-medium">Escuchando confirmación de pasarela...</span>
              </div>
            </div>

            {/* Si Mercado Pago retornó enlace directo de Checkout Pro */}
            {pedidoEnPrepago.orden_pago?.checkout_url && (
              <a
                href={pedidoEnPrepago.orden_pago.checkout_url}
                target="_blank"
                rel="noreferrer"
                className="w-full mb-3 bg-ocean-600 hover:bg-ocean-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-md"
              >
                Abrir Pasarela de Pago
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            {/* Botón discreto de modo demo para pruebas */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={simularPagoPrepagoExitoso}
                disabled={simulandoPago}
                className="w-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {simulandoPago ? 'Confirmando...' : '⚡ Simular Pago Exitoso (Modo Demo)'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setMostrarModalPrepago(false)}
              className="mt-3 text-xs text-slate-400 hover:text-slate-600 font-medium"
            >
              Cerrar y volver a la carta
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL DE PAGO CON MERCADO PAGO ================= */}
      {mostrarModalPago && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-extrabold text-slate-800 text-base">Pagar con Mercado Pago</h3>
              <button
                onClick={() => { setMostrarModalPago(false); setOrdenCreadaMP(null); }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modalidad de pago: Completo o Dividir */}
            <div className="flex bg-slate-100 p-1 rounded-xl mb-3">
              <button
                type="button"
                onClick={() => setModoPago('completo')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                  modoPago === 'completo' ? 'bg-white text-ocean-800 shadow-sm' : 'text-slate-500'
                }`}
              >
                Cuenta completa
              </button>
              <button
                type="button"
                onClick={() => setModoPago('dividir')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                  modoPago === 'dividir' ? 'bg-white text-ocean-800 shadow-sm' : 'text-slate-500'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Dividir cuenta
              </button>
            </div>

            {modoPago === 'dividir' && (
              <div className="bg-ocean-50 border border-ocean-200 rounded-xl p-3 mb-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-ocean-900">¿Entre cuántos dividen?</span>
                  <span className="text-xs font-extrabold text-ocean-700">{personasDivision} personas</span>
                </div>
                <div className="flex gap-1.5 justify-between">
                  {[2, 3, 4, 5, 6, 7, 8].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPersonasDivision(n)}
                      className={`flex-1 py-1 rounded-lg text-xs font-bold transition ${
                        personasDivision === n
                          ? 'bg-ocean-600 text-white'
                          : 'bg-white text-slate-700 border border-slate-200'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-ocean-700 mt-2 text-center font-medium">
                  Cada persona paga: S/ {((cuenta?.saldo_pendiente || 0) / personasDivision).toFixed(2)}
                </p>
              </div>
            )}

            {/* Resumen de monto */}
            <div className="bg-slate-50 rounded-xl p-3 text-center mb-4 border border-slate-100">
              <span className="text-xs text-slate-500">
                {modoPago === 'dividir' ? `Tu parte (${personasDivision} personas)` : 'Monto total a pagar'}
              </span>
              <p className="text-2xl font-black text-slate-900">
                S/ {(
                  (modoPago === 'dividir'
                    ? (cuenta?.saldo_pendiente || 0) / personasDivision
                    : (cuenta?.saldo_pendiente || 0)) + (Number(propina) || 0)
                ).toFixed(2)}
              </p>
              {Number(propina) > 0 && (
                <span className="text-xs text-slate-400">
                  Incluye propina de S/ {Number(propina).toFixed(2)}
                </span>
              )}
            </div>

            {/* ── MODO DEMO: ya se creó la orden, mostrar botón Simular ── */}
            {ordenCreadaMP?.modo_demo ? (
              <div className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 text-center">
                  <span className="font-bold block mb-1">🧪 Modo Demo Activo</span>
                  Mercado Pago no está configurado con credenciales reales.
                  Puedes simular un pago aprobado para continuar.
                </div>
                <button
                  onClick={simularPagoAprobadoDemo}
                  disabled={procesandoPago}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {procesandoPago ? 'Procesando...' : 'Simular Pago Aprobado (Demo)'}
                </button>
                <button
                  onClick={() => setOrdenCreadaMP(null)}
                  className="w-full bg-slate-100 text-slate-600 font-bold py-2 rounded-xl text-xs hover:bg-slate-200 transition"
                >
                  ← Cambiar método de pago
                </button>
              </div>
            ) : (
              <>
                {/* Selector de método de pago */}
                <label className="text-xs font-bold text-slate-700 block mb-2">
                  Selecciona método de pago:
                </label>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { id: 'YAPE', label: '💜 Yape' },
                    { id: 'PLIN', label: '💙 Plin' },
                    { id: 'TARJETA_ONLINE', label: '💳 Tarjeta' },
                  ].map(m => (
                    <button
                      key={m.id}
                      onClick={() => setMetodoPago(m.id)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition ${
                        metodoPago === m.id
                          ? 'border-ocean-600 bg-ocean-50 text-ocean-800'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* Badge seguridad Mercado Pago */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 mb-4 flex items-center gap-2 text-xs text-slate-600">
                  <ShieldCheck className="w-4 h-4 text-ocean-600 flex-shrink-0" />
                  <span>
                    Pago procesado de forma segura por{' '}
                    <strong>Mercado Pago Perú</strong>
                  </span>
                </div>

                {/* Propina voluntaria */}
                <div className="mb-4">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Propina voluntaria (S/)
                  </label>
                  <div className="flex gap-2">
                    {[0, 3, 5, 10].map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPropina(p)}
                        className={`flex-1 py-1 rounded-lg text-xs font-semibold border ${
                          propina === p
                            ? 'bg-ocean-100 border-ocean-500 text-ocean-800 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        {p === 0 ? 'Sin propina' : `S/ ${p}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Botón principal: genera orden en MP y redirige */}
                <button
                  onClick={ejecutarPago}
                  disabled={procesandoPago}
                  className="w-full bg-ocean-600 hover:bg-ocean-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  {procesandoPago
                    ? 'Generando Orden...'
                    : `Pagar S/ ${(
                        (modoPago === 'dividir'
                          ? (cuenta?.saldo_pendiente || 0) / personasDivision
                          : (cuenta?.saldo_pendiente || 0)) + (Number(propina) || 0)
                      ).toFixed(2)} con Mercado Pago`}
                </button>

                {/* Opción POS Físico */}
                <button
                  onClick={() => {
                    setMetodoPago('POS_FISICO');
                    // ejecutarPago usa la ref actualizada via callback
                    setTimeout(ejecutarPago, 50);
                  }}
                  disabled={procesandoPago}
                  className="w-full mt-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-xs transition"
                >
                  📟 Pagar en Caja / POS Mozo
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL FILTRO RESEÑAS ================= */}
      {mostrarModalResena && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl text-center">
            {!resultadoResena ? (
              <>
                <h3 className="font-extrabold text-slate-800 text-lg mb-1">¿Cómo estuvo tu experiencia?</h3>
                <p className="text-xs text-slate-500 mb-4">Tu opinión nos ayuda a mantener el toque fresco de Sin Espinas</p>

                <div className="flex justify-center gap-2 mb-4">
                  {[1, 2, 3, 4, 5].map(estrella => (
                    <button
                      key={estrella}
                      onClick={() => setCalificacion(estrella)}
                      className="p-1 transition transform hover:scale-110"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          estrella <= calificacion ? 'text-amber-400 fill-amber-400' : 'text-slate-200'
                        }`}
                      />
                    </button>
                  ))}
                </div>

                <textarea
                  value={comentarioResena}
                  onChange={e => setComentarioResena(e.target.value)}
                  placeholder="Déjanos un comentario sobre el ceviche o la atención..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:ring-1 focus:ring-ocean-500 focus:outline-none mb-4 h-20"
                />

                <div className="flex gap-2">
                  <button
                    onClick={() => setMostrarModalResena(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold py-2.5 rounded-xl"
                  >
                    Omitir
                  </button>
                  <button
                    onClick={enviarCalificacion}
                    className="flex-1 bg-ocean-600 hover:bg-ocean-700 text-white text-xs font-semibold py-2.5 rounded-xl"
                  >
                    Enviar Opinión
                  </button>
                </div>
              </>
            ) : (
              <div>
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h4 className="font-extrabold text-slate-800 text-base mb-1">¡Muchas Gracias!</h4>
                <p className="text-xs text-slate-600 mb-4">
                  {resultadoResena.redirigirGoogle
                    ? '¡Qué alegría que te haya encantado! Te estamos redirigiendo a Google Reviews para que compartas tu experiencia.'
                    : resultadoResena.mensaje}
                </p>
                {resultadoResena.redirigirGoogle && (
                  <a
                    href={resultadoResena.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-ocean-600 font-bold hover:underline mb-4"
                  >
                    Abrir Google Reviews <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  onClick={() => {
                    setMostrarModalResena(false);
                    setResultadoResena(null);
                  }}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 rounded-xl"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


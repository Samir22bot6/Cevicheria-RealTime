import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, socket } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast, ToastContainer } from '../components/Toast';
import { ChefHat, Clock, CheckCircle, Flame, ArrowLeft, RefreshCw, LogOut } from 'lucide-react';

export default function CocinaKdsView() {
  const [estacion, setEstacion] = useState('TODAS');
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const { usuario, cerrarSesion } = useAuth();
  const navigate = useNavigate();
  const { showToast, toasts, dismissToast } = useToast();

  const cargarKds = async (est = estacion) => {
    try {
      setCargando(true);
      const res = await api.obtenerKds(est);
      if (res.ok && res.data) {
        setItems(res.data);
      }
    } catch (e) {
      console.error('Error cargando KDS:', e);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarKds(estacion);
  }, [estacion]);

  // Escuchar eventos en vivo desde WebSockets
  useEffect(() => {
    socket.emit('unirse_cocina', estacion);

    socket.on('nuevo_pedido_item', (nuevoItem) => {
      setItems(prev => {
        // Evitar duplicados
        if (prev.some(it => it.id_detalle === nuevoItem.id_detalle)) return prev;
        if (estacion === 'TODAS' || nuevoItem.estacion === estacion) {
          return [...prev, nuevoItem];
        }
        return prev;
      });
    });

    socket.on('kds_item_actualizado', ({ id_detalle, estado_estacion }) => {
      setItems(prev => {
        if (estado_estacion === 'ENTREGADO' || estado_estacion === 'CANCELADO') {
          return prev.filter(it => it.id_detalle !== id_detalle);
        }
        return prev.map(it => it.id_detalle === id_detalle ? { ...it, estado_estacion } : it);
      });
    });

    return () => {
      socket.off('nuevo_pedido_item');
      socket.off('kds_item_actualizado');
    };
  }, [estacion]);

  // Avanzar estado de preparación
  const cambiarEstado = async (id_detalle, estadoActual) => {
    let siguienteEstado = 'PREPARANDO';
    if (estadoActual === 'PENDIENTE') siguienteEstado = 'PREPARANDO';
    else if (estadoActual === 'PREPARANDO') siguienteEstado = 'LISTO';
    else if (estadoActual === 'LISTO') siguienteEstado = 'ENTREGADO';

    try {
      const res = await api.actualizarEstadoKds(id_detalle, siguienteEstado);
      if (res.ok) {
        setItems(prev => {
          if (siguienteEstado === 'ENTREGADO') {
            return prev.filter(it => it.id_detalle !== id_detalle);
          }
          return prev.map(it => it.id_detalle === id_detalle ? { ...it, estado_estacion: siguienteEstado } : it);
        });
      }
    } catch (e) {
      showToast('error', 'Error al actualizar', 'No se pudo actualizar el estado del plato.');
    }
  };

  const getSemaforoColor = (minutos) => {
    if (minutos < 10) return 'border-emerald-500 bg-emerald-50/30 text-emerald-700';
    if (minutos <= 15) return 'border-amber-500 bg-amber-50/40 text-amber-700';
    return 'border-rose-500 bg-rose-50/50 text-rose-700 animate-pulse';
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {/* Barra Superior KDS */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <img
            src="/logo.jpg"
            alt="Sin Espinas"
            className="w-10 h-10 rounded-xl object-cover border border-ocean-500/40 shadow-sm"
          />
          <div>
            <h1 className="text-lg font-black tracking-wide leading-none uppercase">
              SIN ESPINAS — KDS COCINA
            </h1>
            <span className="text-[10px] text-ocean-300 font-bold uppercase tracking-wider">
              Control de Comandas por Estación
            </span>
          </div>
        </div>

        {/* Selector de Estación */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-700 text-xs font-bold">
          {[
            { id: 'TODAS', label: 'Todas las Estaciones' },
            { id: 'BARRA_FRIA', label: '🐟 Barra Fría' },
            { id: 'COCINA_CALIENTE', label: '🔥 Cocina Caliente' },
            { id: 'BAR_BEBIDAS', label: '🍹 Bar Bebidas' }
          ].map(e => (
            <button
              key={e.id}
              onClick={() => setEstacion(e.id)}
              className={`px-3 py-1.5 rounded-lg transition ${
                estacion === e.id
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => cargarKds()}
            className="flex items-center gap-1.5 text-xs bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refrescar
          </button>
          <button
            onClick={() => {
              cerrarSesion();
              navigate('/login');
            }}
            className="flex items-center gap-1 text-xs bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-rose-300 px-3 py-2 rounded-lg font-semibold transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Salir
          </button>
        </div>
      </header>

      {/* Grid de Comandas */}
      <main className="flex-1 p-6">
        {cargando ? (
          <div className="text-center py-20 text-slate-400">Cargando comandas activas...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-24 text-slate-500">
            <CheckCircle className="w-16 h-16 mx-auto mb-3 text-emerald-500/40" />
            <h3 className="text-lg font-bold text-slate-300">¡Cocina al día!</h3>
            <p className="text-sm">No hay platos pendientes en esta estación.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map(item => {
              const semaforoClass = getSemaforoColor(item.minutos_espera || 0);

              return (
                <div
                  key={item.id_detalle}
                  className={`bg-slate-800 rounded-2xl border-2 p-4 flex flex-col justify-between shadow-lg transition ${semaforoClass}`}
                >
                  <div>
                    {/* Header Tarjeta */}
                    <div className="flex justify-between items-start mb-2 border-b border-slate-700 pb-2">
                      <div>
                        <span className="text-2xl font-black text-white">Mesa {item.numero_mesa}</span>
                        <p className="text-[11px] font-mono text-slate-400">{item.numero_ticket}</p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-xs font-bold">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{item.minutos_espera || 0} min</span>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          {item.estacion}
                        </span>
                      </div>
                    </div>

                    {/* Detalle del Plato */}
                    <div className="my-3">
                      <div className="flex items-start gap-2">
                        <span className="text-xl font-black text-amber-400">{item.cantidad}x</span>
                        <div>
                          <h4 className="text-base font-bold text-white leading-tight">{item.plato}</h4>
                          <p className="text-xs text-amber-200 font-medium mt-1">
                            {item.personalizaciones}
                          </p>
                          {item.observaciones_item && (
                            <p className="text-xs text-rose-300 italic mt-1 bg-rose-950/40 p-1.5 rounded-md border border-rose-800/40">
                              ⚠️ {item.observaciones_item}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Botones de acción KDS */}
                  <div className="mt-4 pt-3 border-t border-slate-700 flex gap-2">
                    {item.estado_estacion === 'PENDIENTE' && (
                      <button
                        onClick={() => cambiarEstado(item.id_detalle, item.estado_estacion)}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <Flame className="w-4 h-4" />
                        Comenzar Preparación
                      </button>
                    )}

                    {item.estado_estacion === 'PREPARANDO' && (
                      <button
                        onClick={() => cambiarEstado(item.id_detalle, item.estado_estacion)}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Marcar Listo para Recoger
                      </button>
                    )}

                    {item.estado_estacion === 'LISTO' && (
                      <button
                        onClick={() => cambiarEstado(item.id_detalle, item.estado_estacion)}
                        className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        Despachar / Entregado
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}


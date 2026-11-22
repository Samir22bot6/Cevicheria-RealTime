import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, KeyRound, ChefHat, AlertCircle, QrCode } from 'lucide-react';

export default function LoginView() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const { iniciarSesion, estaAutenticado, usuario } = useAuth();
  const navigate = useNavigate();

  // Si ya es un comensal activo y no personal, redirigir a su mesa
  useEffect(() => {
    const qrTokenCliente = sessionStorage.getItem('cevicheria_cliente_qr');
    if (qrTokenCliente && !estaAutenticado) {
      navigate(`/mesa/${qrTokenCliente}`, { replace: true });
    } else if (estaAutenticado) {
      if (usuario?.rol === 'ADMIN' || usuario?.rol === 'MOZO' || usuario?.rol === 'CAJERO') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/cocina', { replace: true });
      }
    }
  }, [estaAutenticado, usuario, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      const res = await api.login(email, password);
      if (res.ok && res.data) {
        // Limpiar posible sesión de cliente anterior al identificarse como personal
        sessionStorage.removeItem('cevicheria_cliente_qr');
        iniciarSesion(res.data.token, res.data.usuario);

        if (res.data.usuario.rol === 'ADMIN' || res.data.usuario.rol === 'MOZO') {
          navigate('/admin');
        } else {
          navigate('/cocina');
        }
      } else {
        setError(res.error || 'Credenciales inválidas');
      }
    } catch (err) {
      setError('Error al conectar con el servidor');
    } finally {
      setCargando(false);
    }
  };

  const simularQrMesa7 = () => {
    const qrMesa7 = '77777777-7777-4777-8777-877777777777';
    sessionStorage.setItem('cevicheria_cliente_qr', qrMesa7);
    navigate(`/mesa/${qrMesa7}`);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Cabecera */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-ocean-500/10 text-ocean-400 border border-ocean-500/20 mb-3">
            <ChefHat className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Acceso de Personal</h1>
          <p className="text-xs text-slate-400 mt-1">
            Sistema Interno de Gestión y KDS - Cevichería Del Mar
          </p>
        </div>

        {/* Tarjeta Login */}
        <div className="bg-slate-800 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl">
          {error && (
            <div className="mb-4 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-xl p-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Correo Electrónico</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@cevicheria.com"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-ocean-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Contraseña</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-ocean-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="w-full bg-ocean-600 hover:bg-ocean-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs transition shadow-lg shadow-ocean-600/20 mt-2"
            >
              {cargando ? 'Iniciando Sesión...' : 'Entrar al Sistema'}
            </button>
          </form>

          {/* Accesos rápidos de desarrollo */}
          <div className="mt-6 pt-5 border-t border-slate-700/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 text-center">
              Credenciales de Prueba (RBAC)
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setEmail('admin@cevicheria.com');
                  setPassword('Admin123!');
                }}
                className="bg-slate-900 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl p-2 text-left"
              >
                <strong className="block text-ocean-400">Admin General</strong>
                admin@cevicheria.com
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('cocina@cevicheria.com');
                  setPassword('Cocina123!');
                }}
                className="bg-slate-900 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl p-2 text-left"
              >
                <strong className="block text-amber-400">Jefe de Cocina</strong>
                cocina@cevicheria.com
              </button>
            </div>
          </div>
        </div>

        {/* Acceso para Comensales / Simulación QR */}
        <div className="mt-6 text-center">
          <button
            onClick={simularQrMesa7}
            className="inline-flex items-center gap-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold px-4 py-2.5 rounded-full transition"
          >
            <QrCode className="w-3.5 h-3.5 text-ocean-400" />
            Simular Escaneo QR Mesa M-07 (Comensal)
          </button>
        </div>
      </div>
    </div>
  );
}


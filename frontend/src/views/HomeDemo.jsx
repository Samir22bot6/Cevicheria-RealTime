import React from 'react';
import { Link } from 'react-router-dom';
import { QrCode, ChefHat, Users, Sparkles, UtensilsCrossed, ArrowRight } from 'lucide-react';

export default function HomeDemo() {
  const qrMesa7 = '77777777-7777-4777-8777-877777777777';

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-4">
          <img
            src="/logo.jpg"
            alt="Sin Espinas"
            className="w-24 h-24 rounded-full object-cover shadow-xl border-2 border-ocean-300"
          />
        </div>
        <div className="inline-flex items-center gap-2 bg-ocean-100 text-ocean-800 px-4 py-1.5 rounded-full text-sm font-semibold mb-3 border border-ocean-200">
          <Sparkles className="w-4 h-4 text-ocean-600" />
          Plataforma Gastronómica en Tiempo Real
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
          Cevichería <span className="text-ocean-700">SIN ESPINAS</span>
        </h1>
        <p className="mt-3 text-lg text-slate-600 max-w-2xl mx-auto">
          Carta digital por QR con fricción cero, asistente IA de maridaje, pantallas de cocina KDS y cobros con Mercado Pago Perú.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Vista 1: Cliente QR */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition">
          <div>
            <div className="w-12 h-12 bg-ocean-50 text-ocean-600 rounded-xl flex items-center justify-center mb-4">
              <QrCode className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Carta Digital QR</h3>
            <p className="text-slate-500 text-sm mb-4">
              Simula el escaneo del código QR en la <strong>Mesa M-07</strong> (Terraza Marina).
            </p>
            <ul className="text-xs text-slate-600 space-y-1.5 mb-6">
              <li>✨ Apertura de sesión automática</li>
              <li>🌶️ Personalización (Ají, Pescado, Extras)</li>
              <li>🤖 Asistente IA (Gemini 2.5 Flash)</li>
              <li>💳 Pago en línea & filtro de reseñas</li>
            </ul>
          </div>
          <Link
            to={`/mesa/${qrMesa7}`}
            className="w-full inline-flex items-center justify-center gap-2 bg-ocean-600 hover:bg-ocean-700 text-white font-medium py-3 px-4 rounded-xl transition"
          >
            Abrir Mesa M-07 <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Vista 2: Cocina KDS */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition">
          <div>
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-4">
              <ChefHat className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Pantalla KDS Cocina</h3>
            <p className="text-slate-500 text-sm mb-4">
              Control de comanda en vivo filtrado por estaciones: Barra Fría, Caliente y Bar.
            </p>
            <ul className="text-xs text-slate-600 space-y-1.5 mb-6">
              <li>⏱️ Semáforo de tiempo de espera</li>
              <li>🍲 Separación por estación de cocina</li>
              <li>⚡ Botones un toque: Preparar & Listo</li>
              <li>🔔 Sincronización WebSockets en vivo</li>
            </ul>
          </div>
          <Link
            to="/cocina"
            className="w-full inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-medium py-3 px-4 rounded-xl transition"
          >
            Abrir KDS Cocina <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Vista 3: Mozos y Administrador */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition">
          <div>
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Panel Mozos & Caja</h3>
            <p className="text-slate-500 text-sm mb-4">
              Mapa general de mesas, alertas de platos listos para recoger y registro de cobros.
            </p>
            <ul className="text-xs text-slate-600 space-y-1.5 mb-6">
              <li>📍 Estado de mesas (Libre / Ocupada)</li>
              <li>🔔 Alerta sonora y visual de platos listos</li>
              <li>💵 Confirmación de pagos (POS / Efectivo)</li>
              <li>👥 Liberación de mesas en tiempo real</li>
            </ul>
          </div>
          <Link
            to="/admin"
            className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-4 rounded-xl transition"
          >
            Abrir Panel Mozos <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="mt-12 bg-slate-100 rounded-xl p-4 text-center text-xs text-slate-500">
        💡 <strong>Tip de prueba Full-Stack:</strong> Puedes abrir la Mesa M-07 en una ventana y la Cocina KDS en otra para observar el despacho de pedidos y cambios de estado en tiempo real vía WebSockets.
      </div>
    </div>
  );
}


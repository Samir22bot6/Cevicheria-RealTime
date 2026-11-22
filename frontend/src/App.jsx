import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import RutaProtegida from './components/RutaProtegida';
import HomeRedirect from './views/HomeRedirect';
import LoginView from './views/LoginView';
import ClienteView from './views/ClienteView';
import CocinaKdsView from './views/CocinaKdsView';
import MozosAdminView from './views/MozosAdminView';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-50 text-slate-800">
          <Routes>
            {/* Raíz aislada según estado de sesión */}
            <Route path="/" element={<HomeRedirect />} />

            {/* Login para personal */}
            <Route path="/login" element={<LoginView />} />

            {/* Carta Digital para clientes (guarda su QR en sessionStorage) */}
            <Route path="/mesa/:qrToken" element={<ClienteView />} />

            {/* Pantalla KDS Cocina (Personal Cocina y Admin) */}
            <Route
              path="/cocina"
              element={
                <RutaProtegida rolesPermitidos={['ADMIN', 'COCINA_FRIA', 'COCINA_CALIENTE']}>
                  <CocinaKdsView />
                </RutaProtegida>
              }
            />

            {/* Panel de Control y Administración (Admin y Mozos) */}
            <Route
              path="/admin"
              element={
                <RutaProtegida rolesPermitidos={['ADMIN', 'MOZO', 'CAJERO']}>
                  <MozosAdminView />
                </RutaProtegida>
              }
            />

            {/* Redirección por defecto */}
            <Route path="*" element={<HomeRedirect />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

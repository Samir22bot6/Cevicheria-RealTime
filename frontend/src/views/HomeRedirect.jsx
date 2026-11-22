import React, { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function HomeRedirect() {
  const { estaAutenticado, usuario } = useAuth();
  const qrTokenCliente = sessionStorage.getItem('cevicheria_cliente_qr');

  // 1. Si es comensal activo
  if (qrTokenCliente && !estaAutenticado) {
    return <Navigate to={`/mesa/${qrTokenCliente}`} replace />;
  }

  // 2. Si es personal autenticado
  if (estaAutenticado) {
    if (usuario?.rol === 'ADMIN' || usuario?.rol === 'MOZO' || usuario?.rol === 'CAJERO') {
      return <Navigate to="/admin" replace />;
    }
    return <Navigate to="/cocina" replace />;
  }

  // 3. Visitante sin sesión
  return <Navigate to="/login" replace />;
}


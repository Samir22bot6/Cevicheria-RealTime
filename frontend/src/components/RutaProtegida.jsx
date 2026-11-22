import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RutaProtegida({ rolesPermitidos, children }) {
  const { usuario, estaAutenticado } = useAuth();
  const qrTokenCliente = sessionStorage.getItem('cevicheria_cliente_qr');

  // Si no está autenticado como personal
  if (!estaAutenticado) {
    // Si es un comensal activo, aislarlo forzosamente en su mesa
    if (qrTokenCliente) {
      return <Navigate to={`/mesa/${qrTokenCliente}`} replace />;
    }
    return <Navigate to="/login" replace />;
  }

  // Si está autenticado pero su rol no tiene permiso
  if (rolesPermitidos && !rolesPermitidos.includes(usuario?.rol)) {
    // Si cocina intenta entrar a admin, mandarlo a /cocina
    if (usuario?.rol?.startsWith('COCINA')) {
      return <Navigate to="/cocina" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return children;
}


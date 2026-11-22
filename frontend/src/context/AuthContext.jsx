import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('cevicheria_token'));
  const [usuario, setUsuario] = useState(() => {
    const u = localStorage.getItem('cevicheria_usuario');
    return u ? JSON.parse(u) : null;
  });

  const iniciarSesion = (tokenNuevo, datosUsuario) => {
    localStorage.setItem('cevicheria_token', tokenNuevo);
    localStorage.setItem('cevicheria_usuario', JSON.stringify(datosUsuario));
    setToken(tokenNuevo);
    setUsuario(datosUsuario);
  };

  const cerrarSesion = () => {
    localStorage.removeItem('cevicheria_token');
    localStorage.removeItem('cevicheria_usuario');
    setToken(null);
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ token, usuario, iniciarSesion, cerrarSesion, estaAutenticado: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);


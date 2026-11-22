import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabase.js';
import { mockDb } from './mockStore.js';

export const AuthService = {
  async seedUsuariosIniciales() {
    const passwordAdminHash = await bcrypt.hash('Admin123!', 10);
    const passwordCocinaHash = await bcrypt.hash('Cocina123!', 10);

    // 1. En Supabase si está disponible
    if (supabase) {
      try {
        const { count, error } = await supabase
          .from('usuarios')
          .select('*', { count: 'exact', head: true });

        if (!error && (count === 0 || count === null)) {
          console.log('🌱 Inicializando usuarios de prueba en Supabase...');
          await supabase.from('usuarios').insert([
            {
              nombres: 'Administrador',
              apellidos: 'Principal',
              email: 'admin@cevicheria.com',
              password_hash: passwordAdminHash,
              rol: 'ADMIN',
              activo: true
            },
            {
              nombres: 'Chef',
              apellidos: 'Barra Fría',
              email: 'cocina@cevicheria.com',
              password_hash: passwordCocinaHash,
              rol: 'COCINA_FRIA',
              activo: true
            }
          ]);
          console.log('✅ Usuarios seed creados en Supabase.');
        }
      } catch (e) {
        console.warn('⚠️ No se pudo verificar seed en Supabase:', e.message);
      }
    }

    // 2. En mockDb siempre garantizamos los usuarios
    if (!mockDb.usuarios || mockDb.usuarios.length === 0) {
      mockDb.usuarios = [
        {
          id_usuario: 1,
          nombres: 'Administrador',
          apellidos: 'Principal',
          email: 'admin@cevicheria.com',
          password_hash: passwordAdminHash,
          rol: 'ADMIN',
          activo: true,
          creado_en: new Date().toISOString()
        },
        {
          id_usuario: 2,
          nombres: 'Chef',
          apellidos: 'Barra Fría',
          email: 'cocina@cevicheria.com',
          password_hash: passwordCocinaHash,
          rol: 'COCINA_FRIA',
          activo: true,
          creado_en: new Date().toISOString()
        }
      ];
      console.log('✅ Usuarios de prueba activos en mock store (admin@cevicheria.com y cocina@cevicheria.com)');
    }
  },

  async buscarUsuarioPorEmail(email) {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .select('*')
          .eq('email', email.trim().toLowerCase())
          .eq('activo', true)
          .single();

        if (!error && data) return data;
      } catch (e) {
        console.warn('Fallo Supabase en buscarUsuarioPorEmail:', e.message);
      }
    }

    return (mockDb.usuarios || []).find(
      u => u.email.toLowerCase() === email.trim().toLowerCase() && u.activo
    );
  }
};


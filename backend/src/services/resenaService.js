import { supabase } from '../config/supabase.js';
import { mockDb } from './mockStore.js';

export const ResenaService = {
  async registrarResena({ id_sesion, calificacion, comentario }) {
    const numCalificacion = Number(calificacion);
    if (!id_sesion) throw new Error('id_sesion es requerido');
    if (isNaN(numCalificacion) || numCalificacion < 1 || numCalificacion > 5) {
      throw new Error('La calificación debe estar entre 1 y 5');
    }

    const redirigidoGoogle = numCalificacion >= 4;
    const urlGoogle = 'https://g.page/r/tu-cevicheria/review';

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('resenas_experiencia')
          .insert([
            {
              id_sesion,
              calificacion: numCalificacion,
              comentario: comentario || null,
              redirigido_google: redirigidoGoogle
            }
          ])
          .select()
          .single();

        if (!error && data) {
          return redirigidoGoogle
            ? { redirigirGoogle: true, url: urlGoogle, resena: data }
            : { redirigirGoogle: false, mensaje: 'Gracias por ayudarnos a mejorar', resena: data };
        }
      } catch (err) {
        console.warn('Fallo Supabase en registrarResena, usando mock store:', err.message);
      }
    }

    // Mock Store Fallback
    const resena = {
      id_resena: mockDb.resenas_experiencia.length + 1,
      id_sesion,
      calificacion: numCalificacion,
      comentario: comentario || null,
      redirigido_google: redirigidoGoogle,
      creado_en: new Date().toISOString()
    };
    mockDb.resenas_experiencia.push(resena);

    return redirigidoGoogle
      ? { redirigirGoogle: true, url: urlGoogle, resena }
      : { redirigirGoogle: false, mensaje: 'Gracias por ayudarnos a mejorar', resena };
  }
};


import { supabase } from '../config/supabase.js';
import { mockDb } from './mockStore.js';

export const CartaService = {
  async obtenerCarta() {
    if (supabase) {
      try {
        // Consultar categorías activas con platos disponibles
        const { data: categorias, error: catErr } = await supabase
          .from('categorias_carta')
          .select(`
            id_categoria,
            nombre,
            descripcion,
            orden_visualizacion,
            activa,
            platos (
              id_plato,
              id_estacion,
              nombre,
              descripcion,
              precio_base,
              tiempo_prep_estimado_min,
              imagen_url,
              disponible,
              es_recomendado_ia,
              estaciones_cocina (
                id_estacion,
                nombre
              ),
              plato_grupos_opciones (
                grupos_opciones (
                  id_grupo_opcion,
                  nombre,
                  es_obligatorio,
                  seleccion_multiple,
                  opciones_personalizacion (
                    id_opcion,
                    nombre,
                    precio_adicional,
                    disponible
                  )
                )
              )
            )
          `)
          .eq('activa', true)
          .eq('platos.disponible', true)
          .order('orden_visualizacion', { ascending: true });

        if (!catErr && categorias && categorias.length > 0) {
          // Normalizar formato de salida
          return categorias.map(cat => ({
            ...cat,
            platos: (cat.platos || []).map(p => ({
              ...p,
              estacion_nombre: p.estaciones_cocina?.nombre,
              grupos_opciones: (p.plato_grupos_opciones || []).map(pgo => pgo.grupos_opciones)
            }))
          }));
        }
      } catch (err) {
        console.warn('Fallo Supabase en obtenerCarta, usando mock store:', err.message);
      }
    }

    // Mock Store Fallback
    const categorias = mockDb.categorias_carta
      .filter(c => c.activa)
      .sort((a, b) => a.orden_visualizacion - b.orden_visualizacion)
      .map(cat => {
        const platosCat = mockDb.platos
          .filter(p => p.id_categoria === cat.id_categoria && p.disponible)
          .map(plato => {
            const estacion = mockDb.estaciones_cocina.find(e => e.id_estacion === plato.id_estacion);
            const gruposIds = mockDb.plato_grupos_opciones
              .filter(pgo => pgo.id_plato === plato.id_plato)
              .map(pgo => pgo.id_grupo_opcion);

            const grupos = mockDb.grupos_opciones
              .filter(g => gruposIds.includes(g.id_grupo_opcion))
              .map(g => ({
                ...g,
                opciones: mockDb.opciones_personalizacion.filter(op => op.id_grupo_opcion === g.id_grupo_opcion && op.disponible)
              }));

            return {
              ...plato,
              estacion_nombre: estacion ? estacion.nombre : 'BARRA_FRIA',
              grupos_opciones: grupos
            };
          });

        return {
          ...cat,
          platos: platosCat
        };
      });

    return categorias;
  }
};


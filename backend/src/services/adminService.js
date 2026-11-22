import crypto from 'crypto';
import { supabase } from '../config/supabase.js';
import { mockDb } from './mockStore.js';
import { getIO } from '../sockets/socketHandler.js';

export const AdminService = {
  // ==========================================
  // 1. GESTIÓN DE CATEGORÍAS (categorias_carta)
  // ==========================================
  async listarCategorias() {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('categorias_carta')
          .select('*, platos(count)')
          .order('orden_visualizacion', { ascending: true });
        if (!error && data) {
          return data.map(c => ({
            ...c,
            total_platos: c.platos?.[0]?.count || 0
          }));
        }
      } catch (e) {
        console.warn('Fallo Supabase en listarCategorias:', e.message);
      }
    }

    return [...mockDb.categorias_carta]
      .sort((a, b) => a.orden_visualizacion - b.orden_visualizacion)
      .map(c => ({
        ...c,
        total_platos: mockDb.platos.filter(p => p.id_categoria === c.id_categoria).length
      }));
  },

  async crearCategoria({ nombre, descripcion, orden_visualizacion = 0, activa = true }) {
    if (!nombre) throw new Error('El nombre de la categoría es requerido');

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('categorias_carta')
          .insert([{ nombre, descripcion, orden_visualizacion, activa }])
          .select()
          .single();
        if (!error && data) return data;
        if (error) throw error;
      } catch (e) {
        console.warn('Fallo Supabase en crearCategoria:', e.message);
      }
    }

    const nuevaCat = {
      id_categoria: mockDb.categorias_carta.length > 0 ? Math.max(...mockDb.categorias_carta.map(c => c.id_categoria)) + 1 : 1,
      nombre,
      descripcion: descripcion || '',
      orden_visualizacion: Number(orden_visualizacion) || 0,
      activa: activa !== false
    };
    mockDb.categorias_carta.push(nuevaCat);
    return nuevaCat;
  },

  async actualizarCategoria(id_categoria, { nombre, descripcion, orden_visualizacion, activa }) {
    const id = Number(id_categoria);

    if (supabase) {
      try {
        const updateData = {};
        if (nombre !== undefined) updateData.nombre = nombre;
        if (descripcion !== undefined) updateData.descripcion = descripcion;
        if (orden_visualizacion !== undefined) updateData.orden_visualizacion = Number(orden_visualizacion);
        if (activa !== undefined) updateData.activa = activa;

        const { data, error } = await supabase
          .from('categorias_carta')
          .update(updateData)
          .eq('id_categoria', id)
          .select()
          .single();

        if (!error && data) return data;
        if (error) throw error;
      } catch (e) {
        console.warn('Fallo Supabase en actualizarCategoria:', e.message);
      }
    }

    const cat = mockDb.categorias_carta.find(c => c.id_categoria === id);
    if (!cat) throw new Error('Categoría no encontrada');

    if (nombre !== undefined) cat.nombre = nombre;
    if (descripcion !== undefined) cat.descripcion = descripcion;
    if (orden_visualizacion !== undefined) cat.orden_visualizacion = Number(orden_visualizacion);
    if (activa !== undefined) cat.activa = activa;

    return cat;
  },

  async eliminarCategoria(id_categoria) {
    const id = Number(id_categoria);

    if (supabase) {
      try {
        // Verificar si tiene platos antes
        const { count } = await supabase
          .from('platos')
          .select('*', { count: 'exact', head: true })
          .eq('id_categoria', id);

        if (count > 0) {
          const err = new Error('No se puede eliminar la sección porque contiene platos asociados. Reasigna o elimina los platos primero.');
          err.statusCode = 409;
          throw err;
        }

        const { error } = await supabase
          .from('categorias_carta')
          .delete()
          .eq('id_categoria', id);

        if (error) {
          if (error.code === '23503') {
            const fkErr = new Error('No se puede eliminar la sección porque contiene platos asociados. Reasigna o elimina los platos primero.');
            fkErr.statusCode = 409;
            throw fkErr;
          }
          throw error;
        }
        return { eliminada: true, id_categoria: id };
      } catch (e) {
        if (e.statusCode === 409) throw e;
        console.warn('Fallo Supabase en eliminarCategoria:', e.message);
      }
    }

    const platosAsociados = mockDb.platos.filter(p => p.id_categoria === id);
    if (platosAsociados.length > 0) {
      const err = new Error('No se puede eliminar la sección porque contiene platos asociados. Reasigna o elimina los platos primero.');
      err.statusCode = 409;
      throw err;
    }

    const index = mockDb.categorias_carta.findIndex(c => c.id_categoria === id);
    if (index === -1) throw new Error('Categoría no encontrada');

    mockDb.categorias_carta.splice(index, 1);
    return { eliminada: true, id_categoria: id };
  },

  // ==========================================
  // 2. GESTIÓN DE PLATOS (platos + plato_grupos_opciones)
  // ==========================================
  async listarPlatos() {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('platos')
          .select(`
            *,
            categorias_carta(nombre),
            estaciones_cocina(nombre),
            plato_grupos_opciones(
              grupos_opciones(id_grupo_opcion, nombre)
            )
          `)
          .order('id_plato', { ascending: true });

        if (!error && data) {
          return data.map(p => ({
            ...p,
            categoria_nombre: p.categorias_carta?.nombre,
            estacion_nombre: p.estaciones_cocina?.nombre,
            grupos_opciones: (p.plato_grupos_opciones || []).map(pgo => pgo.grupos_opciones).filter(Boolean)
          }));
        }
      } catch (e) {
        console.warn('Fallo Supabase en listarPlatos:', e.message);
      }
    }

    return mockDb.platos.map(plato => {
      const cat = mockDb.categorias_carta.find(c => c.id_categoria === plato.id_categoria);
      const est = mockDb.estaciones_cocina.find(e => e.id_estacion === plato.id_estacion);
      const gruposIds = mockDb.plato_grupos_opciones
        .filter(pgo => pgo.id_plato === plato.id_plato)
        .map(pgo => pgo.id_grupo_opcion);

      const grupos = mockDb.grupos_opciones.filter(g => gruposIds.includes(g.id_grupo_opcion));

      return {
        ...plato,
        categoria_nombre: cat ? cat.nombre : '',
        estacion_nombre: est ? est.nombre : '',
        grupos_opciones: grupos
      };
    });
  },

  async crearPlato(datos) {
    const {
      id_categoria,
      id_estacion,
      nombre,
      descripcion,
      precio_base,
      tiempo_prep_estimado_min = 10,
      imagen_url,
      modelo_3d_url,
      disponible = true,
      es_recomendado_ia = false,
      grupos_opciones_ids = []
    } = datos;

    if (!id_categoria || !id_estacion || !nombre || precio_base === undefined) {
      throw new Error('Faltan campos obligatorios para registrar el plato');
    }

    if (supabase) {
      try {
        const { data: plato, error } = await supabase
          .from('platos')
          .insert([
            {
              id_categoria: Number(id_categoria),
              id_estacion: Number(id_estacion),
              nombre,
              descripcion,
              precio_base: Number(precio_base),
              tiempo_prep_estimado_min: Number(tiempo_prep_estimado_min),
              imagen_url: imagen_url || null,
              modelo_3d_url: modelo_3d_url || null,
              disponible,
              es_recomendado_ia
            }
          ])
          .select()
          .single();

        if (error) throw error;

        if (grupos_opciones_ids && grupos_opciones_ids.length > 0) {
          const vinculos = grupos_opciones_ids.map(id_grupo => ({
            id_plato: plato.id_plato,
            id_grupo_opcion: Number(id_grupo)
          }));
          await supabase.from('plato_grupos_opciones').insert(vinculos);
        }

        return plato;
      } catch (e) {
        console.warn('Fallo Supabase en crearPlato:', e.message);
      }
    }

    const nuevoPlato = {
      id_plato: mockDb.platos.length > 0 ? Math.max(...mockDb.platos.map(p => p.id_plato)) + 1 : 1,
      id_categoria: Number(id_categoria),
      id_estacion: Number(id_estacion),
      nombre,
      descripcion: descripcion || '',
      precio_base: Number(precio_base),
      tiempo_prep_estimado_min: Number(tiempo_prep_estimado_min) || 10,
      imagen_url: imagen_url || 'https://images.unsplash.com/photo-1535399831218-d5bd36d1a6b3?w=500',
      modelo_3d_url: modelo_3d_url || null,
      disponible: disponible !== false,
      es_recomendado_ia: Boolean(es_recomendado_ia),
      creado_en: new Date().toISOString()
    };
    mockDb.platos.push(nuevoPlato);

    if (grupos_opciones_ids && grupos_opciones_ids.length > 0) {
      grupos_opciones_ids.forEach(id_grupo => {
        mockDb.plato_grupos_opciones.push({
          id_plato: nuevoPlato.id_plato,
          id_grupo_opcion: Number(id_grupo)
        });
      });
    }

    return nuevoPlato;
  },

  async actualizarPlato(id_plato, datos) {
    const id = Number(id_plato);
    const {
      id_categoria,
      id_estacion,
      nombre,
      descripcion,
      precio_base,
      tiempo_prep_estimado_min,
      imagen_url,
      modelo_3d_url,
      disponible,
      es_recomendado_ia,
      grupos_opciones_ids
    } = datos;

    if (supabase) {
      try {
        const updateData = {};
        if (id_categoria !== undefined) updateData.id_categoria = Number(id_categoria);
        if (id_estacion !== undefined) updateData.id_estacion = Number(id_estacion);
        if (nombre !== undefined) updateData.nombre = nombre;
        if (descripcion !== undefined) updateData.descripcion = descripcion;
        if (precio_base !== undefined) updateData.precio_base = Number(precio_base);
        if (tiempo_prep_estimado_min !== undefined) updateData.tiempo_prep_estimado_min = Number(tiempo_prep_estimado_min);
        if (imagen_url !== undefined) updateData.imagen_url = imagen_url;
        if (modelo_3d_url !== undefined) updateData.modelo_3d_url = modelo_3d_url;
        if (disponible !== undefined) updateData.disponible = disponible;
        if (es_recomendado_ia !== undefined) updateData.es_recomendado_ia = es_recomendado_ia;

        const { data: plato, error } = await supabase
          .from('platos')
          .update(updateData)
          .eq('id_plato', id)
          .select()
          .single();

        if (error) throw error;

        if (Array.isArray(grupos_opciones_ids)) {
          await supabase.from('plato_grupos_opciones').delete().eq('id_plato', id);
          if (grupos_opciones_ids.length > 0) {
            const vinculos = grupos_opciones_ids.map(id_grupo => ({
              id_plato: id,
              id_grupo_opcion: Number(id_grupo)
            }));
            await supabase.from('plato_grupos_opciones').insert(vinculos);
          }
        }

        return plato;
      } catch (e) {
        console.warn('Fallo Supabase en actualizarPlato:', e.message);
      }
    }

    const plato = mockDb.platos.find(p => p.id_plato === id);
    if (!plato) throw new Error('Plato no encontrado');

    if (id_categoria !== undefined) plato.id_categoria = Number(id_categoria);
    if (id_estacion !== undefined) plato.id_estacion = Number(id_estacion);
    if (nombre !== undefined) plato.nombre = nombre;
    if (descripcion !== undefined) plato.descripcion = descripcion;
    if (precio_base !== undefined) plato.precio_base = Number(precio_base);
    if (tiempo_prep_estimado_min !== undefined) plato.tiempo_prep_estimado_min = Number(tiempo_prep_estimado_min);
    if (imagen_url !== undefined) plato.imagen_url = imagen_url;
    if (modelo_3d_url !== undefined) plato.modelo_3d_url = modelo_3d_url;
    if (disponible !== undefined) plato.disponible = disponible;
    if (es_recomendado_ia !== undefined) plato.es_recomendado_ia = es_recomendado_ia;

    if (Array.isArray(grupos_opciones_ids)) {
      mockDb.plato_grupos_opciones = mockDb.plato_grupos_opciones.filter(pgo => pgo.id_plato !== id);
      grupos_opciones_ids.forEach(id_grupo => {
        mockDb.plato_grupos_opciones.push({
          id_plato: id,
          id_grupo_opcion: Number(id_grupo)
        });
      });
    }

    return plato;
  },

  async eliminarPlato(id_plato) {
    const id = Number(id_plato);

    if (supabase) {
      try {
        // Intentar borrado físico
        const { error } = await supabase.from('platos').delete().eq('id_plato', id);
        if (!error) {
          return { accion: 'ELIMINADO_FISICO', mensaje: 'Plato eliminado definitivamente' };
        }

        // Si tiene pedidos asociados (FK 23503), aplicar borrado lógico
        if (error.code === '23503') {
          await supabase.from('platos').update({ disponible: false }).eq('id_plato', id);
          return {
            accion: 'DESACTIVADO_LOGICO',
            mensaje: 'El plato tiene pedidos históricos registrados. Se ha desactivado (no disponible) para proteger el historial de ventas.'
          };
        }
        throw error;
      } catch (e) {
        console.warn('Fallo Supabase en eliminarPlato:', e.message);
      }
    }

    const tieneDetalles = mockDb.detalle_pedidos.some(dp => dp.id_plato === id);
    if (tieneDetalles) {
      const p = mockDb.platos.find(pl => pl.id_plato === id);
      if (p) p.disponible = false;
      return {
        accion: 'DESACTIVADO_LOGICO',
        mensaje: 'El plato tiene pedidos históricos registrados. Se ha desactivado (no disponible) para proteger el historial de ventas.'
      };
    }

    const index = mockDb.platos.findIndex(p => p.id_plato === id);
    if (index === -1) throw new Error('Plato no encontrado');
    mockDb.platos.splice(index, 1);
    mockDb.plato_grupos_opciones = mockDb.plato_grupos_opciones.filter(pgo => pgo.id_plato !== id);

    return { accion: 'ELIMINADO_FISICO', mensaje: 'Plato eliminado definitivamente' };
  },

  // ==========================================
  // 3. GESTIÓN DE ZONAS (zonas)
  // ==========================================
  async listarZonas() {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('zonas').select('*, mesas(count)').order('id_zona');
        if (!error && data) {
          return data.map(z => ({
            ...z,
            total_mesas: z.mesas?.[0]?.count || 0
          }));
        }
      } catch (e) {
        console.warn('Fallo Supabase en listarZonas:', e.message);
      }
    }

    return mockDb.zonas.map(z => ({
      ...z,
      total_mesas: mockDb.mesas.filter(m => m.id_zona === z.id_zona).length
    }));
  },

  async crearZona({ nombre, descripcion, activa = true }) {
    if (!nombre) throw new Error('El nombre de la zona es requerido');

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('zonas')
          .insert([{ nombre, descripcion, activa }])
          .select()
          .single();
        if (!error && data) return data;
        if (error) throw error;
      } catch (e) {
        console.warn('Fallo Supabase en crearZona:', e.message);
      }
    }

    const nuevaZona = {
      id_zona: mockDb.zonas.length > 0 ? Math.max(...mockDb.zonas.map(z => z.id_zona)) + 1 : 1,
      nombre,
      descripcion: descripcion || '',
      activa: activa !== false
    };
    mockDb.zonas.push(nuevaZona);
    return nuevaZona;
  },

  async actualizarZona(id_zona, { nombre, descripcion, activa }) {
    const id = Number(id_zona);

    if (supabase) {
      try {
        const updateData = {};
        if (nombre !== undefined) updateData.nombre = nombre;
        if (descripcion !== undefined) updateData.descripcion = descripcion;
        if (activa !== undefined) updateData.activa = activa;

        const { data, error } = await supabase
          .from('zonas')
          .update(updateData)
          .eq('id_zona', id)
          .select()
          .single();
        if (!error && data) return data;
        if (error) throw error;
      } catch (e) {
        console.warn('Fallo Supabase en actualizarZona:', e.message);
      }
    }

    const zona = mockDb.zonas.find(z => z.id_zona === id);
    if (!zona) throw new Error('Zona no encontrada');
    if (nombre !== undefined) zona.nombre = nombre;
    if (descripcion !== undefined) zona.descripcion = descripcion;
    if (activa !== undefined) zona.activa = activa;
    return zona;
  },

  async eliminarZona(id_zona) {
    const id = Number(id_zona);

    if (supabase) {
      try {
        const { count } = await supabase
          .from('mesas')
          .select('*', { count: 'exact', head: true })
          .eq('id_zona', id);

        if (count > 0) {
          const err = new Error('No se puede eliminar la zona porque tiene mesas asignadas. Reubica o elimina las mesas primero.');
          err.statusCode = 409;
          throw err;
        }

        const { error } = await supabase.from('zonas').delete().eq('id_zona', id);
        if (error) throw error;
        return { eliminada: true, id_zona: id };
      } catch (e) {
        if (e.statusCode === 409) throw e;
        console.warn('Fallo Supabase en eliminarZona:', e.message);
      }
    }

    const tieneMesas = mockDb.mesas.some(m => m.id_zona === id);
    if (tieneMesas) {
      const err = new Error('No se puede eliminar la zona porque tiene mesas asignadas. Reubica o elimina las mesas primero.');
      err.statusCode = 409;
      throw err;
    }

    const index = mockDb.zonas.findIndex(z => z.id_zona === id);
    if (index === -1) throw new Error('Zona no encontrada');
    mockDb.zonas.splice(index, 1);
    return { eliminada: true, id_zona: id };
  },

  // ==========================================
  // 4. GESTIÓN DE MESAS Y QR DINÁMICO (mesas)
  // ==========================================
  async listarMesas() {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('mesas')
          .select('*, zonas(nombre)')
          .order('id_mesa');

        if (!error && data) {
          return data.map(m => ({
            ...m,
            zona_nombre: m.zonas?.nombre || ''
          }));
        }
      } catch (e) {
        console.warn('Fallo Supabase en listarMesas:', e.message);
      }
    }

    return mockDb.mesas.map(m => {
      const zona = mockDb.zonas.find(z => z.id_zona === m.id_zona);
      return {
        ...m,
        zona_nombre: zona ? zona.nombre : ''
      };
    });
  },

  async crearMesa({ id_zona, numero_mesa, capacidad = 4 }) {
    if (!id_zona || !numero_mesa) throw new Error('id_zona y numero_mesa son obligatorios');

    const codigoQrToken = crypto.randomUUID();

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('mesas')
          .insert([
            {
              id_zona: Number(id_zona),
              numero_mesa: numero_mesa.trim().toUpperCase(),
              capacidad: Number(capacidad),
              codigo_qr_token: codigoQrToken,
              estado: 'LIBRE'
            }
          ])
          .select('*, zonas(nombre)')
          .single();

        if (error) throw error;
        return {
          ...data,
          zona_nombre: data.zonas?.nombre || ''
        };
      } catch (e) {
        console.warn('Fallo Supabase en crearMesa:', e.message);
      }
    }

    // Validar unicidad en mockDb
    if (mockDb.mesas.some(m => m.numero_mesa.toUpperCase() === numero_mesa.trim().toUpperCase())) {
      throw new Error(`Ya existe una mesa con el número ${numero_mesa}`);
    }

    const nuevaMesa = {
      id_mesa: mockDb.mesas.length > 0 ? Math.max(...mockDb.mesas.map(m => m.id_mesa)) + 1 : 1,
      id_zona: Number(id_zona),
      numero_mesa: numero_mesa.trim().toUpperCase(),
      capacidad: Number(capacidad) || 4,
      codigo_qr_token: codigoQrToken,
      estado: 'LIBRE'
    };
    mockDb.mesas.push(nuevaMesa);

    const zona = mockDb.zonas.find(z => z.id_zona === nuevaMesa.id_zona);
    return {
      ...nuevaMesa,
      zona_nombre: zona ? zona.nombre : ''
    };
  },

  async actualizarMesa(id_mesa, datos) {
    const id = Number(id_mesa);
    const { id_zona, numero_mesa, capacidad, estado } = datos;

    if (supabase) {
      try {
        const updateData = {};
        if (id_zona !== undefined) updateData.id_zona = Number(id_zona);
        if (numero_mesa !== undefined) updateData.numero_mesa = numero_mesa.trim().toUpperCase();
        if (capacidad !== undefined) updateData.capacidad = Number(capacidad);
        if (estado !== undefined) updateData.estado = estado;

        const { data, error } = await supabase
          .from('mesas')
          .update(updateData)
          .eq('id_mesa', id)
          .select('*, zonas(nombre)')
          .single();

        if (error) throw error;
        return {
          ...data,
          zona_nombre: data.zonas?.nombre || ''
        };
      } catch (e) {
        console.warn('Fallo Supabase en actualizarMesa:', e.message);
      }
    }

    const mesa = mockDb.mesas.find(m => m.id_mesa === id);
    if (!mesa) throw new Error('Mesa no encontrada');

    if (id_zona !== undefined) mesa.id_zona = Number(id_zona);
    if (numero_mesa !== undefined) mesa.numero_mesa = numero_mesa.trim().toUpperCase();
    if (capacidad !== undefined) mesa.capacidad = Number(capacidad);
    if (estado !== undefined) mesa.estado = estado;

    const zona = mockDb.zonas.find(z => z.id_zona === mesa.id_zona);
    return {
      ...mesa,
      zona_nombre: zona ? zona.nombre : ''
    };
  },

  async regenerarQrMesa(id_mesa) {
    const id = Number(id_mesa);
    const nuevoToken = crypto.randomUUID();

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('mesas')
          .update({ codigo_qr_token: nuevoToken })
          .eq('id_mesa', id)
          .select()
          .single();

        if (error) throw error;
        return { ok: true, id_mesa: id, nuevo_codigo_qr_token: nuevoToken };
      } catch (e) {
        console.warn('Fallo Supabase en regenerarQrMesa:', e.message);
      }
    }

    const mesa = mockDb.mesas.find(m => m.id_mesa === id);
    if (!mesa) throw new Error('Mesa no encontrada');
    mesa.codigo_qr_token = nuevoToken;

    return { ok: true, id_mesa: id, nuevo_codigo_qr_token: nuevoToken };
  },

  async eliminarMesa(id_mesa) {
    const id = Number(id_mesa);

    if (supabase) {
      try {
        const { count } = await supabase
          .from('sesiones_mesa')
          .select('*', { count: 'exact', head: true })
          .eq('id_mesa', id);

        if (count > 0) {
          const err = new Error('No se puede eliminar la mesa porque tiene sesiones y pedidos históricos registrados. Te recomendamos cambiar su estado a MANTENIMIENTO.');
          err.statusCode = 409;
          throw err;
        }

        const { error } = await supabase.from('mesas').delete().eq('id_mesa', id);
        if (error) {
          if (error.code === '23503') {
            const fkErr = new Error('No se puede eliminar la mesa por dependencias en el historial. Cámbiala a MANTENIMIENTO.');
            fkErr.statusCode = 409;
            throw fkErr;
          }
          throw error;
        }

        return { eliminada: true, id_mesa: id };
      } catch (e) {
        if (e.statusCode === 409) throw e;
        console.warn('Fallo Supabase en eliminarMesa:', e.message);
      }
    }

    const tieneSesiones = mockDb.sesiones_mesa.some(s => s.id_mesa === id);
    if (tieneSesiones) {
      const err = new Error('No se puede eliminar la mesa porque tiene sesiones y pedidos históricos registrados. Te recomendamos cambiar su estado a MANTENIMIENTO.');
      err.statusCode = 409;
      throw err;
    }

    const index = mockDb.mesas.findIndex(m => m.id_mesa === id);
    if (index === -1) throw new Error('Mesa no encontrada');
    mockDb.mesas.splice(index, 1);

    return { eliminada: true, id_mesa: id };
  },

  // ==========================================
  // 5. GESTIÓN DE PERSONAL / USUARIOS (usuarios)
  // ==========================================
  async listarUsuarios() {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .select('id_usuario, nombres, apellidos, email, rol, activo, creado_en')
          .order('id_usuario');
        if (!error && data) return data;
      } catch (e) {
        console.warn('Fallo Supabase en listarUsuarios:', e.message);
      }
    }

    return (mockDb.usuarios || []).map(u => ({
      id_usuario: u.id_usuario,
      nombres: u.nombres,
      apellidos: u.apellidos,
      email: u.email,
      rol: u.rol,
      activo: u.activo,
      creado_en: u.creado_en
    }));
  },

  async crearUsuario({ nombres, apellidos, email, password, rol }) {
    const rolesValidos = ['ADMIN', 'CAJERO', 'MOZO', 'COCINA_FRIA', 'COCINA_CALIENTE'];
    if (!rolesValidos.includes(rol)) {
      throw new Error(`Rol inválido. Roles válidos: ${rolesValidos.join(', ')}`);
    }
    if (!nombres || !apellidos || !email || !password) {
      throw new Error('Todos los campos son obligatorios');
    }

    const bcrypt = (await import('bcryptjs')).default;
    const passwordHash = await bcrypt.hash(password, 10);

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .insert([
            {
              nombres,
              apellidos,
              email: email.trim().toLowerCase(),
              password_hash: passwordHash,
              rol,
              activo: true
            }
          ])
          .select('id_usuario, nombres, apellidos, email, rol, activo, creado_en')
          .single();

        if (error) throw error;
        return data;
      } catch (e) {
        console.warn('Fallo Supabase en crearUsuario:', e.message);
      }
    }

    if ((mockDb.usuarios || []).some(u => u.email.toLowerCase() === email.trim().toLowerCase())) {
      throw new Error('Ya existe un usuario con este correo electrónico');
    }

    const nuevoUsuario = {
      id_usuario: (mockDb.usuarios || []).length > 0 ? Math.max(...mockDb.usuarios.map(u => u.id_usuario)) + 1 : 1,
      nombres,
      apellidos,
      email: email.trim().toLowerCase(),
      password_hash: passwordHash,
      rol,
      activo: true,
      creado_en: new Date().toISOString()
    };
    if (!mockDb.usuarios) mockDb.usuarios = [];
    mockDb.usuarios.push(nuevoUsuario);

    return {
      id_usuario: nuevoUsuario.id_usuario,
      nombres: nuevoUsuario.nombres,
      apellidos: nuevoUsuario.apellidos,
      email: nuevoUsuario.email,
      rol: nuevoUsuario.rol,
      activo: nuevoUsuario.activo,
      creado_en: nuevoUsuario.creado_en
    };
  },

  async actualizarUsuario(id_usuario, { activo, rol }) {
    const id = Number(id_usuario);
    const updateData = {};
    if (activo !== undefined) updateData.activo = activo;
    if (rol !== undefined) {
      const rolesValidos = ['ADMIN', 'CAJERO', 'MOZO', 'COCINA_FRIA', 'COCINA_CALIENTE'];
      if (!rolesValidos.includes(rol)) throw new Error(`Rol inválido: ${rol}`);
      updateData.rol = rol;
    }

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .update(updateData)
          .eq('id_usuario', id)
          .select('id_usuario, nombres, apellidos, email, rol, activo, creado_en')
          .single();
        if (!error && data) return data;
      } catch (e) {
        console.warn('Fallo Supabase en actualizarUsuario:', e.message);
      }
    }

    const u = (mockDb.usuarios || []).find(user => user.id_usuario === id);
    if (!u) throw new Error('Usuario no encontrado');
    if (activo !== undefined) u.activo = activo;
    if (rol !== undefined) u.rol = rol;

    return {
      id_usuario: u.id_usuario,
      nombres: u.nombres,
      apellidos: u.apellidos,
      email: u.email,
      rol: u.rol,
      activo: u.activo,
      creado_en: u.creado_en
    };
  },

  // ==========================================
  // 6. GESTIÓN DE PERSONALIZACIONES (grupos_opciones + opciones_personalizacion)
  // ==========================================
  async listarGruposConOpciones() {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('grupos_opciones')
          .select('*, opciones_personalizacion(*)')
          .order('id_grupo_opcion');
        if (!error && data) return data;
      } catch (e) {
        console.warn('Fallo Supabase en listarGruposConOpciones:', e.message);
      }
    }

    return mockDb.grupos_opciones.map(g => ({
      ...g,
      opciones_personalizacion: mockDb.opciones_personalizacion.filter(op => op.id_grupo_opcion === g.id_grupo_opcion)
    }));
  },

  async crearGrupoOpcion({ nombre, es_obligatorio = false, seleccion_multiple = false }) {
    if (!nombre) throw new Error('El nombre del grupo es obligatorio');

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('grupos_opciones')
          .insert([{ nombre, es_obligatorio, seleccion_multiple }])
          .select('*, opciones_personalizacion(*)')
          .single();
        if (!error && data) return data;
      } catch (e) {
        console.warn('Fallo Supabase en crearGrupoOpcion:', e.message);
      }
    }

    const nuevoG = {
      id_grupo_opcion: mockDb.grupos_opciones.length > 0 ? Math.max(...mockDb.grupos_opciones.map(g => g.id_grupo_opcion)) + 1 : 1,
      nombre,
      es_obligatorio: Boolean(es_obligatorio),
      seleccion_multiple: Boolean(seleccion_multiple)
    };
    mockDb.grupos_opciones.push(nuevoG);
    return { ...nuevoG, opciones_personalizacion: [] };
  },

  async actualizarGrupoOpcion(id_grupo, { nombre, es_obligatorio, seleccion_multiple }) {
    const id = Number(id_grupo);
    if (supabase) {
      try {
        const updateData = {};
        if (nombre !== undefined) updateData.nombre = nombre;
        if (es_obligatorio !== undefined) updateData.es_obligatorio = es_obligatorio;
        if (seleccion_multiple !== undefined) updateData.seleccion_multiple = seleccion_multiple;

        const { data, error } = await supabase
          .from('grupos_opciones')
          .update(updateData)
          .eq('id_grupo_opcion', id)
          .select('*, opciones_personalizacion(*)')
          .single();
        if (!error && data) return data;
      } catch (e) {
        console.warn('Fallo Supabase en actualizarGrupoOpcion:', e.message);
      }
    }

    const g = mockDb.grupos_opciones.find(grp => grp.id_grupo_opcion === id);
    if (!g) throw new Error('Grupo no encontrado');
    if (nombre !== undefined) g.nombre = nombre;
    if (es_obligatorio !== undefined) g.es_obligatorio = es_obligatorio;
    if (seleccion_multiple !== undefined) g.seleccion_multiple = seleccion_multiple;

    return {
      ...g,
      opciones_personalizacion: mockDb.opciones_personalizacion.filter(op => op.id_grupo_opcion === id)
    };
  },

  async eliminarGrupoOpcion(id_grupo) {
    const id = Number(id_grupo);
    if (supabase) {
      try {
        const { error } = await supabase.from('grupos_opciones').delete().eq('id_grupo_opcion', id);
        if (!error) return { eliminada: true, id_grupo_opcion: id };
      } catch (e) {
        console.warn('Fallo Supabase en eliminarGrupoOpcion:', e.message);
      }
    }

    const idx = mockDb.grupos_opciones.findIndex(grp => grp.id_grupo_opcion === id);
    if (idx === -1) throw new Error('Grupo no encontrado');
    mockDb.grupos_opciones.splice(idx, 1);
    mockDb.opciones_personalizacion = mockDb.opciones_personalizacion.filter(op => op.id_grupo_opcion !== id);
    mockDb.plato_grupos_opciones = mockDb.plato_grupos_opciones.filter(pgo => pgo.id_grupo_opcion !== id);

    return { eliminada: true, id_grupo_opcion: id };
  },

  async crearOpcionPersonalizacion({ id_grupo_opcion, nombre, precio_adicional = 0, disponible = true }) {
    if (!id_grupo_opcion || !nombre) throw new Error('id_grupo_opcion y nombre son obligatorios');

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('opciones_personalizacion')
          .insert([
            {
              id_grupo_opcion: Number(id_grupo_opcion),
              nombre,
              precio_adicional: Number(precio_adicional) || 0.00,
              disponible: disponible !== false
            }
          ])
          .select()
          .single();
        if (!error && data) return data;
      } catch (e) {
        console.warn('Fallo Supabase en crearOpcionPersonalizacion:', e.message);
      }
    }

    const nuevaOp = {
      id_opcion: mockDb.opciones_personalizacion.length > 0 ? Math.max(...mockDb.opciones_personalizacion.map(o => o.id_opcion)) + 1 : 1,
      id_grupo_opcion: Number(id_grupo_opcion),
      nombre,
      precio_adicional: Number(precio_adicional) || 0.00,
      disponible: disponible !== false
    };
    mockDb.opciones_personalizacion.push(nuevaOp);
    return nuevaOp;
  },

  async actualizarOpcionPersonalizacion(id_opcion, { nombre, precio_adicional, disponible }) {
    const id = Number(id_opcion);
    if (supabase) {
      try {
        const updateData = {};
        if (nombre !== undefined) updateData.nombre = nombre;
        if (precio_adicional !== undefined) updateData.precio_adicional = Number(precio_adicional);
        if (disponible !== undefined) updateData.disponible = disponible;

        const { data, error } = await supabase
          .from('opciones_personalizacion')
          .update(updateData)
          .eq('id_opcion', id)
          .select()
          .single();
        if (!error && data) return data;
      } catch (e) {
        console.warn('Fallo Supabase en actualizarOpcionPersonalizacion:', e.message);
      }
    }

    const op = mockDb.opciones_personalizacion.find(o => o.id_opcion === id);
    if (!op) throw new Error('Opción no encontrada');
    if (nombre !== undefined) op.nombre = nombre;
    if (precio_adicional !== undefined) op.precio_adicional = Number(precio_adicional);
    if (disponible !== undefined) op.disponible = disponible;

    return op;
  },

  async eliminarOpcionPersonalizacion(id_opcion) {
    const id = Number(id_opcion);
    if (supabase) {
      try {
        const { error } = await supabase.from('opciones_personalizacion').delete().eq('id_opcion', id);
        if (!error) return { eliminada: true, id_opcion: id };
      } catch (e) {
        console.warn('Fallo Supabase en eliminarOpcionPersonalizacion:', e.message);
      }
    }

    const idx = mockDb.opciones_personalizacion.findIndex(o => o.id_opcion === id);
    if (idx === -1) throw new Error('Opción no encontrada');
    mockDb.opciones_personalizacion.splice(idx, 1);
    return { eliminada: true, id_opcion: id };
  },

  // ==========================================
  // 7. GESTIÓN DE RESEÑAS Y MÉTRICAS (resenas_experiencia)
  // ==========================================
  async obtenerMetricasYResenas() {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('resenas_experiencia')
          .select('*, sesiones_mesa(id_mesa, mesas(numero_mesa))')
          .order('creado_en', { ascending: false });

        if (!error && data) {
          const formateadas = data.map(r => ({
            ...r,
            numero_mesa: r.sesiones_mesa?.mesas?.numero_mesa || 'M-??'
          }));

          const total = formateadas.length;
          const promedio = total > 0 ? (formateadas.reduce((sum, r) => sum + r.calificacion, 0) / total).toFixed(1) : '5.0';
          const redirigidas = formateadas.filter(r => r.redirigido_google).length;
          const quejasInternas = formateadas.filter(r => r.calificacion <= 3);

          return {
            resumen: {
              total_resenas: total,
              promedio_estrellas: Number(promedio),
              enviadas_a_google: redirigidas,
              quejas_internas_count: quejasInternas.length
            },
            resenas: formateadas,
            quejas_internas: quejasInternas
          };
        }
      } catch (e) {
        console.warn('Fallo Supabase en obtenerMetricasYResenas:', e.message);
      }
    }

    const formateadas = mockDb.resenas_experiencia.map(r => {
      const sesion = mockDb.sesiones_mesa.find(s => s.id_sesion === r.id_sesion);
      const mesa = sesion ? mockDb.mesas.find(m => m.id_mesa === sesion.id_mesa) : null;
      return {
        ...r,
        numero_mesa: mesa ? mesa.numero_mesa : 'M-07'
      };
    });

    const total = formateadas.length;
    const promedio = total > 0 ? (formateadas.reduce((sum, r) => sum + r.calificacion, 0) / total).toFixed(1) : '5.0';
    const redirigidas = formateadas.filter(r => r.redirigido_google).length;
    const quejasInternas = formateadas.filter(r => r.calificacion <= 3);

    return {
      resumen: {
        total_resenas: total,
        promedio_estrellas: Number(promedio),
        enviadas_a_google: redirigidas,
        quejas_internas_count: quejasInternas.length
      },
      resenas: formateadas,
      quejas_internas: quejasInternas
    };
  },

  async listarGruposOpciones() {
    return this.listarGruposConOpciones();
  },

  async listarEstacionesCocina() {
    return mockDb.estaciones_cocina;
  }
};


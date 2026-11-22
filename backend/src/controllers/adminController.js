import { AdminService } from '../services/adminService.js';

export const AdminController = {
  // --- Categorías ---
  async listarCategorias(req, res) {
    try {
      const data = await AdminService.listarCategorias();
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  },

  async crearCategoria(req, res) {
    try {
      const data = await AdminService.crearCategoria(req.body);
      res.status(201).json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },

  async actualizarCategoria(req, res) {
    try {
      const data = await AdminService.actualizarCategoria(req.params.id, req.body);
      res.json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },

  async eliminarCategoria(req, res) {
    try {
      const data = await AdminService.eliminarCategoria(req.params.id);
      res.json({ ok: true, data });
    } catch (err) {
      const status = err.statusCode || 400;
      res.status(status).json({ ok: false, error: err.message });
    }
  },

  // --- Platos ---
  async listarPlatos(req, res) {
    try {
      const data = await AdminService.listarPlatos();
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  },

  async crearPlato(req, res) {
    try {
      const data = await AdminService.crearPlato(req.body);
      res.status(201).json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },

  async actualizarPlato(req, res) {
    try {
      const data = await AdminService.actualizarPlato(req.params.id, req.body);
      res.json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },

  async eliminarPlato(req, res) {
    try {
      const data = await AdminService.eliminarPlato(req.params.id);
      res.json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },

  // --- Zonas ---
  async listarZonas(req, res) {
    try {
      const data = await AdminService.listarZonas();
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  },

  async crearZona(req, res) {
    try {
      const data = await AdminService.crearZona(req.body);
      res.status(201).json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },

  async actualizarZona(req, res) {
    try {
      const data = await AdminService.actualizarZona(req.params.id, req.body);
      res.json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },

  async eliminarZona(req, res) {
    try {
      const data = await AdminService.eliminarZona(req.params.id);
      res.json({ ok: true, data });
    } catch (err) {
      const status = err.statusCode || 400;
      res.status(status).json({ ok: false, error: err.message });
    }
  },

  // --- Mesas ---
  async listarMesas(req, res) {
    try {
      const data = await AdminService.listarMesas();
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  },

  async crearMesa(req, res) {
    try {
      const data = await AdminService.crearMesa(req.body);
      res.status(201).json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },

  async actualizarMesa(req, res) {
    try {
      const data = await AdminService.actualizarMesa(req.params.id, req.body);
      res.json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },

  async regenerarQrMesa(req, res) {
    try {
      const data = await AdminService.regenerarQrMesa(req.params.id);
      res.json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },

  async eliminarMesa(req, res) {
    try {
      const data = await AdminService.eliminarMesa(req.params.id);
      res.json({ ok: true, data });
    } catch (err) {
      const status = err.statusCode || 400;
      res.status(status).json({ ok: false, error: err.message });
    }
  },

  async obtenerOpcionesYEstaciones(req, res) {
    try {
      const [grupos, estaciones] = await Promise.all([
        AdminService.listarGruposOpciones(),
        AdminService.listarEstacionesCocina()
      ]);
      res.json({ ok: true, data: { grupos_opciones: grupos, estaciones_cocina: estaciones } });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  },

  // --- Usuarios / Personal ---
  async listarUsuarios(req, res) {
    try {
      const data = await AdminService.listarUsuarios();
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  },

  async crearUsuario(req, res) {
    try {
      const data = await AdminService.crearUsuario(req.body);
      res.status(201).json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },

  async actualizarUsuario(req, res) {
    try {
      const data = await AdminService.actualizarUsuario(req.params.id, req.body);
      res.json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },

  // --- Grupos de Opciones y Personalizaciones ---
  async listarGruposOpciones(req, res) {
    try {
      const data = await AdminService.listarGruposConOpciones();
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  },

  async crearGrupoOpcion(req, res) {
    try {
      const data = await AdminService.crearGrupoOpcion(req.body);
      res.status(201).json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },

  async actualizarGrupoOpcion(req, res) {
    try {
      const data = await AdminService.actualizarGrupoOpcion(req.params.id, req.body);
      res.json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },

  async eliminarGrupoOpcion(req, res) {
    try {
      const data = await AdminService.eliminarGrupoOpcion(req.params.id);
      res.json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },

  async crearOpcionPersonalizacion(req, res) {
    try {
      const data = await AdminService.crearOpcionPersonalizacion(req.body);
      res.status(201).json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },

  async actualizarOpcionPersonalizacion(req, res) {
    try {
      const data = await AdminService.actualizarOpcionPersonalizacion(req.params.id, req.body);
      res.json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },

  async eliminarOpcionPersonalizacion(req, res) {
    try {
      const data = await AdminService.eliminarOpcionPersonalizacion(req.params.id);
      res.json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },

  // --- Reseñas y Métricas ---
  async obtenerMetricasYResenas(req, res) {
    try {
      const data = await AdminService.obtenerMetricasYResenas();
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  }
};


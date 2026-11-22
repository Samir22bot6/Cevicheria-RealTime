// Mock store sincronizado con el schema exacto de database/schema_cevicheria_3fn.sql
// Esto garantiza que el MVP sea 100% interactivo de inmediato para desarrollo, pruebas y demos,
// y si hay conexión activa a Supabase, se interactúa con PostgreSQL según corresponda.

export const mockDb = {
  zonas: [
    { id_zona: 1, nombre: 'Salón Principal', descripcion: 'Área central climatizada', activa: true },
    { id_zona: 2, nombre: 'Terraza Marina', descripcion: 'Área abierta cerca a la entrada', activa: true },
    { id_zona: 3, nombre: 'Barra Cevichera', descripcion: 'Vista directa a la preparación en frío', activa: true }
  ],
  mesas: [
    { id_mesa: 1, id_zona: 1, numero_mesa: 'M-01', capacidad: 4, codigo_qr_token: '11111111-1111-4111-8111-111111111111', estado: 'LIBRE' },
    { id_mesa: 2, id_zona: 1, numero_mesa: 'M-02', capacidad: 4, codigo_qr_token: '22222222-2222-4222-8222-222222222222', estado: 'LIBRE' },
    { id_mesa: 3, id_zona: 1, numero_mesa: 'M-03', capacidad: 6, codigo_qr_token: '33333333-3333-4333-8333-333333333333', estado: 'LIBRE' },
    { id_mesa: 4, id_zona: 2, numero_mesa: 'M-07', capacidad: 4, codigo_qr_token: '77777777-7777-4777-8777-777777777777', estado: 'LIBRE' },
    { id_mesa: 5, id_zona: 3, numero_mesa: 'B-01', capacidad: 2, codigo_qr_token: '88888888-8888-4888-8888-888888888888', estado: 'LIBRE' }
  ],
  estaciones_cocina: [
    { id_estacion: 1, nombre: 'BARRA_FRIA', descripcion: 'Ceviches, tiraditos, causas y leches de tigre' },
    { id_estacion: 2, nombre: 'COCINA_CALIENTE', descripcion: 'Chicharrones, jaleas, parihuelas y arroces' },
    { id_estacion: 3, nombre: 'BAR_BEBIDAS', descripcion: 'Chicha morada, limonadas, cervezas y chilcanos' }
  ],
  categorias_carta: [
    { id_categoria: 1, nombre: 'Ceviches', descripcion: 'Preparados al momento con pesca fresca del día', orden_visualizacion: 1, activa: true },
    { id_categoria: 2, nombre: 'Tiraditos', descripcion: 'Finas láminas de pescado bañadas en cremas de ají', orden_visualizacion: 2, activa: true },
    { id_categoria: 3, nombre: 'Chicharrones y Jaleas', descripcion: 'Crocantes frituras marinas acompañadas de yuca y sarza', orden_visualizacion: 3, activa: true },
    { id_categoria: 4, nombre: 'Rondas Marinas', descripcion: 'Combinaciones ideales para compartir al centro', orden_visualizacion: 4, activa: true },
    { id_categoria: 5, nombre: 'Bebidas', descripcion: 'Refrescos naturales y bebidas heladas', orden_visualizacion: 5, activa: true }
  ],
  grupos_opciones: [
    { id_grupo_opcion: 1, nombre: 'Nivel de Ají', es_obligatorio: true, seleccion_multiple: false },
    { id_grupo_opcion: 2, nombre: 'Tipo de Pescado', es_obligatorio: true, seleccion_multiple: false },
    { id_grupo_opcion: 3, nombre: 'Guarniciones Extra', es_obligatorio: false, seleccion_multiple: true }
  ],
  opciones_personalizacion: [
    { id_opcion: 1, id_grupo_opcion: 1, nombre: 'Sin Ají', precio_adicional: 0.00, disponible: true },
    { id_opcion: 2, id_grupo_opcion: 1, nombre: 'Ají Suave', precio_adicional: 0.00, disponible: true },
    { id_opcion: 3, id_grupo_opcion: 1, nombre: 'Ají Normal', precio_adicional: 0.00, disponible: true },
    { id_opcion: 4, id_grupo_opcion: 1, nombre: 'Ají Limo Picante', precio_adicional: 0.00, disponible: true },
    { id_opcion: 5, id_grupo_opcion: 2, nombre: 'Pesca del Día', precio_adicional: 0.00, disponible: true },
    { id_opcion: 6, id_grupo_opcion: 2, nombre: 'Lenguado Fino', precio_adicional: 9.00, disponible: true },
    { id_opcion: 7, id_grupo_opcion: 3, nombre: 'Porción Extra Cancha Serrana', precio_adicional: 3.50, disponible: true },
    { id_opcion: 8, id_grupo_opcion: 3, nombre: 'Porción Extra Chicharrón de Pota', precio_adicional: 7.00, disponible: true }
  ],
  plato_grupos_opciones: [
    { id_plato: 1, id_grupo_opcion: 1 },
    { id_plato: 1, id_grupo_opcion: 2 },
    { id_plato: 1, id_grupo_opcion: 3 },
    { id_plato: 2, id_grupo_opcion: 1 },
    { id_plato: 2, id_grupo_opcion: 2 },
    { id_plato: 2, id_grupo_opcion: 3 }
  ],
  platos: [
    {
      id_plato: 1,
      id_categoria: 1,
      id_estacion: 1,
      nombre: 'Ceviche Clásico de Pescado',
      descripcion: 'Cubos de pesca del día marinados en limón sutil, cebolla roja, cilantro y ají limo, con camote glaseado y choclo.',
      precio_base: 34.00,
      tiempo_prep_estimado_min: 8,
      imagen_url: 'https://images.unsplash.com/photo-1535399831218-d5bd36d1a6b3?auto=format&fit=crop&w=600&q=80',
      disponible: true,
      es_recomendado_ia: true
    },
    {
      id_plato: 2,
      id_categoria: 1,
      id_estacion: 1,
      nombre: 'Ceviche Mixto Carretillero',
      descripcion: 'Pesca del día, pulpo, calamar y langostinos con toque de chicharrón de pota crocante.',
      precio_base: 38.00,
      tiempo_prep_estimado_min: 10,
      imagen_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
      disponible: true,
      es_recomendado_ia: true
    },
    {
      id_plato: 3,
      id_categoria: 2,
      id_estacion: 1,
      nombre: 'Tiradito al Ají Amarillo',
      descripcion: 'Láminas de pescado fresco en emulsión cremosa de ají amarillo y limón.',
      precio_base: 32.00,
      tiempo_prep_estimado_min: 7,
      imagen_url: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=600&q=80',
      disponible: true,
      es_recomendado_ia: false
    },
    {
      id_plato: 4,
      id_categoria: 3,
      id_estacion: 2,
      nombre: 'Jalea Mixta Familiar',
      descripcion: 'Trozos crocantes de pescado y mariscos sobre yucas doradas, cubierta con sarza criolla y tártara.',
      precio_base: 52.00,
      tiempo_prep_estimado_min: 15,
      imagen_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80',
      disponible: true,
      es_recomendado_ia: true
    },
    {
      id_plato: 5,
      id_categoria: 4,
      id_estacion: 2,
      nombre: 'Ronda Marina Tres Regiones',
      descripcion: 'Ceviche clásico + Arroz con mariscos + Chicharrón de pescado para 3 personas.',
      precio_base: 68.00,
      tiempo_prep_estimado_min: 18,
      imagen_url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80',
      disponible: true,
      es_recomendado_ia: true
    },
    {
      id_plato: 6,
      id_categoria: 5,
      id_estacion: 3,
      nombre: 'Jarra de Chicha Morada (1L)',
      descripcion: 'Maíz morado hervido con piña, membrillo, canela y clavo.',
      precio_base: 16.00,
      tiempo_prep_estimado_min: 3,
      imagen_url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80',
      disponible: true,
      es_recomendado_ia: false
    }
  ],
  sesiones_mesa: [],
  pedidos: [],
  detalle_pedidos: [],
  detalle_pedido_opciones: [],
  pagos: [],
  resenas_experiencia: []
};


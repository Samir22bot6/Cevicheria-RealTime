import { ai } from '../config/gemini.js';
import { supabase } from '../config/supabase.js';
import { mockDb } from './mockStore.js';

/**
 * Consulta en Supabase (o mock de contingencia) únicamente platos y opciones disponibles en inventario
 */
async function obtenerCatalogoDisponible() {
  if (supabase) {
    try {
      const { data: categorias, error } = await supabase
        .from('categorias_carta')
        .select(`
          id_categoria,
          nombre,
          activa,
          platos (
            id_plato,
            nombre,
            descripcion,
            precio_base,
            disponible,
            es_recomendado_ia,
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
        .eq('platos.disponible', true);

      if (!error && categorias && categorias.length > 0) {
        const catalogo = [];
        categorias.forEach(cat => {
          (cat.platos || []).forEach(p => {
            if (p.disponible === false) return;
            // Validar stock si existe la columna en el registro
            if (p.stock !== undefined && p.stock !== null && Number(p.stock) <= 0) return;

            const opcionesDisponibles = [];
            (p.plato_grupos_opciones || []).forEach(pgo => {
              const g = pgo.grupos_opciones;
              if (!g) return;
              const ops = g.opciones || g.opciones_personalizacion || [];
              ops.forEach(op => {
                if (op.disponible !== false) {
                  opcionesDisponibles.push({
                    id_opcion: op.id_opcion,
                    grupo: g.nombre,
                    nombre: op.nombre,
                    precio_adicional: Number(op.precio_adicional || 0)
                  });
                }
              });
            });

            catalogo.push({
              id_plato: p.id_plato,
              categoria: cat.nombre,
              nombre: p.nombre,
              precio_base: Number(p.precio_base),
              descripcion: p.descripcion,
              opciones_disponibles: opcionesDisponibles
            });
          });
        });

        if (catalogo.length > 0) return catalogo;
      }
    } catch (err) {
      console.warn('Error consultando carta disponible en Supabase para Don Lucho:', err.message);
    }
  }

  // Fallback con Mock Store
  const catalogoMock = [];
  (mockDb.categorias_carta || []).filter(c => c.activa !== false).forEach(cat => {
    (mockDb.platos || [])
      .filter(p => p.id_categoria === cat.id_categoria && p.disponible !== false)
      .forEach(p => {
        const pgoIds = (mockDb.plato_grupos_opciones || []).filter(pgo => pgo.id_plato === p.id_plato);
        const opcionesDisponibles = [];
        pgoIds.forEach(pgo => {
          const g = (mockDb.grupos_opciones || []).find(go => go.id_grupo_opcion === pgo.id_grupo_opcion);
          if (g) {
            const ops = (mockDb.opciones_personalizacion || [])
              .filter(op => op.id_grupo_opcion === g.id_grupo_opcion && op.disponible !== false);
            ops.forEach(op => {
              opcionesDisponibles.push({
                id_opcion: op.id_opcion,
                grupo: g.nombre,
                nombre: op.nombre,
                precio_adicional: Number(op.precio_adicional || 0)
              });
            });
          }
        });

        catalogoMock.push({
          id_plato: p.id_plato,
          categoria: cat.nombre,
          nombre: p.nombre,
          precio_base: Number(p.precio_base),
          descripcion: p.descripcion,
          opciones_disponibles: opcionesDisponibles
        });
      });
  });

  return catalogoMock;
}

/**
 * Detecta si el cliente especificó un presupuesto monetario
 */
function extraerPresupuesto(texto = '') {
  const match = texto.match(/(?:presupuesto(?:\s+de)?|con|tengo|hasta)?\s*(?:s\/?\.?|\$)?\s*(\d+(?:\.\d{1,2})?)\s*(?:soles|lucas|so)?/i);
  if (match && match[1]) {
    const val = parseFloat(match[1]);
    if (val >= 10 && val <= 1500) return val;
  }
  return null;
}

export const IaService = {
  async recomendar({
    mensaje,
    mensaje_cliente,
    historial_chat = [],
    carrito_actual = [],
    id_sesion = null,
    contexto_pedido = {}
  }) {
    const mensajeActual = String(mensaje || mensaje_cliente || '').trim();

    // 1. Obtener catálogo validado de platos disponibles y opciones activas
    const catalogoPlatos = await obtenerCatalogoDisponible();

    // 2. Extraer memoria de la conversación (últimos 6 mensajes)
    const ultimosMensajes = (Array.isArray(historial_chat) ? historial_chat : [])
      .slice(-6)
      .map(m => {
        const esModelo = m.rol === 'model' || m.rol === 'ia' || m.remitente === 'ia';
        const rol = esModelo ? 'model' : 'user';
        const rolEtiqueta = esModelo ? 'Don Lucho (Tú)' : 'Comensal (Cliente)';
        const texto = String(m.texto || m.contenido || m.mensaje || '').trim();
        return { rol, rolEtiqueta, texto };
      })
      .filter(m => m.texto.length > 0);

    // 3. Detectar presupuesto (en mensaje actual o mensajes recientes del cliente)
    let presupuestoDetectado = extraerPresupuesto(mensajeActual);
    if (!presupuestoDetectado) {
      for (const m of [...ultimosMensajes].reverse()) {
        if (m.rol === 'user') {
          const p = extraerPresupuesto(m.texto);
          if (p) {
            presupuestoDetectado = p;
            break;
          }
        }
      }
    }

    // 4. Formatear carrito actual para contexto
    const carritoResumido = (Array.isArray(carrito_actual) ? carrito_actual : [])
      .map(c => ({
        id_plato: c.id_plato,
        plato: c.nombre_plato || c.nombre || 'Plato',
        cantidad: c.cantidad || 1,
        subtotal: c.subtotal || c.precio_base || 0
      }));

    // 5. Configurar System Instruction de Don Lucho
    const systemInstruction = `
Eres "Don Lucho", el legendario maestro cevichero peruano y anfitrión de barra de "SIN ESPINAS".
Tratas al comensal con calidez, cercanía, picardía y respeto auténtico de barra cevichera ("causa", "sobrino", "brother", "mi rey/reina").
Tus respuestas conversacionales son directas, al toque y de máximo 2 a 3 líneas, usando jerga cevichera natural ("al toque", "bravazo", "suavecito", "bien taypá", "con su canchita y su leche de tigre").

EJEMPLOS DE ESTILO Y TONO DE DON LUCHO:
- Presupuesto: "¡Habla causa! Con 70 soles para dos te armo un combo bravazo: un Ceviche Clásico bien fresco y su Chicharrón de Pescado crocante para compartir. ¿Lo mandamos al carrito?"
- Sin picante: "¡Al toque sobrino! Te preparo un Ceviche de Pescado sin ají, suavecito pero con harto limón recién exprimido, acompañado de unos Tequeños de Pulpo. ¡Queda preciso!"
- Resaca/Frío: "¡Uy causa, esa Parihuela levanta hasta a un muerto! Te la pongo bien taypá con su arroz blanco para que quedes como nuevo."

MEMORIA Y SEGUIMIENTO DE LA CHARLA:
- Analiza los últimos mensajes de la conversación y el carrito actual. Si el cliente dice "cámbialo por otro", "prefiero sin mariscos", "agrégale una bebida" o "algo más barato", entiende qué plato le sugeriste antes para sustituirlo o complementarlo adecuadamente.

ACCIONES PERMITIDAS ("accion"):
- "SUGERIR_COMBO": Cuando el comensal pide una nueva recomendación, almuerzo, combo o sugerencia de platos.
- "REEMPLAZAR_SUGERENCIA": Cuando el comensal pide cambiar o quitar un plato sugerido anteriormente ("cámbialo", "no me gusta el pulpo, dame otra cosa", "mejor arroz con mariscos").
- "SOLO_CONVERSACION": Si el comensal hace preguntas generales (baños, Wi-Fi, horarios, ingredientes, felicitaciones) sin pedir agregar platos. En este caso items_sugeridos DEBE ser [] y total_estimado 0.

REGLAS ESTRICTAS DE CARTA Y PRESUPUESTO:
1. Usa ÚNICAMENTE id_plato, nombre_plato, precio_base y id_opcion que existan en el CATÁLOGO DISPONIBLE de abajo. Jamás inventes platos ni precios fuera de esta lista.
2. Si el comensal mencionó un presupuesto (ej. ${presupuestoDetectado ? `S/ ${presupuestoDetectado}` : '50 o 70 soles'}), la suma total de items_sugeridos NUNCA debe superar dicho monto.
3. Para cada plato en items_sugeridos, calcula "precio_unitario" como (precio_base + suma de precios adicionales de opciones seleccionadas) y "total_estimado" como la suma de todos los subtotales.
4. Genera siempre entre 2 y 3 "preguntas_rapidas" cortas de seguimiento (ej: "¿Con qué bebida marida?", "Cámbialo por Tiradito", "Agregar Chicha Morada").

CATÁLOGO DISPONIBLE EN COCINA (JSON):
${JSON.stringify(catalogoPlatos)}
    `.trim();

    // 6. Ejecutar inferencia ultrarrápida con gemini-2.5-flash (< 1 segundo con thinkingBudget: 0)
    if (ai && catalogoPlatos.length > 0) {
      try {
        const promptContenido = [
          ...ultimosMensajes.map(m => ({
            role: m.rol,
            parts: [{ text: `${m.rolEtiqueta}: ${m.texto}` }]
          })),
          {
            role: 'user',
            parts: [
              {
                text: `Solicitud del cliente: "${mensajeActual || '¿Qué me recomiendas para comer rico hoy?'}"\n\nEstado del carrito actual: ${JSON.stringify(carritoResumido)}\nPresupuesto objetivo: ${presupuestoDetectado ? `S/ ${presupuestoDetectado}` : 'Sin límite estricto'}`
              }
            ]
          }
        ];

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: promptContenido,
          config: {
            systemInstruction,
            temperature: 0.85,
            topP: 0.95,
            thinkingConfig: {
              thinkingBudget: 0
            },
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'object',
              properties: {
                mensaje_lucho: {
                  type: 'string',
                  description: 'Respuesta conversacional de Don Lucho al cliente (máximo 2-3 líneas, jerga cevichera peruana)'
                },
                accion: {
                  type: 'string',
                  enum: ['SUGERIR_COMBO', 'REEMPLAZAR_SUGERENCIA', 'SOLO_CONVERSACION'],
                  description: 'Acción que define la sugerencia'
                },
                items_sugeridos: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id_plato: { type: 'integer' },
                      nombre_plato: { type: 'string' },
                      cantidad: { type: 'integer' },
                      precio_unitario: { type: 'number' },
                      opciones_ids: {
                        type: 'array',
                        items: { type: 'integer' }
                      },
                      nombres_opciones: {
                        type: 'array',
                        items: { type: 'string' }
                      }
                    },
                    required: ['id_plato', 'nombre_plato', 'cantidad', 'precio_unitario']
                  }
                },
                total_estimado: {
                  type: 'number',
                  description: 'Total estimado en soles de los ítems recomendados'
                },
                preguntas_rapidas: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '2 a 3 sugerencias cortas de seguimiento'
                }
              },
              required: ['mensaje_lucho', 'accion', 'items_sugeridos', 'total_estimado', 'preguntas_rapidas']
            }
          }
        });

        if (response && response.text) {
          const parsed = JSON.parse(response.text);

          // 7. Sanitización y validación estricta contra inventario real de Supabase
          let itemsValidos = (Array.isArray(parsed.items_sugeridos) ? parsed.items_sugeridos : [])
            .map(item => {
              const real = catalogoPlatos.find(p => p.id_plato === Number(item.id_plato));
              if (!real) return null; // Eliminar platos inventados fuera de la BD

              const opcionesIdsValidas = (Array.isArray(item.opciones_ids) ? item.opciones_ids : [])
                .map(Number)
                .filter(idOp => real.opciones_disponibles.some(op => op.id_opcion === idOp));

              const nombresOpcionesValidas = opcionesIdsValidas.map(idOp => {
                const op = real.opciones_disponibles.find(o => o.id_opcion === idOp);
                return op ? op.nombre : '';
              }).filter(Boolean);

              const extras = opcionesIdsValidas.reduce((acc, idOp) => {
                const op = real.opciones_disponibles.find(o => o.id_opcion === idOp);
                return acc + (op ? op.precio_adicional : 0);
              }, 0);

              const precioUnit = Number((real.precio_base + extras).toFixed(2));
              const cantidad = Math.max(1, Number(item.cantidad) || 1);

              return {
                id_plato: real.id_plato,
                nombre_plato: real.nombre,
                cantidad,
                precio_unitario: precioUnit,
                opciones_ids: opcionesIdsValidas,
                nombres_opciones: nombresOpcionesValidas
              };
            })
            .filter(Boolean);

          // Si hay presupuesto estricto, garantizar que no lo sobrepase
          if (presupuestoDetectado) {
            let acumulado = 0;
            const itemsAjustados = [];
            for (const it of itemsValidos) {
              const sub = it.precio_unitario * it.cantidad;
              if (acumulado + sub <= presupuestoDetectado * 1.05) {
                itemsAjustados.push(it);
                acumulado += sub;
              }
            }
            if (itemsAjustados.length > 0) {
              itemsValidos = itemsAjustados;
            }
          }

          const totalCalculado = Number(
            itemsValidos.reduce((s, it) => s + it.precio_unitario * it.cantidad, 0).toFixed(2)
          );

          const accionFinal = ['SUGERIR_COMBO', 'REEMPLAZAR_SUGERENCIA', 'SOLO_CONVERSACION'].includes(parsed.accion)
            ? parsed.accion
            : (itemsValidos.length > 0 ? 'SUGERIR_COMBO' : 'SOLO_CONVERSACION');

          const preguntasFinales = Array.isArray(parsed.preguntas_rapidas) && parsed.preguntas_rapidas.length >= 2
            ? parsed.preguntas_rapidas.slice(0, 3)
            : ['¿Con qué bebida marida?', '¿Tienes una opción sin ají?', '¿Cuánto demora en salir?'];

          return {
            mensaje_lucho: parsed.mensaje_lucho || '¡Aquí tienes lo mejor de la barra de SIN ESPINAS, causa!',
            respuesta: parsed.mensaje_lucho || '¡Aquí tienes lo mejor de la barra de SIN ESPINAS, causa!',
            accion: accionFinal,
            items_sugeridos: itemsValidos,
            total_estimado: totalCalculado,
            preguntas_rapidas: preguntasFinales,
            modelo: 'gemini-2.5-flash'
          };
        }
      } catch (err) {
        console.warn('Fallo llamada Gemini API (revisar GEMINI_API_KEY o cuota):', err.message);
      }
    }

    // 8. Motor de Contingencia Cevechero (Fallback Inteligente con Carta Real)
    const q = mensajeActual.toLowerCase();
    const esReemplazo = q.includes('cámbialo') || q.includes('cambialo') || q.includes('cambiar') || q.includes('otro') || q.includes('quita');
    const sinPicante = q.includes('sin mucho picante') || q.includes('sin picante') || q.includes('no picante') || q.includes('suave');
    const resaca = q.includes('resaca') || q.includes('levantamuertos') || q.includes('frio') || q.includes('caliente');

    const ceviche = catalogoPlatos.find(p => p.nombre.toLowerCase().includes(resaca ? 'mixto' : 'clásico')) || catalogoPlatos[0];
    const bebida = catalogoPlatos.find(p => p.categoria.toLowerCase().includes('bebida')) || null;
    const tiradito = catalogoPlatos.find(p => p.nombre.toLowerCase().includes('tiradito'));

    const sugeridos = [];
    const elegirOpciones = (plato) => {
      if (!plato) return { ids: [], nombres: [], extras: 0 };
      const ids = [];
      const nombres = [];
      let extras = 0;
      const ajiOp = plato.opciones_disponibles.find(o =>
        sinPicante
          ? o.nombre.toLowerCase().includes('suave') || o.nombre.toLowerCase().includes('sin ají')
          : o.nombre.toLowerCase().includes('normal')
      );
      if (ajiOp) {
        ids.push(ajiOp.id_opcion);
        nombres.push(ajiOp.nombre);
        extras += ajiOp.precio_adicional;
      }
      const pescadoOp = plato.opciones_disponibles.find(o => o.nombre.toLowerCase().includes('pesca'));
      if (pescadoOp) {
        ids.push(pescadoOp.id_opcion);
        nombres.push(pescadoOp.nombre);
        extras += pescadoOp.precio_adicional;
      }
      return { ids, nombres, extras };
    };

    if (esReemplazo && tiradito) {
      const opts = elegirOpciones(tiradito);
      sugeridos.push({
        id_plato: tiradito.id_plato,
        nombre_plato: tiradito.nombre,
        cantidad: 1,
        precio_unitario: Number((tiradito.precio_base + opts.extras).toFixed(2)),
        opciones_ids: opts.ids,
        nombres_opciones: opts.nombres
      });
    } else if (ceviche) {
      const opts = elegirOpciones(ceviche);
      sugeridos.push({
        id_plato: ceviche.id_plato,
        nombre_plato: ceviche.nombre,
        cantidad: 1,
        precio_unitario: Number((ceviche.precio_base + opts.extras).toFixed(2)),
        opciones_ids: opts.ids,
        nombres_opciones: opts.nombres
      });
    }

    if ((q.includes('2') || q.includes('70') || q.includes('combo')) && tiradito && !sugeridos.some(s => s.id_plato === tiradito.id_plato)) {
      const opts = elegirOpciones(tiradito);
      sugeridos.push({
        id_plato: tiradito.id_plato,
        nombre_plato: tiradito.nombre,
        cantidad: 1,
        precio_unitario: Number((tiradito.precio_base + opts.extras).toFixed(2)),
        opciones_ids: opts.ids,
        nombres_opciones: opts.nombres
      });
    }

    if (bebida && sugeridos.length < 3) {
      sugeridos.push({
        id_plato: bebida.id_plato,
        nombre_plato: bebida.nombre,
        cantidad: 1,
        precio_unitario: Number(bebida.precio_base.toFixed(2)),
        opciones_ids: [],
        nombres_opciones: []
      });
    }

    const total = Number(sugeridos.reduce((s, it) => s + it.precio_unitario * it.cantidad, 0).toFixed(2));
    const msg = resaca
      ? '¡Uy causa, esa Parihuela levanta hasta a un muerto! Te la pongo bien taypá con su arroz blanco para que quedes como nuevo.'
      : sinPicante
        ? '¡Al toque sobrino! Te preparo un Ceviche de Pescado sin ají, suavecito pero con harto limón recién exprimido, acompañado de unos Tequeños de Pulpo. ¡Queda preciso!'
        : (q.includes('2') || q.includes('70'))
          ? '¡Habla causa! Con 70 soles para dos te armo un combo bravazo: un Ceviche Clásico bien fresco y su Chicharrón de Pescado crocante para compartir. ¿Lo mandamos al carrito?'
          : esReemplazo
            ? '¡Al toque causita! Te lo cambio por este Tiradito bien fresco en crema de ají amarillo. ¡Queda de lujo!'
            : '¡Habla mi rey! Te armé este combo bravazo y bien taypá con la pesca del día fresca, su canchita y su leche de tigre al toque. ¿Lo mandamos al carrito?';

    return {
      mensaje_lucho: msg,
      respuesta: msg,
      accion: esReemplazo ? 'REEMPLAZAR_SUGERENCIA' : (sugeridos.length > 0 ? 'SUGERIR_COMBO' : 'SOLO_CONVERSACION'),
      items_sugeridos: sugeridos,
      total_estimado: total,
      preguntas_rapidas: ['¿Con qué bebida marida?', 'Cámbialo por Tiradito', '¿Cuánto demora en salir?'],
      modelo: 'fallback-cevichero'
    };
  }
};

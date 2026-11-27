import { ai } from '../config/gemini.js';
import { CartaService } from './cartaService.js';

export const IaService = {
  async recomendar({ mensaje_cliente, contexto_pedido }) {
    // 1. Obtener carta completa de platos disponibles con sus opciones de personalización
    const categorias = await CartaService.obtenerCarta();
    const catalogoPlatos = [];

    categorias.forEach(cat => {
      (cat.platos || []).forEach(p => {
        if (p.disponible === false) return;
        const opciones = [];
        (p.grupos_opciones || []).forEach(g => {
          const ops = g?.opciones || g?.opciones_personalizacion || [];
          ops.forEach(op => {
            if (op.disponible !== false) {
              opciones.push({
                id_opcion: op.id_opcion,
                grupo: g.nombre,
                nombre: op.nombre,
                precio_adicional: Number(op.precio_adicional || 0)
              });
            }
          });
        });

        catalogoPlatos.push({
          id_plato: p.id_plato,
          categoria: cat.nombre,
          nombre: p.nombre,
          precio_base: Number(p.precio_base),
          descripcion: p.descripcion,
          opciones_disponibles: opciones
        });
      });
    });

    const promptSistema = `
Eres "Don Lucho", el maestro cevichero peruano de la cevichería "SIN ESPINAS".
Eres cercano, amigable, experto en maridajes marinos y usas expresiones peruanas naturales con mucho respeto (ej. "causita", "buen provecho", "al toque", "fresco del día").

TU MISIÓN:
Recomendar platos reales de la carta de SIN ESPINAS según lo que pide el comensal, y armar un combo exacto listo para agregar al carrito.

REGLAS ESTRICTAS:
1. Usa ÚNICAMENTE id_plato, nombre, precio_base y id_opcion que existan en el CATÁLOGO DISPONIBLE de abajo.
2. Si el cliente pide un presupuesto o cantidad de personas, respeta el presupuesto aproximado y arma una combinación equilibrada (entrada/ceviche + plato fuerte/jalea + bebida si alcanza).
3. Para cada plato en "items_sugeridos", calcula "precio_unitario" como (precio_base + suma de precio_adicional de las opciones elegidas) y "total_estimado" como la suma de (precio_unitario * cantidad) de todos los ítems.
4. Si un plato tiene opciones disponibles de nivel de ají o tipo de pescado, elige las opciones más adecuadas (por ejemplo si pide "sin mucho picante", elige "Sin Ají" o "Ají Suave").
5. Devuelve SIEMPRE un JSON válido con esta estructura exacta:
{
  "mensaje_lucho": "Respuesta conversacional de Don Lucho explicando la recomendación",
  "items_sugeridos": [
    {
      "id_plato": 1,
      "nombre_plato": "Ceviche Clásico de Pescado",
      "cantidad": 1,
      "precio_unitario": 34.00,
      "opciones_ids": [3, 5],
      "nombres_opciones": ["Ají Normal", "Pesca del Día"]
    }
  ],
  "total_estimado": 34.00
}

CATÁLOGO DISPONIBLE (JSON):
${JSON.stringify(catalogoPlatos)}

CONTEXTO DEL PEDIDO ACTUAL DEL CLIENTE:
${JSON.stringify(contexto_pedido || {})}
    `.trim();

    // 2. Llamar a @google/genai con gemini-2.5-flash y responseMimeType: "application/json"
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          config: {
            responseMimeType: 'application/json'
          },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `${promptSistema}\n\nSolicitud del comensal: "${mensaje_cliente || '¿Qué me recomiendas para almorzar rico hoy?'}"`
                }
              ]
            }
          ]
        });

        if (response && response.text) {
          const parsed = JSON.parse(response.text);
          // Sanitizar y validar que los platos existan en catálogo
          const itemsValidos = (Array.isArray(parsed.items_sugeridos) ? parsed.items_sugeridos : [])
            .map(item => {
              const real = catalogoPlatos.find(p => p.id_plato === Number(item.id_plato));
              if (!real) return null;
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

          const totalCalculado = Number(
            itemsValidos.reduce((s, it) => s + it.precio_unitario * it.cantidad, 0).toFixed(2)
          );

          return {
            mensaje_lucho: parsed.mensaje_lucho || '¡Aquí tienes una recomendación fresquita de SIN ESPINAS!',
            respuesta: parsed.mensaje_lucho || '¡Aquí tienes una recomendación fresquita de SIN ESPINAS!',
            items_sugeridos: itemsValidos,
            total_estimado: totalCalculado,
            modelo: 'gemini-2.5-flash'
          };
        }
      } catch (err) {
        console.warn('Fallo llamada Gemini API (revisar GEMINI_API_KEY):', err.message);
      }
    }

    // 3. Fallback inteligente estructurado usando platos reales de la carta
    const q = (mensaje_cliente || '').toLowerCase();
    const sinPicante = q.includes('sin mucho picante') || q.includes('sin picante') || q.includes('no picante');
    const resaca = q.includes('resaca') || q.includes('levantamuertos');

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

    if (ceviche) {
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

    if ((q.includes('2') || q.includes('70') || sinPicante) && tiradito && tiradito.id_plato !== ceviche?.id_plato) {
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

    if (bebida) {
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
      ? '¡Habla causita! Para levantar el ánimo al toque te recomiendo nuestro Ceviche bien fresquito con su Chicha helada. ¡Te deja como nuevo!'
      : sinPicante
        ? '¡Claro que sí! Te armé una combinación fresca y suavecita en ají para que disfrutes todo el sabor marino de SIN ESPINAS sin picar de más.'
        : '¡Bienvenido a SIN ESPINAS! Te armé este combo fresquito del día con el maridaje perfecto. Si te provoca, agrégalo al carrito con un clic.';

    return {
      mensaje_lucho: msg,
      respuesta: msg,
      items_sugeridos: sugeridos,
      total_estimado: total,
      modelo: 'fallback-cevichero'
    };
  }
};

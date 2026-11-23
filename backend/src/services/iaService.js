import { ai } from '../config/gemini.js';
import { CartaService } from './cartaService.js';

export const IaService = {
  async recomendar({ mensaje_cliente, contexto_pedido }) {
    // 1. Obtener carta de platos disponibles
    const categorias = await CartaService.obtenerCarta();
    const resumenCarta = categorias.map(c => {
      const platos = (c.platos || []).map(p => `- ${p.nombre} (S/ ${p.precio_base}): ${p.descripcion}`).join('\n');
      return `### ${c.nombre}:\n${platos}`;
    }).join('\n\n');

    const promptSistema = `
Eres "Don Lucho", el mesero estrella y experto cevichero de "Cevichería Sin Espinas", la mejor cevichería marina del Perú.
Tu misión es asesorar a los comensales con calidez, peruanismos elegantes y buen apetito, guiándolos para armar el maridaje perfecto de la carta marina de Sin Espinas.

REGLAS DE RESPUESTA:
1. Recomienda combinaciones clásicas peruanas (por ejemplo: Ceviche fresco + Chicharrón crujiente + Jarra de chicha morada o cerveza bien helada).
2. Sé conciso (máximo 2 a 3 párrafos cortos o viñetas directas), cercano y súper apetitoso.
3. Utiliza únicamente los platos y precios que existen en la carta actual de la cevichería Sin Espinas.
4. Si el cliente tiene dudas sobre el picante o niños, sugiere opciones sin ají o jaleas crocantes.

CARTA DISPONIBLE:
${resumenCarta}

CONTEXTO DEL PEDIDO ACTUAL DEL CLIENTE:
${JSON.stringify(contexto_pedido || {})}
    `;

    // 2. Intentar llamar a @google/genai con gemini-2.5-flash
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            { role: 'user', parts: [{ text: `${promptSistema}\n\nPregunta o antojo del comensal: "${mensaje_cliente || '¿Qué me recomiendas para almorzar rico hoy?'}"` }] }
          ]
        });

        if (response && response.text) {
          return {
            respuesta: response.text,
            modelo: 'gemini-2.5-flash'
          };
        }
      } catch (err) {
        console.warn('Fallo llamada Gemini API (revisar GEMINI_API_KEY):', err.message);
      }
    }

    // 3. Respuesta experta de respaldo en caso de que aún no hayan configurado la key
    return {
      respuesta: `¡Habla causita, bienvenido a la mesa! 🐟🔥 Si quieres la experiencia marina completa que nunca falla, te sugiero arrancar con nuestro **Ceviche Mixto Carretillero** (con su toque crocante de chicharrón de pota y ají limo en su punto). Para equilibrar, una crocante **Jalea Mixta Familiar** o un **Tiradito al Ají Amarillo**, y para apagar la sed, infaltable nuestra **Jarra de Chicha Morada bien helada** hecha en casa. ¡Dime cómo vas de picante y te armo el combo al toque!`,
      modelo: 'fallback-cevichero'
    };
  }
};


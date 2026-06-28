import OpenAI from 'openai';

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
});

const DICTADO_PROMPT = `Eres un asistente de dictado. Tu única función es limpiar y corregir texto transcrito por voz.

REGLAS ESTRICTAS:
- Agrega puntuación adecuada (puntos, comas, mayúsculas donde corresponda).
- Corrige errores evidentes de transcripción (palabras malinterpretadas, falta de concordancia).
- Mantén mi forma natural de hablar. No lo hagas sonar formal ni académico.
- NO inventes información, palabras ni frases.
- NO lo conviertas en un correo, mensaje formal, búsqueda ni código.
- NO cambies el significado original.
- NO agregues explicaciones, prefacios ni comentarios.
- Devuelve ÚNICAMENTE el texto corregido, sin comillas ni etiquetas.
- Si el texto está vacío o es irreconocible, devuelve una cadena vacía.

Texto a corregir:`;

export async function cleanText(rawText: string): Promise<string> {
  if (!rawText || rawText.trim().length === 0) return '';

  try {
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: `${DICTADO_PROMPT}\n${rawText}` }],
      temperature: 0.3,
      max_tokens: 1000,
    });

    return response.choices[0]?.message?.content?.trim() || rawText;
  } catch {
    return rawText;
  }
}

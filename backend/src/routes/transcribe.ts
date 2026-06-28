import { Router } from "express";
import multer from "multer";
import OpenAI from "openai";

export const transcriptionRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// ─── Cliente para transcripción (Whisper) ───
function getTranscriber() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

// ─── Cliente para refinamiento de texto (DeepSeek desde Hermes) ───
function getTextModel() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    baseURL: "https://api.deepseek.com",
  });
}

const SYSTEM_PROMPTS: Record<string, string> = {
  chat: "Eres un asistente que transcribe voz a texto para enviar un mensaje de chat o WhatsApp.\n- Escribe en lenguaje natural, como si la persona estuviera hablando.\n- No añadas markdown, emojis ni formato.\n- Corrige pequeñas pausas y muletillas.\n- Mantén el tono conversacional del hablante.",
  email: "Eres un asistente que redacta correos electrónicos a partir de voz.\n- Convierte el dictado en un email bien estructurado.\n- Añade asunto (subject) al inicio si es claro del contexto.\n- Usa saludo y despedida profesional.\n- Corrige la gramática y estructura.",
  search: "Eres un asistente que convierte voz en consultas de búsqueda.\n- Limpia el dictado dejando solo palabras clave relevantes.\n- Elimina muletillas, pausas y palabras de relleno.\n- Devuelve únicamente el texto de búsqueda, sin explicaciones.",
  notes: "Eres un asistente que toma notas a partir de dictado de voz.\n- Estructura la información en párrafos cortos.\n- Usa viñetas (-) cuando hay listas o ideas múltiples.\n- Preserva fechas, nombres y números importantes.",
  code: "Eres un asistente que transcribe voz a código.\n- Convierte descripciones verbales en código funcional.\n- Detecta el lenguaje de programación del contexto.\n- El output debe ser código ejecutable, no pseudocódigo.",
};

transcriptionRouter.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    const startTime = Date.now();
    const file = req.file;
    const mode = (req.body.mode || "notes") as string;
    const language = (req.body.language || "es") as string;

    if (!file) {
      return res.status(400).json({ error: "No se envió archivo de audio" });
    }

    const whisper = getTranscriber();
    const textModel = getTextModel();
    const systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.notes;

    // ─── 1. Transcripción ───
    let finalText = "";

    if (whisper) {
      // Usar OpenAI Whisper
      const transcription = await whisper.audio.transcriptions.create({
        model: "whisper-1",
        file: new File([file.buffer], "audio.webm", { type: file.mimetype }),
        language: language === "es" ? "es" : language === "en" ? "en" : undefined,
        response_format: "text",
      });
      finalText = transcription as string;
    } else {
      // Fallback: devolver audio como base64 para que el cliente lo procese
      // o pedir al usuario que configure OPENAI_API_KEY
      return res.status(400).json({
        error: "Se necesita OPENAI_API_KEY para transcripción.",
        hint: "Configura OPENAI_API_KEY en backend/.env para usar Whisper.",
        docs: "https://platform.openai.com/api-keys",
      });
    }

    // ─── 2. Refinamiento con DeepSeek (excepto modo search) ───
    if (mode !== "search" && textModel) {
      try {
        const completion = await textModel.chat.completions.create({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Transcripción cruda: "${finalText}"\n\nDevuelve solo el texto refinado, sin explicaciones.` },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        });
        const refined = completion.choices[0]?.message?.content?.trim();
        if (refined) finalText = refined;
      } catch (refineErr) {
        console.warn("Refinamiento con DeepSeek falló, usando transcripción cruda:", refineErr);
      }
    }

    res.json({
      text: finalText,
      provider: whisper ? "openai+deepseek" : "deepseek",
      duration: ((Date.now() - startTime) / 1000),
      mode,
      language,
    });
  } catch (err: any) {
    console.error("Error en transcripción:", err);
    res.status(500).json({ error: err.message || "Error interno del servidor" });
  }
});

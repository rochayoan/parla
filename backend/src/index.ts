import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { transcribeAudio } from './transcribe';
import { cleanText } from './clean';

const app = express();
const PORT = process.env.PORT || 3001;
const APP_SECRET = process.env.APP_SECRET || '';
const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB

// Temp dir for audio uploads
const TEMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// Multer config
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TEMP_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `parla-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_AUDIO_SIZE },
  fileFilter: (_req, file, cb) => {
    const allowed = ['audio/webm', 'audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/x-wav'];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(webm|wav|mp3|ogg|m4a)$/i)) {
      cb(null, true);
    } else {
      cb(new Error(`Formato de audio no soportado: ${file.mimetype}`));
    }
  },
});

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0', mode: 'dictado' });
});

// Transcribe endpoint
app.post('/api/transcribe', upload.single('file'), async (req, res) => {
  const startTime = Date.now();

  try {
    const { appSecret, language = 'es', mode = 'dictado' } = req.body;

    // Validate APP_SECRET
    if (APP_SECRET && appSecret !== APP_SECRET) {
      // Clean up temp file
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(401).json({ success: false, error: 'APP_SECRET inválido' });
    }

    // Validate file
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se recibió archivo de audio' });
    }

    // Validate file size
    if (req.file.size < 100) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ success: false, error: 'El audio está vacío o es demasiado corto' });
    }

    // Step 1: Transcribe with Whisper
    const rawText = await transcribeAudio(req.file.path, language);

    if (!rawText || rawText.trim().length === 0) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ success: false, error: 'No se pudo transcribir el audio. ¿Hay voz grabada?' });
    }

    // Step 2: Clean text with GPT
    const finalText = await cleanText(rawText, mode);

    // Clean up temp file
    fs.unlink(req.file.path, () => {});

    const durationMs = Date.now() - startTime;

    res.json({
      success: true,
      rawText,
      finalText: finalText || rawText,
      language,
      mode: 'dictado',
      provider: 'openai',
      durationMs,
    });
  } catch (error: any) {
    // Clean up temp file on error
    if (req.file) fs.unlink(req.file.path, () => {});

    console.error('Error en transcribe:', error.message);

    // Don't expose internal errors to client
    res.status(500).json({
      success: false,
      error: 'Error al procesar el audio. Intenta de nuevo.',
    });
  }
});

// Error handler for multer
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, error: 'El audio es demasiado grande (máximo 25MB)' });
    }
    return res.status(400).json({ success: false, error: err.message });
  }
  if (err.message?.includes('no soportado')) {
    return res.status(400).json({ success: false, error: err.message });
  }
  console.error('Error:', err);
  res.status(500).json({ success: false, error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`🎙️ Parla backend corriendo en http://localhost:${PORT}`);
  console.log(`   Modo: dictado único`);
});

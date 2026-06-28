import { useState, useRef, useCallback } from 'react';
import './App.css';

type Mode = 'chat' | 'email' | 'search' | 'notes' | 'code';
type Lang = 'es' | 'en' | 'pt';

const MODES: { key: Mode; label: string; icon: string }[] = [
  { key: 'chat', label: 'Chat', icon: '💬' },
  { key: 'email', label: 'Email', icon: '📧' },
  { key: 'search', label: 'Buscar', icon: '🔍' },
  { key: 'notes', label: 'Notas', icon: '📝' },
  { key: 'code', label: 'Código', icon: '💻' },
];

const LANGUAGES: { key: Lang; label: string }[] = [
  { key: 'es', label: 'Español' },
  { key: 'en', label: 'English' },
  { key: 'pt', label: 'Português' },
];

function App() {
  const [mode, setMode] = useState<Mode>('chat');
  const [lang, setLang] = useState<Lang>('es');
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      setError('');
      setResult('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunks.current = [];
      mediaRecorder.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks.current, { type: 'audio/webm' });
        await sendToBackend(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      setRecording(true);
    } catch (err) {
      setError('No se pudo acceder al micrófono. Verifica los permisos.');
    }
  }, [mode, lang]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
      setRecording(false);
    }
  }, []);

  const sendToBackend = async (audioBlob: Blob) => {
    setTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      formData.append('mode', mode);
      formData.append('language', lang);

      const res = await fetch('http://localhost:3001/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
      const data = await res.json();
      setResult(data.text || '');
    } catch (err: any) {
      setError(err.message || 'Error al transcribir');
    } finally {
      setTranscribing(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('No se pudo copiar al portapapeles');
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Parla</h1>
        <p className="subtitle">Dictado por voz</p>
      </header>

      <section className="controls">
        <div className="mode-selector">
          <label>Modo</label>
          <div className="mode-buttons">
            {MODES.map((m) => (
              <button
                key={m.key}
                className={`mode-btn ${mode === m.key ? 'active' : ''}`}
                onClick={() => setMode(m.key)}
                disabled={recording || transcribing}
              >
                <span className="mode-icon">{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="lang-selector">
          <label>Idioma</label>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            disabled={recording || transcribing}
          >
            {LANGUAGES.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="recorder">
        <button
          className={`record-btn ${recording ? 'recording' : ''}`}
          onClick={recording ? stopRecording : startRecording}
          disabled={transcribing}
        >
          {recording ? '⏹ Detener' : transcribing ? '⏳ Transcribiendo...' : '🎤 Grabar'}
        </button>
      </section>

      {error && <div className="error">{error}</div>}

      {result && (
        <section className="result">
          <div className="result-header">
            <h2>Resultado</h2>
            <button className="copy-btn" onClick={copyToClipboard}>
              {copied ? '✅ Copiado' : '📋 Copiar'}
            </button>
          </div>
          <textarea readOnly value={result} rows={6} />
        </section>
      )}
    </div>
  );
}

export default App;

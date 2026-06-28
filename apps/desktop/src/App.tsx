import { useState, useRef, useCallback, useEffect } from 'react';
import './App.css';

type Mode = 'chat' | 'email' | 'search' | 'notes' | 'code';
type Lang = 'es' | 'en' | 'pt';
type Status = 'idle' | 'recording' | 'transcribing' | 'done';

const LANGUAGES: Record<Lang, string> = {
  es: 'ES',
  en: 'EN',
  pt: 'PT',
};

function App() {
  const [mode, setMode] = useState<Mode>('chat');
  const [lang, setLang] = useState<Lang>('es');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startTime = useRef(0);

  const modeIcon: Record<Mode, string> = {
    chat: '💬',
    email: '📧',
    search: '🔍',
    notes: '📝',
    code: '💻',
  };

  // Auto-show on mount, ping backend
  useEffect(() => {
    fetch('http://localhost:3001/api/health')
      .catch(() => setError('Backend no disponible'));
  }, []);

  // Auto-hide 1.5s after done
  useEffect(() => {
    if (status === 'done') {
      const t = setTimeout(() => setStatus('idle'), 1500);
      return () => clearTimeout(t);
    }
  }, [status]);

  const startRecording = useCallback(async () => {
    try {
      setError('');
      chunks.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
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
      startTime.current = Date.now();
      setStatus('recording');
    } catch {
      setError('Micrófono no disponible');
    }
  }, [mode, lang]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
    }
  }, []);

  const sendToBackend = async (audioBlob: Blob) => {
    setStatus('transcribing');
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      formData.append('mode', mode);
      formData.append('language', lang);

      const res = await fetch('http://localhost:3001/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      const text = data.text || '';

      if (text && (window as any).parla?.paste) {
        (window as any).parla.paste(text);
      }
      setStatus('done');
    } catch (err: any) {
      setError(err.message || 'Error');
      setStatus('idle');
    }
  };

  const handleClick = () => {
    if (status === 'recording') {
      stopRecording();
    } else if (status === 'idle' || status === 'done') {
      startRecording();
    }
  };

  const buttonContent = () => {
    switch (status) {
      case 'idle': return '🎤';
      case 'recording': return '⏹';
      case 'transcribing': return '⏳';
      case 'done': return '✅';
    }
  };

  const buttonClass = () => {
    switch (status) {
      case 'recording': return 'record-btn recording';
      case 'transcribing': return 'record-btn transcribing';
      case 'done': return 'record-btn done';
      default: return 'record-btn';
    }
  };

  return (
    <div className="overlay" onMouseEnter={() => setShowSettings(true)} onMouseLeave={() => setShowSettings(false)}>
      {/* Main button row */}
      <div className="row">
        <button className={buttonClass()} onClick={handleClick} disabled={status === 'transcribing'}>
          {buttonContent()}
        </button>
        {status === 'recording' && <span className="status-recording">● Grabando</span>}
        {status === 'transcribing' && <span className="status-transcribing">Transcribiendo...</span>}
        {status === 'done' && <span className="status-done">✱ Pegado</span>}
      </div>

      {/* Settings (show on hover) */}
      {showSettings && status !== 'recording' && status !== 'transcribing' && (
        <div className="settings">
          <div className="mode-icons">
            {(Object.entries(modeIcon) as [Mode, string][]).map(([key, icon]) => (
              <button
                key={key}
                className={`mode-icon-btn ${mode === key ? 'active' : ''}`}
                onClick={() => setMode(key)}
                title={key}
              >
                {icon}
              </button>
            ))}
          </div>
          <select
            className="lang-select"
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
          >
            {Object.entries(LANGUAGES).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      )}

      {error && <div className="error">{error}</div>}
    </div>
  );
}

export default App;

import { useState, useRef, useCallback, useEffect } from 'react';
import './App.css';

type Mode = 'chat' | 'email' | 'search' | 'notes' | 'code';
type Lang = 'es' | 'en' | 'pt';
type Status = 'idle' | 'recording' | 'transcribing' | 'done' | 'error';

function App() {
  const [mode, setMode] = useState<Mode>('chat');
  const [lang, setLang] = useState<Lang>('es');
  const [status, setStatus] = useState<Status>('idle');
  const [showSettings, setShowSettings] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  // Notify main process about recording state
  useEffect(() => {
    const isRecording = status === 'recording';
    (window as any).parla?.recording(isRecording);
  }, [status]);

  // Reset idle after done
  useEffect(() => {
    if (status === 'done') {
      const t = setTimeout(() => setStatus('idle'), 1200);
      return () => clearTimeout(t);
    }
    if (status === 'error') {
      const t = setTimeout(() => setStatus('idle'), 2000);
      return () => clearTimeout(t);
    }
  }, [status]);

  const startRecording = useCallback(async () => {
    try {
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
      setStatus('recording');
    } catch {
      setStatus('error');
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
      setStatus(text ? 'done' : 'error');
    } catch {
      setStatus('error');
    }
  };

  const handleClick = () => {
    if (status === 'recording') {
      stopRecording();
    } else if (status === 'idle') {
      startRecording();
    }
  };

  const barClass = () => {
    switch (status) {
      case 'recording': return 'bar recording';
      case 'transcribing': return 'bar transcribing';
      case 'done': return 'bar done';
      case 'error': return 'bar error';
      default: return 'bar';
    }
  };

  return (
    <div
      className="overlay"
      onMouseEnter={() => setShowSettings(true)}
      onMouseLeave={() => setShowSettings(false)}
      onClick={handleClick}
    >
      <div className="bar-wrap">
        <div className={barClass()}>
          <div className="bar-fill" />
          <div className="wave-container">
            <span className="wave w1" />
            <span className="wave w2" />
            <span className="wave w3" />
          </div>
        </div>
      </div>

      {showSettings && status === 'idle' && (
        <div className="settings">
          <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            <option value="chat">💬 Chat</option>
            <option value="email">📧 Email</option>
            <option value="search">🔍 Búsqueda</option>
            <option value="notes">📝 Notas</option>
            <option value="code">💻 Código</option>
          </select>
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            <option value="es">ES</option>
            <option value="en">EN</option>
            <option value="pt">PT</option>
          </select>
        </div>
      )}
    </div>
  );
}

export default App;

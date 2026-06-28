const state = {
  recording: false,
  processing: false,
  mode: "notes",
  language: "es",
  transcribedText: "",
  error: null,
  mediaRecorder: null,
  audioChunks: [],
};

const MODES = [
  { id: "chat", icon: "💬", label: "Chat" },
  { id: "email", icon: "✉️", label: "Correo" },
  { id: "search", icon: "🔍", label: "Busqueda" },
  { id: "notes", icon: "📝", label: "Notas" },
  { id: "code", icon: "💻", label: "Codigo" },
];

const LANGUAGES = [
  { code: "es", native: "Espanol", status: "ready" },
  { code: "en", native: "English", status: "ready" },
  { code: "pt", native: "Portugues", status: "beta" },
  { code: "qu", native: "Runasimi", status: "future" },
  { code: "ay", native: "Aymar aru", status: "future" },
];

const $ = (id) => document.getElementById(id);
const recordBtn = $("recordBtn");
const statusText = $("statusText");
const resultBox = $("resultBox");
const copyBtn = $("copyBtn");
const pasteBtn = $("pasteBtn");
const errorText = $("errorText");

function renderModes() {
  $("modeSelector").innerHTML = MODES.map((m) =>
    `<button class="mode-btn ${m.id === state.mode ? "active" : ""}" data-mode="${m.id}">${m.icon} ${m.label}</button>`
  ).join("");
  $("modeSelector").querySelectorAll(".mode-btn").forEach((b) => {
    b.onclick = () => { state.mode = b.dataset.mode; renderModes(); };
  });
}

function renderLanguages() {
  $("langSelector").innerHTML = LANGUAGES.map((l) =>
    `<button class="lang-btn ${l.code === state.language ? "active" : ""} ${l.status === "future" ? "future" : ""}" data-lang="${l.code}" ${l.status === "future" ? "disabled" : ""}>${l.native}</button>`
  ).join("");
  $("langSelector").querySelectorAll(".lang-btn:not(.future)").forEach((b) => {
    b.onclick = () => { state.language = b.dataset.lang; renderLanguages(); };
  });
}

renderModes();
renderLanguages();

recordBtn.onclick = async () => {
  if (state.processing) return;
  state.recording ? stopRecording() : await startRecording();
};

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus" : "audio/webm";

    state.mediaRecorder = new MediaRecorder(stream, { mimeType });
    state.audioChunks = [];
    state.recording = true;
    state.error = null;

    state.mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) state.audioChunks.push(e.data); };
    state.mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(state.audioChunks, { type: mimeType });
      await processAudio(blob, mimeType);
    };

    state.mediaRecorder.start();
    updateUI();
  } catch (err) {
    state.error = "Error al acceder al microfono: " + err.message;
    updateUI();
  }
}

function stopRecording() {
  if (state.mediaRecorder && state.mediaRecorder.state !== "inactive") {
    state.mediaRecorder.stop();
    state.recording = false;
    state.processing = true;
    updateUI();
  }
}

async function processAudio(blob, mimeType) {
  try {
    statusText.textContent = "Transcribiendo...";
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const result = await window.parla.transcribeAudio(base64, mimeType, state.mode, state.language);
    state.transcribedText = result.text;
    state.processing = false;
    updateUI();

    if (result.text) {
      resultBox.textContent = result.text;
      resultBox.classList.add("show");
      await window.parla.copyToClipboard(result.text);
    }
  } catch (err) {
    state.processing = false;
    state.error = err.message || "Error de transcripcion";
    updateUI();
  }
}

copyBtn.onclick = async () => {
  if (!state.transcribedText) return;
  await window.parla.copyToClipboard(state.transcribedText);
  copyBtn.textContent = "Copiado";
  setTimeout(() => { copyBtn.textContent = "Copiar"; }, 2000);
};

pasteBtn.onclick = async () => {
  if (!state.transcribedText) return;
  await window.parla.copyToClipboard(state.transcribedText);
  pasteBtn.textContent = "Listo";
  setTimeout(() => { pasteBtn.textContent = "Pegar (Ctrl+V)"; }, 2000);
};

function updateUI() {
  if (state.recording) {
    recordBtn.className = "record-btn recording";
    recordBtn.textContent = "⏹️";
    statusText.textContent = "Grabando... Toca para detener";
  } else if (state.processing) {
    recordBtn.className = "record-btn processing";
    recordBtn.textContent = "⏳";
  } else {
    recordBtn.className = "record-btn";
    recordBtn.textContent = "🎤";
    statusText.textContent = state.transcribedText
      ? "Dictado listo (copiado al portapapeles)"
      : "Toca para dictar";
  }
  copyBtn.disabled = !state.transcribedText;
  pasteBtn.disabled = !state.transcribedText;
  errorText.textContent = state.error || "";
}

document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
    e.preventDefault();
    recordBtn.click();
  }
  if (e.code === "Escape") {
    state.transcribedText = "";
    resultBox.classList.remove("show");
    resultBox.textContent = "";
    updateUI();
  }
});

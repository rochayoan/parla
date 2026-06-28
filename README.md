# 🎙️ Parla — Habla. Parla escribe.

Dictado inteligente para desktop. Presionás un atajo, hablás, y Parla pega el texto donde esté tu cursor.

## Stack

| Capa | Tecnología |
|------|-----------|
| **Desktop** | Electron + React + TypeScript |
| **Backend** | Express + TypeScript + tsx |
| **Transcripción** | OpenAI Whisper (Speech-to-Text) |
| **Corrección** | OpenAI GPT-4o-mini |
| **MonoRepo** | pnpm workspaces |

## Estructura

```
parla/
├── backend/             # API Express
│   ├── src/
│   │   ├── index.ts     # Servidor (health + transcribe)
│   │   ├── transcribe.ts # Whisper → texto crudo
│   │   └── clean.ts     # GPT → texto limpio
│   ├── .env             # OPENAI_API_KEY acá
│   └── package.json
├── apps/
│   └── desktop/         # Electron + React
│       ├── electron/
│       │   ├── main.cjs    # Proceso principal
│       │   └── preload.cjs # Bridge IPC
│       ├── src/
│       │   ├── App.tsx     # UI principal
│       │   ├── App.css     # Estilos
│       │   └── main.tsx    # Entry React
│       └── package.json
├── packages/
│   ├── shared/          # Tipos compartidos
│   │   └── src/index.ts
│   └── prompts/         # Prompts para corrección
│       └── src/index.ts
├── package.json         # Root scripts
└── README.md
```

## Requisitos

- **Node.js** 18+
- **pnpm** (opcional, podés usar npm)
- **OpenAI API Key**

## Variables de entorno

Crear `backend/.env`:

```env
OPENAI_API_KEY=sk-tu-key-aqui
PORT=3001                              # opcional
APP_SECRET=mi-secreto-opcional         # opcional
```

## Instalación y arranque

```bash
# 1. Instalar dependencias del backend
cd backend && npm install

# 2. Arrancar backend
npm run dev
# → http://localhost:3001
# → GET /api/health → {"status":"ok"}

# 3. En otra terminal, instalar desktop
cd apps/desktop && npm install

# 4. Arrancar desktop
npm run dev
# → Se abre ventana de Parla
# → Se conecta a http://localhost:3001
```

## Cómo usar

1. Abrí cualquier app donde quieras escribir (WhatsApp Web, ChatGPT, VS Code, etc.)
2. Poné el cursor en el campo de texto
3. Presioná **Ctrl + Alt + Espacio** (o clickeá el botón 🎤)
4. Hablá
5. Volvé a presionar **Ctrl + Alt + Espacio** (o clickeá ⏹)
6. ✨ Parla pega el texto automáticamente

### Estados visuales

| Estado | Significado |
|--------|------------|
| 🟢 Listo | Esperando tu comando |
| 🔴 Grabando | Está escuchando |
| 🟡 Procesando | Enviando al backend |
| 🟢 Copiado | Texto pegado automáticamente ✓ |
| 🟡 Copiado manual | Texto en clipboard, pegalo con Ctrl+V |
| 🔴 Error | Algo salió mal |

## Configuración

Desde la app podés cambiar:

- **Backend URL**: Si corrés el backend en otro puerto o servidor
- **App Secret**: Si configuraste `APP_SECRET` en el backend

## Atajo global

Por defecto: **Ctrl + Alt + Espacio**

Funciona en Windows. Para macOS, cambiar `CommandOrControl` por `Command` en `electron/main.cjs`.

## Probar el backend sin la app

```bash
# Health check
curl http://localhost:3001/api/health

# Transcribir un archivo de audio
curl -X POST http://localhost:3001/api/transcribe \
  -F "file=@recording.webm" \
  -F "language=es" \
  -F "mode=dictado" \
  -F "appSecret=mi-secreto"
```

## Agregar nuevos idiomas

Editar `packages/shared/src/index.ts`:

```ts
{ code: 'qu', name: 'Quechua', status: 'future' },  // cambiar a 'stable'
```

Después implementar el provider en `backend/src/transcribe.ts`.

## Agregar nuevos modos (futuro)

Cuando quieras reintroducir modos:

1. Agregar prompt en `packages/prompts/src/index.ts`
2. Agregar modo en `packages/shared/src/index.ts`
3. Agregar selector en `apps/desktop/src/App.tsx`
4. Pasar `mode` en la petición al backend

## Notas técnicas

### Pegado automático
- En Windows usa PowerShell → `SendKeys` para simular Ctrl+V
- Siempre copia al portapapeles primero (fallback)
- Si falla el pegado, el texto queda en clipboard para pegado manual

### Seguridad
- La `OPENAI_API_KEY` **nunca** está en la app desktop
- Solo vive en `backend/.env`
- La app desktop envía un `APP_SECRET` opcional al backend

### Escalabilidad futura
- `transcriptionProviders` en shared preparado para Whisper local, modelos fine-tune, quechua/aymara
- `languages` con status `future` para quechua, aymara, inglés
- ESLint para almacenar audios con consentimiento explícito

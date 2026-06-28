import OpenAI from 'openai';
import fs from 'fs';
import { createReadStream } from 'fs';

function getOpenAI(): OpenAI {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export async function transcribeAudio(filePath: string, language: string = 'es'): Promise<string> {
  const openai = getOpenAI();
  
  const response = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file: createReadStream(filePath),
    response_format: 'text',
    language: language !== 'auto' ? language : undefined,
  });

  return (typeof response === 'string' ? response : response.text).trim();
}

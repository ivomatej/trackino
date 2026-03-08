// Trackino – AI Chat API endpoint
// Serverová route – API klíče jsou bezpečně na serveru, nikdy v prohlížeči.
// Podpora providerů: OpenAI, Google Gemini (+ připraveno pro Anthropic, Mistral)

import { getProviderForModel, AI_MODELS } from '@/lib/ai-providers';
import type { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Content } from '@google/generative-ai';

export interface AiChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AiChatRequest {
  messages: AiChatMessage[];
  model: string;
  systemPrompt?: string;
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}

// Interní typy pro OpenAI API odpověď
interface OpenAiStreamChunk {
  choices: { delta: { content?: string } }[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}
interface OpenAiResponse {
  choices: { message: { content: string } }[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

// ─── Google Gemini handler ────────────────────────────────────────────────────

async function handleGemini(
  apiKey: string,
  model: string,
  messages: AiChatMessage[],
  systemPrompt: string | undefined,
  stream: boolean,
  temperature: number,
  maxTokens: number | undefined,
) {
  const genAI = new GoogleGenerativeAI(apiKey);

  // Konverze zpráv z OpenAI formátu do Gemini formátu
  // Gemini: role = 'user' | 'model', parts = [{ text }]
  // System prompt se předává jako systemInstruction
  const contents: Content[] = [];
  for (const msg of messages) {
    if (msg.role === 'system') continue; // system prompt se předává zvlášť
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }

  // Extrahuj system prompt z messages (pokud existuje) nebo použij explicitní
  const systemContent = systemPrompt?.trim()
    || messages.find(m => m.role === 'system')?.content?.trim()
    || undefined;

  const genModel = genAI.getGenerativeModel({
    model,
    ...(systemContent ? { systemInstruction: systemContent } : {}),
    generationConfig: {
      temperature,
      ...(maxTokens ? { maxOutputTokens: maxTokens } : {}),
    },
  });

  // Streaming odpověď
  if (stream) {
    const result = await genModel.generateContentStream({ contents });
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          let fullText = '';
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              fullText += text;
              controller.enqueue(encoder.encode(text));
            }
          }

          // Získej usage metadata z finální odpovědi
          const response = await result.response;
          const usage = response.usageMetadata;
          if (usage) {
            const usageData = {
              prompt_tokens: usage.promptTokenCount ?? 0,
              completion_tokens: usage.candidatesTokenCount ?? 0,
              total_tokens: usage.totalTokenCount ?? 0,
            };
            controller.enqueue(encoder.encode(`\n__USAGE__:${JSON.stringify(usageData)}`));
          }
          controller.close();
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Gemini streaming chyba';
          controller.enqueue(encoder.encode(`\n[Chyba: ${errMsg}]`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  // Non-streaming odpověď
  const result = await genModel.generateContent({ contents });
  const response = result.response;
  const content = response.text();
  const usage = response.usageMetadata;

  return Response.json({
    content,
    usage: usage ? {
      prompt_tokens: usage.promptTokenCount ?? 0,
      completion_tokens: usage.candidatesTokenCount ?? 0,
      total_tokens: usage.totalTokenCount ?? 0,
    } : undefined,
  });
}

// ─── OpenAI handler ───────────────────────────────────────────────────────────

async function handleOpenAI(
  apiKey: string,
  baseUrl: string,
  providerName: string,
  model: string,
  allMessages: AiChatMessage[],
  willStream: boolean,
  temperature: number,
  maxTokens: number | undefined,
) {
  const requestBody: Record<string, unknown> = {
    model,
    messages: allMessages,
    stream: willStream,
    temperature,
    ...(maxTokens ? { max_tokens: maxTokens } : {}),
    // Požádat o usage data i ve streamu (OpenAI specifická funkce)
    ...(willStream ? { stream_options: { include_usage: true } } : {}),
  };

  const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    let errMsg = `Chyba od ${providerName} API (HTTP ${aiResponse.status})`;
    try {
      const errJson = JSON.parse(errText) as { error?: { message?: string } };
      if (errJson?.error?.message) errMsg = errJson.error.message;
    } catch { /* ponech obecnou zprávu */ }
    return Response.json({ error: errMsg }, { status: aiResponse.status });
  }

  // Streaming odpověď
  if (willStream) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const readable = new ReadableStream({
      async start(controller) {
        const reader = aiResponse.body?.getReader();
        if (!reader) { controller.close(); return; }

        let buffer = '';
        let lastUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              if (lastUsage) {
                controller.enqueue(encoder.encode(`\n__USAGE__:${JSON.stringify(lastUsage)}`));
              }
              controller.close();
              return;
            }
            try {
              const chunk = JSON.parse(data) as OpenAiStreamChunk;
              const text = chunk.choices?.[0]?.delta?.content ?? '';
              if (text) controller.enqueue(encoder.encode(text));
              if (chunk.usage) lastUsage = chunk.usage;
            } catch { /* přeskoč poškozený chunk */ }
          }
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  // Non-streaming odpověď
  const data = (await aiResponse.json()) as OpenAiResponse;
  const content = data.choices?.[0]?.message?.content ?? '';
  return Response.json({ content, usage: data.usage });
}

// ─── Hlavní POST handler ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AiChatRequest;
    const { messages, model, systemPrompt, stream = true, temperature = 0.7, maxTokens } = body;

    // Validace modelu
    const modelConfig = AI_MODELS.find(m => m.id === model);
    if (!modelConfig) {
      return Response.json({ error: `Neznámý model: ${model}` }, { status: 400 });
    }

    // Načti konfiguraci providera
    const provider = getProviderForModel(model);
    if (!provider) {
      return Response.json({ error: `Konfigurace providera nenalezena pro model: ${model}` }, { status: 400 });
    }

    // Zkontroluj API klíč
    const apiKey = process.env[provider.envKey];
    if (!apiKey) {
      return Response.json(
        { error: `API klíč pro ${provider.name} není nastaven. Přidejte ${provider.envKey} do proměnných prostředí.` },
        { status: 503 }
      );
    }

    // Rozděl dle providera
    if (provider.id === 'google') {
      return handleGemini(apiKey, model, messages, systemPrompt, stream && modelConfig.supportsStreaming, temperature, maxTokens);
    }

    // OpenAI (a budoucí OpenAI-compatible provideri)
    const allMessages: AiChatMessage[] = [
      ...(systemPrompt?.trim() ? [{ role: 'system' as const, content: systemPrompt.trim() }] : []),
      ...messages,
    ];
    const willStream = stream && modelConfig.supportsStreaming;

    return handleOpenAI(apiKey, provider.baseUrl, provider.name, model, allMessages, willStream, temperature, maxTokens);

  } catch (err) {
    console.error('[ai-chat] Chyba:', err);
    return Response.json(
      { error: 'Interní chyba serveru. Zkuste to prosím znovu.' },
      { status: 500 }
    );
  }
}

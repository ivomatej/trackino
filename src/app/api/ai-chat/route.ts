// Trackino – AI Chat API endpoint
// Serverová route – API klíče jsou bezpečně na serveru, nikdy v prohlížeči.
// Podpora providerů: OpenAI (+ připraveno pro Anthropic, Google, Mistral)

import { getProviderForModel, AI_MODELS } from '@/lib/ai-providers';
import type { NextRequest } from 'next/server';

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
}
interface OpenAiResponse {
  choices: { message: { content: string } }[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

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

    // Sestav zprávy (system prompt jako první, pokud je zadán)
    const allMessages: AiChatMessage[] = [
      ...(systemPrompt?.trim() ? [{ role: 'system' as const, content: systemPrompt.trim() }] : []),
      ...messages,
    ];

    // Připrav tělo požadavku (OpenAI-compatible formát)
    const requestBody: Record<string, unknown> = {
      model,
      messages: allMessages,
      stream: stream && modelConfig.supportsStreaming,
      temperature,
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
    };

    // Odešli požadavek na AI providera
    const aiResponse = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      let errMsg = `Chyba od ${provider.name} API (HTTP ${aiResponse.status})`;
      try {
        const errJson = JSON.parse(errText) as { error?: { message?: string } };
        if (errJson?.error?.message) errMsg = errJson.error.message;
      } catch { /* ponech obecnou zprávu */ }
      return Response.json({ error: errMsg }, { status: aiResponse.status });
    }

    // Streaming odpověď
    if (stream && modelConfig.supportsStreaming) {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      const readable = new ReadableStream({
        async start(controller) {
          const reader = aiResponse.body?.getReader();
          if (!reader) { controller.close(); return; }

          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (data === '[DONE]') { controller.close(); return; }
              try {
                const chunk = JSON.parse(data) as OpenAiStreamChunk;
                const text = chunk.choices?.[0]?.delta?.content ?? '';
                if (text) controller.enqueue(encoder.encode(text));
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

    // Nestremaovaná odpověď (např. o1-mini)
    const data = (await aiResponse.json()) as OpenAiResponse;
    const content = data.choices?.[0]?.message?.content ?? '';
    return Response.json({ content, usage: data.usage });

  } catch (err) {
    console.error('[ai-chat] Chyba:', err);
    return Response.json(
      { error: 'Interní chyba serveru. Zkuste to prosím znovu.' },
      { status: 500 }
    );
  }
}

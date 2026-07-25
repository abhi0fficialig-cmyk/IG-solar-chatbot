import OpenAI from "openai";
import { INSTAGRAM_SYSTEM_PROMPT } from "@/lib/system-prompt";

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey: process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY,
    });
  }
  return _openai;
}

const FALLBACK_MODELS = [
  process.env.AI_MODEL || "gemini-2.0-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
].filter(Boolean) as string[];

export async function getAIResponse(
  messages: { role: "user" | "assistant"; content: string }[]
) {
  const payload = [
    { role: "system" as const, content: INSTAGRAM_SYSTEM_PROMPT },
    ...messages,
  ];

  let lastError = "";

  for (let i = 0; i < FALLBACK_MODELS.length; i++) {
    const model = FALLBACK_MODELS[i];
    try {
      const completion = await getOpenAI().chat.completions.create({
        model,
        messages: payload,
        temperature: 0.7,
        max_tokens: 150,
      }, { timeout: 15000 });

      const content = completion.choices[0]?.message?.content?.trim();
      if (!content) continue;

      console.log(`[AI] Model: ${model} | Response: ${content.slice(0, 100)}...`);
      return content;
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string; code?: string };
      lastError = `${model} > ${e.code || e.status || "error"}: ${e.message}`;
      console.warn(`[AI] ${lastError}`);
    }
  }

  console.error(`[AI] All models failed. Last: ${lastError}`);
  return "Sorry, I'm having trouble connecting right now. Please try again.";
}

import OpenAI from "openai";
import { INSTAGRAM_SYSTEM_PROMPT } from "@/lib/system-prompt";

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }
  return _openai;
}

const FALLBACK_MODELS = [
  process.env.AI_MODEL,
  "google/gemini-2.0-flash-exp:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "google/gemma-3-12b-it:free",
  "microsoft/phi-3.5-mini-128k-instruct:free",
].filter(Boolean) as string[];

export async function getAIResponse(
  messages: { role: "user" | "assistant"; content: string }[]
) {
  const payload = [
    { role: "system" as const, content: INSTAGRAM_SYSTEM_PROMPT },
    ...messages,
  ];

  let lastError = "";

  for (const model of FALLBACK_MODELS) {
    try {
      const completion = await getOpenAI().chat.completions.create({
        model,
        messages: payload,
        temperature: 0.7,
        max_tokens: 500,
      });

      const content = completion.choices[0]?.message?.content?.trim();
      if (!content) continue;

      console.log(`[AI] Model: ${model} | Response: ${content.slice(0, 100)}...`);
      return content;
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      lastError = `${model} failed: ${e.status || e.message}`;
      console.warn(`[AI] ${lastError}`);
      if (e.status !== 429 && e.status !== 404) throw err;
    }
  }

  console.error(`[AI] All models failed. Last: ${lastError}`);
  return "Sorry, I'm temporarily unavailable. Please try again shortly.";
}

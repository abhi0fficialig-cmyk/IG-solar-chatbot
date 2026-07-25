import OpenAI from "openai";
import { INSTAGRAM_SYSTEM_PROMPT } from "@/lib/system-prompt";

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        "HTTP-Referer": "https://github.com/abhi0fficialig-cmyk/IG-solar-chatbot",
        "X-Title": "IG Solar Chatbot",
      },
    });
  }
  return _openai;
}

const FALLBACK_MODELS = [
  process.env.AI_MODEL || "openai/gpt-oss-20b:free",
  "openai/gpt-oss-20b:free",
  "google/gemini-2.0-flash-exp:free",
  "google/gemma-3-12b-it:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
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
        max_tokens: 150,
      }, { timeout: 15000 });

      const content = completion.choices[0]?.message?.content?.trim();
      if (!content) continue;

      console.log(`[AI] Model: ${model} | OK`);
      return content;
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      lastError = `${model} > ${e.status || "error"}: ${e.message}`;
      console.warn(`[AI] ${lastError}`);
    }
  }

  console.error(`[AI] All failed. Last: ${lastError}`);
  return `Sorry, I'm having trouble. (${lastError.slice(0, 120)})`;
}

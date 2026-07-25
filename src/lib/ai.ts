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

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const FALLBACK_MODELS = [
  process.env.AI_MODEL || "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "google/gemini-2.0-flash-exp:free",
  "google/gemma-3-12b-it:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "meta-llama/llama-3.1-8b-instruct:free",
  "microsoft/phi-3.5-mini-128k-instruct:free",
  "qwen/qwen-2.5-7b-instruct:free",
  "openrouter/auto",
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
      }, { timeout: 10000 });

      const content = completion.choices[0]?.message?.content?.trim();
      if (!content) continue;

      console.log(`[AI] Model: ${model} | OK`);
      return content;
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      lastError = `${model} > ${e.status || "error"}: ${e.message}`;
      console.warn(`[AI] ${lastError}`);

      // Wait 500ms before trying next model to avoid rate limits
      await delay(500);
    }
  }

  console.error(`[AI] All failed. Last: ${lastError}`);
  return "";
}

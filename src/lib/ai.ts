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
  process.env.AI_MODEL || "google/gemini-2.0-flash-exp:free",
  "google/gemini-2.0-flash-exp:free",
  "google/gemma-3-12b-it:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "meta-llama/llama-3.1-8b-instruct:free",
].filter(Boolean) as string[];

async function tryModel(model: string, payload: { role: string; content: string }[]): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const completion = await getOpenAI().chat.completions.create({
        model,
        messages: payload,
        temperature: 0.7,
        max_tokens: 150,
      }, { timeout: 10000 });

      const content = completion.choices[0]?.message?.content?.trim();
      if (content) return content;
      return null;
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      // If rate limited, wait 3s and retry the same model
      if (e.status === 429) {
        console.warn(`[AI] ${model} rate limited (attempt ${attempt + 1}/3), waiting 3s...`);
        await delay(3000);
        continue;
      }
      // Any other error, skip this model
      console.warn(`[AI] ${model} > ${e.status || "error"}: ${e.message}`);
      return null;
    }
  }
  console.warn(`[AI] ${model} rate limited after 3 attempts`);
  return null;
}

export async function getAIResponse(
  messages: { role: "user" | "assistant"; content: string }[]
) {
  const payload = [
    { role: "system" as const, content: INSTAGRAM_SYSTEM_PROMPT },
    ...messages,
  ];

  for (const model of FALLBACK_MODELS) {
    const result = await tryModel(model, payload);
    if (result) {
      console.log(`[AI] ${model} | OK`);
      return result;
    }
    await delay(500);
  }

  return "Thanks for reaching out! Our team will contact you shortly. You can also call us on +91 91516 81598.";
}

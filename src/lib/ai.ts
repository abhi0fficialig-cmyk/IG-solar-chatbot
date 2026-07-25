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
  "google/gemma-3-12b-it:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "microsoft/phi-3.5-mini-128k-instruct:free",
].filter(Boolean) as string[];

export async function getAIResponse(
  messages: { role: "user" | "assistant"; content: string }[]
) {
  const payload = [
    { role: "system" as const, content: INSTAGRAM_SYSTEM_PROMPT },
    ...messages,
  ];

  for (const model of FALLBACK_MODELS) {
    try {
      const completion = await getOpenAI().chat.completions.create({ model, messages: payload });
      return completion.choices[0]?.message?.content || "Sorry, I couldn't generate a response.";
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status !== 429 && status !== 404) throw err;
      console.warn(`Model ${model} failed with ${status}, trying next...`);
    }
  }

  return "Sorry, I'm temporarily unavailable. Please try again shortly.";
}

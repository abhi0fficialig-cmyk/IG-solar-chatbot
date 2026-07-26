import OpenAI from "openai";
import { INSTAGRAM_SYSTEM_PROMPT } from "@/lib/system-prompt";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY || "",
      baseURL: "https://openrouter.ai/api/v1",
      timeout: 10000,
    });
  }
  return _client;
}

async function tryModel(modelName: string, payload: { role: string; content: string }[]): Promise<string | null> {
  const systemMsg = payload.find((m) => m.role === "system")?.content || "";
  const history = payload.filter((m) => m.role !== "system");
  const lastMsg = history.pop();

  if (!lastMsg) return null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await getClient().chat.completions.create({
        model: modelName,
        messages: [
          { role: "system", content: systemMsg },
          ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
          { role: lastMsg.role as "user", content: lastMsg.content },
        ],
        temperature: 0.7,
        max_tokens: 150,
      });

      const text = result.choices?.[0]?.message?.content?.trim();
      if (text) return text;
      return null;
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string; code?: number };
      if (e.status === 429 || e.code === 429) {
        console.warn(`[AI] ${modelName} rate limited, retrying...`);
        continue;
      }
      console.warn(`[AI] ${modelName} > ${e.status || e.code || "error"}: ${e.message}`);
      return null;
    }
  }
  return null;
}

export async function getAIResponse(
  messages: { role: "user" | "assistant"; content: string }[]
) {
  const modelName = process.env.AI_MODEL || "openai/gpt-oss-20b:free";

  const payload = [
    { role: "system" as const, content: INSTAGRAM_SYSTEM_PROMPT },
    ...messages,
  ];

  const result = await tryModel(modelName, payload);
  if (result) return result;

  return "Thanks for reaching out! Our team will contact you shortly. You can also call us on +91 91516 81598.";
}

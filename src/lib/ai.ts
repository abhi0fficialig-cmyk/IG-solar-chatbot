import { GoogleGenerativeAI } from "@google/generative-ai";
import { INSTAGRAM_SYSTEM_PROMPT } from "@/lib/system-prompt";

let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY || "");
  }
  return _genAI;
}

const MODELS = [
  process.env.AI_MODEL || "gemini-2.0-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
];

async function tryModel(modelName: string, payload: { role: string; content: string }[]): Promise<string | null> {
  const systemMsg = payload.find((m) => m.role === "system")?.content || "";
  const history = payload.filter((m) => m.role !== "system");
  const lastMsg = history.pop();

  if (!lastMsg) return null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const model = getGenAI().getGenerativeModel({
        model: modelName,
        systemInstruction: systemMsg,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 150,
        },
      });

      const chat = model.startChat({
        history: history.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
      });

      const result = await chat.sendMessage(lastMsg.content);
      const text = result.response.text().trim();
      if (text) return text;
      return null;
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string; code?: number };
      // Retry once on rate limit after 3s
      if (e.status === 429 || e.code === 429) {
        console.warn(`[AI] ${modelName} rate limited, retrying in 3s...`);
        await new Promise((r) => setTimeout(r, 3000));
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
  const payload = [
    { role: "system" as const, content: INSTAGRAM_SYSTEM_PROMPT },
    ...messages,
  ];

  for (const model of MODELS) {
    const result = await tryModel(model, payload);
    if (result) {
      console.log(`[AI] ${model} | OK`);
      return result;
    }
  }

  return "Thanks for reaching out! Our team will contact you shortly. You can also call us on +91 91516 81598.";
}

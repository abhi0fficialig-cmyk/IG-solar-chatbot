import { INSTAGRAM_SYSTEM_PROMPT } from "@/lib/system-prompt";

const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY || "";

const MODELS = [
  process.env.AI_MODEL || "gemini-2.0-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
];

function buildGeminiPayload(messages: { role: string; content: string }[]) {
  const contents = [] as { role: string; parts: { text: string }[] }[];
  let systemInstruction = "";

  for (const msg of messages) {
    if (msg.role === "system") {
      systemInstruction = msg.content;
    } else {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }
  }

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 150,
    },
  };

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  return body;
}

export async function getAIResponse(
  messages: { role: "user" | "assistant"; content: string }[]
) {
  const payload = [
    { role: "system" as const, content: INSTAGRAM_SYSTEM_PROMPT },
    ...messages,
  ];

  let lastError = "";

  for (const model of MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildGeminiPayload(payload)),
        signal: AbortSignal.timeout(15000),
      });

      const data = await res.json();

      if (!res.ok) {
        lastError = `${model} > ${res.status}: ${data.error?.message || JSON.stringify(data).slice(0, 100)}`;
        console.warn(`[AI] ${lastError}`);
        continue;
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) {
        console.log(`[AI] Model: ${model} | Response: ${text.slice(0, 100)}...`);
        return text;
      }

      lastError = `${model} > empty response`;
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      lastError = `${model} > ${e.name || "error"}: ${e.message}`;
      console.warn(`[AI] ${lastError}`);
    }
  }

  console.error(`[AI] All models failed. Last: ${lastError}`);
  return `Sorry, I'm having trouble. (${lastError.slice(0, 120)})`;
}

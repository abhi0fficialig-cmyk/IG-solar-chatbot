import { INSTAGRAM_SYSTEM_PROMPT } from "@/lib/system-prompt";

const API_KEY = process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY || "";
const PROJECT_ID = process.env.GEMINI_PROJECT_ID || "333135054411";

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
    generationConfig: { temperature: 0.7, maxOutputTokens: 150 },
  };

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  return body;
}

async function tryEndpoint(url: string, body: Record<string, unknown>, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status}: ${data.error?.message || JSON.stringify(data).slice(0, 150)}`);
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

export async function getAIResponse(
  messages: { role: "user" | "assistant"; content: string }[]
) {
  const payload = [
    { role: "system" as const, content: INSTAGRAM_SYSTEM_PROMPT },
    ...messages,
  ];

  const geminiBody = buildGeminiPayload(payload);
  let lastError = "";

  for (const model of MODELS) {
    // Try 1: Standard Gemini endpoint with query param key
    try {
      const text = await tryEndpoint(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`,
        geminiBody
      );
      if (text) return text;
    } catch (err: unknown) {
      lastError = `${model} > ${(err as Error).message}`;
    }

    // Try 2: Standard Gemini endpoint with header key
    try {
      const text = await tryEndpoint(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        geminiBody,
        { "X-Goog-Api-Key": API_KEY }
      );
      if (text) return text;
    } catch (err: unknown) {
      lastError = `${model} > ${(err as Error).message}`;
    }

    // Try 3: Vertex AI endpoint
    try {
      const text = await tryEndpoint(
        `https://us-central1-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/us-central1/publishers/google/models/${model}:generateContent`,
        geminiBody,
        { "X-Goog-Api-Key": API_KEY }
      );
      if (text) return text;
    } catch (err: unknown) {
      lastError = `${model} > ${(err as Error).message}`;
    }
  }

  console.error(`[AI] All failed. Last: ${lastError}`);
  return `Sorry, I'm having trouble. (${lastError.slice(0, 150)})`;
}

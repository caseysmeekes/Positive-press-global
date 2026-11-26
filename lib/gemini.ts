import { GoogleGenAI } from "@google/genai";

type JsonGenerationOptions = {
  systemInstruction: string;
  prompt: string;
  temperature?: number;
};

const RETRYABLE_ERROR = /429|500|502|503|504|rate.?limit|temporar|overloaded|timeout|fetch failed/i;

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Unknown Gemini API error.";
  const message = error.message.replace(/\s+/g, " ").trim();
  return message.length > 500 ? message.slice(0, 500) + "…" : message;
}

export async function generateGeminiJson<T>(options: JsonGenerationOptions): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini is not configured. Add GEMINI_API_KEY to the Vercel environment variables, then redeploy.");
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const ai = new GoogleGenAI({ apiKey });
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: options.prompt,
        config: {
          systemInstruction: options.systemInstruction,
          temperature: options.temperature ?? 0.2,
          responseMimeType: "application/json"
        }
      });
      const raw = response.text?.trim();
      if (!raw) throw new Error("Gemini returned an empty response.");
      try {
        return JSON.parse(raw) as T;
      } catch {
        throw new Error("Gemini returned invalid JSON. Check the configured model and retry.");
      }
    } catch (error) {
      lastError = error;
      const message = errorMessage(error);
      if (attempt === 3 || !RETRYABLE_ERROR.test(message)) {
        throw new Error("Gemini request failed (" + model + "): " + message);
      }
      await new Promise(resolve => setTimeout(resolve, 1500 * (2 ** (attempt - 1))));
    }
  }

  throw new Error("Gemini request failed (" + model + "): " + errorMessage(lastError));
}

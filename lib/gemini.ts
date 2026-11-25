import { GoogleGenAI } from "@google/genai";

type JsonGenerationOptions = {
  systemInstruction: string;
  prompt: string;
  temperature?: number;
  timeoutMs?: number;
};

export async function generateGeminiJson<T>(options: JsonGenerationOptions): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing. Add your Google AI Studio API key to the Vercel environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
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
    throw new Error("Gemini returned invalid JSON. Please retry the draft.");
  }
}

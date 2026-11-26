import { GoogleGenAI } from "@google/genai";

type JsonGenerationOptions = {
  systemInstruction: string;
  prompt: string;
  temperature?: number;
};

const TRANSIENT_ERROR = /429|500|502|503|504|408|rate.?limit|temporar|overloaded|timeout|fetch failed|unavailable/i;

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Unknown Gemini API error.";
  const message = error.message.replace(/\\s+/g, " ").trim();
  return message.length > 500 ? message.slice(0, 500) + "…" : message;
}

function isTransient(error: unknown): boolean {
  return TRANSIENT_ERROR.test(errorMessage(error));
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function requestJson<T>(ai: GoogleGenAI, model: string, options: JsonGenerationOptions): Promise<T> {
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
    throw new Error("Gemini returned invalid JSON. Check the prompt and model response.");
  }
}

async function requestWithRetry<T>(ai: GoogleGenAI, model: string, options: JsonGenerationOptions): Promise<T> {
  let lastError: unknown;
  // Two attempts per model. Keep retries bounded so a server action cannot sit
  // inside repeated long waits and consume the Vercel function execution window.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await requestJson<T>(ai, model, options);
    } catch (error) {
      lastError = error;
      if (!isTransient(error) || attempt === 1) throw error;
      const backoff = 1200 * (2 ** attempt) + Math.floor(Math.random() * 500);
      await wait(backoff);
    }
  }
  throw lastError;
}

export async function generateGeminiJson<T>(options: JsonGenerationOptions): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini is not configured. Add GEMINI_API_KEY to the Vercel environment variables, then redeploy.");
  }

  const primaryModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite";
  const ai = new GoogleGenAI({ apiKey });

  try {
    return await requestWithRetry<T>(ai, primaryModel, options);
  } catch (primaryError) {
    if (!isTransient(primaryError) || fallbackModel === primaryModel) {
      throw new Error("Gemini request failed (" + primaryModel + "): " + errorMessage(primaryError));
    }

    try {
      return await requestWithRetry<T>(ai, fallbackModel, options);
    } catch (fallbackError) {
      throw new Error(
        "Gemini is temporarily unavailable. Primary model " + primaryModel + " failed: " +
        errorMessage(primaryError) + ". Fallback model " + fallbackModel + " failed: " +
        errorMessage(fallbackError)
      );
    }
  }
}

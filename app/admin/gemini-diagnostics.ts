"use server";

import { redirect } from "next/navigation";

function safeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Unknown Gemini API error.";
  return raw
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED_API_KEY]")
    .replace(/key=[^&\s]+/gi, "key=[REDACTED]")
    .replace(/\s+/g, " ")
    .slice(0, 260);
}

async function testModel(ai: InstanceType<typeof import("@google/genai").GoogleGenAI>, modelName: string) {
  const started = Date.now();
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: "Reply with exactly: OK",
      config: { temperature: 0, maxOutputTokens: 8 }
    });
    const text = response.text?.trim() || "";
    return { model: modelName, ok: Boolean(text), durationMs: Date.now() - started, reply: text.slice(0, 20), error: "" };
  } catch (error) {
    return { model: modelName, ok: false, durationMs: Date.now() - started, reply: "", error: safeError(error) };
  }
}

export async function runGeminiDiagnostics() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const { GEMINI_PRIMARY_MODEL, GEMINI_FALLBACK_MODEL } = await import("@/lib/gemini");
  const primary = GEMINI_PRIMARY_MODEL;
  const fallback = GEMINI_FALLBACK_MODEL;

  if (!key) redirect("/admin/stories?geminiDiag=missing_key");

  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: key });

  let modelNames: string[] = [];
  let listError = "";
  try {
    const pager = await ai.models.list({ config: { pageSize: 100 } });
    for await (const model of pager) {
      const item = model as { name?: string; supportedActions?: string[] };
      if (item.name && (!item.supportedActions || item.supportedActions.includes("generateContent"))) {
        modelNames.push(item.name.replace(/^models\//, ""));
      }
    }
  } catch (error) {
    listError = safeError(error);
  }

  const primaryListed = modelNames.includes(primary);
  const fallbackListed = modelNames.includes(fallback);
  const primaryTest = await testModel(ai, primary);
  const fallbackTest = fallback === primary ? null : await testModel(ai, fallback);

  const summary = {
    primary, fallback,
    modelSource: "application defaults (Vercel model overrides are intentionally ignored)",
    modelsList: listError ? "error" : "success",
    listError,
    modelCount: modelNames.length,
    primaryListed, fallbackListed,
    primaryTest, fallbackTest,
    checkedAt: new Date().toISOString()
  };
  redirect("/admin/stories?geminiDiag=" + encodeURIComponent(JSON.stringify(summary)));
}

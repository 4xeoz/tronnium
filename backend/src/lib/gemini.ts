import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
export const defaultModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
export const geminiClient = apiKey ? new GoogleGenerativeAI(apiKey) : null;

/**
 * Call Gemini with a prompt and return the raw text response.
 * Expects the model to return JSON (set responseMimeType: application/json on the caller side).
 */
export async function callGemini(prompt: string): Promise<string> {
  const model = geminiClient!.getGenerativeModel({ model: defaultModel });
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
    },
  });
  const content = result.response.text();
  if (!content) throw new Error("Gemini returned an empty response");
  return content;
}

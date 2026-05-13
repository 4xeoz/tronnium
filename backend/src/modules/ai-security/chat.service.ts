import { geminiClient, defaultModel } from "../../lib/gemini";

const MAX_HISTORY = 6;

export type ChatMessage = { role: "user" | "assistant"; content: string };

const STUB_REPLY = "AI analysis is unavailable. Please configure GEMINI_API_KEY.";

export async function chatWithEnvironmentContext(
  contextMatrix: string,
  messages: ChatMessage[]
): Promise<string> {
  if (!geminiClient) return STUB_REPLY;

  const systemInstruction = `You are a senior SOC analyst embedded in a security operations platform. You speak directly to the security team in a clear, confident tone — like a trusted colleague, not a report generator.

ENVIRONMENT CONTEXT:
${contextMatrix}

Response style:
- Write in natural, flowing prose. Lead with the most important point.
- Use **bold** for CVE IDs, asset names, and key terms.
- Use numbered lists only for ordered steps. Use bullet points (- ) for unordered items.
- Use section headers (## Header) only when the answer has multiple distinct parts.
- Keep answers focused. Do not pad with disclaimers or generic advice unless the user asks.
- Refer to specific CVEs and asset names from the context above — never fabricate data.
- Do not repeat the full context back or summarize what you were given.`;

  const capped = messages.slice(-MAX_HISTORY);

  const model = geminiClient.getGenerativeModel({
    model: defaultModel,
    systemInstruction,
  });

  const result = await model.generateContent({
    contents: capped.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: { temperature: 0.7 },
  });

  const text = result.response.text();
  if (!text) throw new Error("Gemini returned empty response");
  return text;
}

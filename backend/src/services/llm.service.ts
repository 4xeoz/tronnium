import { GoogleGenerativeAI } from "@google/generative-ai";

type ExtractionFields = {
	vendor: string | null;
	product: string | null;
	product_family: string | null;
	model: string | null;
	version: string | null;
	firmware: string | null;
	os: string | null;
	asset_role: string | null;
	domain: "it" | "ot" | "iot" | "cloud" | "unknown" | null;
};

export type LlmExtraction = {
	extracted: Partial<ExtractionFields>;
	quality: Record<string, number> & { overall?: number };
	reasoning: Record<string, string>;
	model: string;
};

type CallLlmOptions = {
	model?: string;
	temperature?: number;
};

const apiKey = process.env.GEMINI_API_KEY;
const defaultModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const client = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const fallbackExtraction: LlmExtraction = {
	extracted: {
		vendor: null,
		product: null,
		product_family: null,
		model: null,
		version: null,
		firmware: null,
		os: null,
		asset_role: null,
		domain: "unknown",
	},
	quality: { overall: 0 },
	reasoning: { note: "Returning fallback response because GEMINI_API_KEY is not set" },
	model: "stub",
};

function parseJson(content: string, model: string): LlmExtraction {
	try {
		const parsed = JSON.parse(content);
		return {
			extracted: parsed.extracted || fallbackExtraction.extracted,
			quality: parsed.quality || fallbackExtraction.quality,
			reasoning: parsed.reasoning || {},
			model,
		};
	} catch (error) {
		throw new Error(`Failed to parse LLM JSON: ${String(error)}`);
	}
}

/**
 * Call Gemini and return structured extraction.
 */
export default async function callLLM(
	prompt: string,
	options: CallLlmOptions = {},
): Promise<LlmExtraction> {
	if (!client) {
		console.warn("GEMINI_API_KEY is missing. Using fallback extraction.");
		return fallbackExtraction;
	}

	const modelName = options.model || defaultModel;
	const temperature = options.temperature ?? 0.2;

	const model = client.getGenerativeModel({ model: modelName });

	const result = await model.generateContent({
		contents: [
			{
				role: "user",
				parts: [{ text: prompt }],
			},
		],
		generationConfig: {
			temperature,
			responseMimeType: "application/json",
		},
	});

	const content = result.response.text();
	if (!content) {
		throw new Error("Gemini returned an empty response");
	}

	return parseJson(content, modelName);
}

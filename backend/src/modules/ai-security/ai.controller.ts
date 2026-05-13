import type { Request, Response } from "express";
import { getLatestScan } from "../scan-core/public";
import { verifyEnvironment } from "../../lib/verify-environment";
import { explainCve } from "../vulnerability-workflows/public";
import { analyzeSocContext } from "./soc-analysis.service";
import { analyzeEnvironment, buildVulnerabilityMatrix, type AssetScanEntry } from "../environment-briefing/public";
import { chatWithEnvironmentContext, type ChatMessage } from "./chat.service";
import { defaultModel } from "../../lib/gemini";
import type { SocAnalysisInput } from "./soc-analysis.types";
import { ok, err } from "../../lib/response-helpers";

/**
 * POST /ai/explain-cve
 * Generic CVE explanation — no asset context.
 */
export async function explainCveHandler(req: Request, res: Response): Promise<void> {
	const { cveId, description, cvssScore, severity } = req.body;

	if (!cveId || typeof cveId !== "string") {
		res.status(400).json(err("INVALID_INPUT", "cveId is required"));
		return;
	}
	if (!description || typeof description !== "string") {
		res.status(400).json(err("INVALID_INPUT", "description is required"));
		return;
	}

	try {
		const explanation = await explainCve(cveId, description, cvssScore ?? null, severity || "UNKNOWN");
		res.json(ok(explanation));
	} catch (error) {
		console.error("[AI] explainCve error:", error);
		res.status(500).json(err("GENERATION_FAILED", "Failed to generate CVE explanation."));
	}
}

/**
 * POST /ai/soc-analysis
 * Context-aware SOC analysis for one CVE on one specific asset.
 * No auth required — all data provided in the request body.
 */
export async function socAnalysisHandler(req: Request, res: Response): Promise<void> {
	const { cveId, description, severity, cvssScore, cvssVector, assetName, assetType, cpeName } = req.body;

	// Validate required fields
	const missingFields = ["cveId", "description", "assetName", "assetType", "cpeName"].filter(
		(field) => !req.body[field] || typeof req.body[field] !== "string"
	);
	if (missingFields.length > 0) {
		res.status(400).json(
			err("INVALID_INPUT", `Missing or invalid required fields: ${missingFields.join(", ")}`)
		);
		return;
	}

	const input: SocAnalysisInput = {
		cveId,
		description,
		severity: severity || "UNKNOWN",
		cvssScore: cvssScore ?? null,
		cvssVector: cvssVector ?? null,
		assetName,
		assetType,
		cpeName,
	};

	try {
		const analysis = await analyzeSocContext(input);
		res.json(ok(analysis));
	} catch (error) {
		console.error("[AI] socAnalysis error:", error);
		res.status(500).json(err("GENERATION_FAILED", "Failed to generate SOC analysis."));
	}
}

/**
 * POST /ai/environment-briefing
 * Full environment AI briefing — looks at all assets and CVEs together.
 * Auth required — fetches scan data from the database using environmentId.
 */
export async function environmentBriefingHandler(req: Request, res: Response): Promise<void> {
	const userId = req.user?.id;
	const { environmentId } = req.body;

	if (!environmentId || typeof environmentId !== "string") {
		res.status(400).json(err("INVALID_INPUT", "environmentId is required"));
		return;
	}

	try {
		if (!(await verifyEnvironment(userId!, environmentId))) {
			res.status(404).json(err("NOT_FOUND", "Environment not found"));
			return;
		}

		// Get the latest completed real scan
		const latestScan = await getLatestScan(environmentId);
		if (!latestScan) {
			res.status(404).json(
				err("NOT_FOUND", "No completed scan found for this environment. Run a scan first.")
			);
			return;
		}

		// Map scan data to the shape the service expects
		const assetScans: AssetScanEntry[] = latestScan.assetScans.map((assetScan) => ({
			asset: {
				name: assetScan.asset.name,
				type: assetScan.asset.type,
				domain: assetScan.asset.domain,
			},
			vulnerabilities: assetScan.vulnerabilities.map((av) => ({
				vulnerability: {
					cveId: av.vulnerability.cveId,
					description: av.vulnerability.description,
					severity: av.vulnerability.severity,
					cvssScore: av.vulnerability.cvssScore,
				},
			})),
		}));

		const briefing = await analyzeEnvironment(assetScans);
		res.json(ok(briefing));
	} catch (error) {
		console.error("[AI] environmentBriefing error:", error);
		res.status(500).json(err("GENERATION_FAILED", "Failed to generate environment briefing."));
	}
}

/**
 * POST /ai/chat
 * Multi-turn chat with full environment context as system prompt.
 * Auth required — fetches scan data from DB. History capped at 6 messages server-side.
 */
export async function chatHandler(req: Request, res: Response): Promise<void> {
	const userId = req.user?.id;
	const { environmentId, messages } = req.body;

	if (!environmentId || typeof environmentId !== "string") {
		res.status(400).json(err("INVALID_INPUT", "environmentId is required"));
		return;
	}
	if (!Array.isArray(messages) || messages.length === 0) {
		res.status(400).json(err("INVALID_INPUT", "messages array is required"));
		return;
	}

	try {
		if (!(await verifyEnvironment(userId!, environmentId))) {
			res.status(404).json(err("NOT_FOUND", "Environment not found"));
			return;
		}

		const latestScan = await getLatestScan(environmentId);
		if (!latestScan) {
			res.status(404).json(err("NOT_FOUND", "No completed scan found. Run a scan first."));
			return;
		}

		const assetScans: AssetScanEntry[] = latestScan.assetScans.map((assetScan) => ({
			asset: {
				name: assetScan.asset.name,
				type: assetScan.asset.type,
				domain: assetScan.asset.domain,
			},
			vulnerabilities: assetScan.vulnerabilities.map((av) => ({
				vulnerability: {
					cveId: av.vulnerability.cveId,
					description: av.vulnerability.description,
					severity: av.vulnerability.severity,
					cvssScore: av.vulnerability.cvssScore,
				},
			})),
		}));

		const matrix = buildVulnerabilityMatrix(assetScans);
		const reply = await chatWithEnvironmentContext(matrix, messages as ChatMessage[]);
		res.json(ok({ reply, model: defaultModel }));
	} catch (error) {
		console.error("[AI] chat error:", error);
		res.status(500).json(err("GENERATION_FAILED", "Failed to generate response."));
	}
}

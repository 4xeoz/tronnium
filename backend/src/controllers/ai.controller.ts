import type { Request, Response } from "express";
import { getLatestScan } from "../services/scan.service";
import { verifyEnvironment } from "../lib/verifyEnvironment";
import { explainCve } from "../services/cveExplain.service";
import { analyzeSocContext, type SocAnalysisInput } from "../services/socAnalysis.service";
import { analyzeEnvironment, type AssetScanEntry } from "../services/environmentBriefing.service";

/**
 * POST /ai/explain-cve
 * Generic CVE explanation — no asset context.
 */
export async function explainCveHandler(req: Request, res: Response): Promise<void> {
	const { cveId, description, cvssScore, severity } = req.body;

	if (!cveId || typeof cveId !== "string") {
		res.status(400).json({ success: false, error: "cveId is required" });
		return;
	}
	if (!description || typeof description !== "string") {
		res.status(400).json({ success: false, error: "description is required" });
		return;
	}

	try {
		const explanation = await explainCve(cveId, description, cvssScore ?? null, severity || "UNKNOWN");
		res.json({ success: true, data: explanation });
	} catch (error) {
		console.error("[AI] explainCve error:", error);
		res.status(500).json({ success: false, error: "Failed to generate CVE explanation." });
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
		res.status(400).json({
			success: false,
			error: `Missing or invalid required fields: ${missingFields.join(", ")}`,
		});
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
		res.json({ success: true, data: analysis });
	} catch (error) {
		console.error("[AI] socAnalysis error:", error);
		res.status(500).json({ success: false, error: "Failed to generate SOC analysis." });
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
		res.status(400).json({ success: false, error: "environmentId is required" });
		return;
	}

	try {
		if (!(await verifyEnvironment(userId!, environmentId))) {
			res.status(404).json({ success: false, error: "Environment not found" });
			return;
		}

		// Get the latest completed real scan
		const latestScan = await getLatestScan(environmentId);
		if (!latestScan) {
			res.status(404).json({
				success: false,
				error: "No completed scan found for this environment. Run a scan first.",
			});
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
		res.json({ success: true, data: briefing });
	} catch (error) {
		console.error("[AI] environmentBriefing error:", error);
		res.status(500).json({ success: false, error: "Failed to generate environment briefing." });
	}
}

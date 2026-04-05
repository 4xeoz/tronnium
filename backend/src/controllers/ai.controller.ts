import type { Request, Response } from "express";
import { explainCve } from "../services/cveExplain.service";

/**
 * POST /ai/explain-cve
 * Generate AI explanation for a CVE vulnerability
 */
export async function explainCveHandler(req: Request, res: Response): Promise<void> {
	try {
		const { cveId, description, cvssScore, severity } = req.body;

		// Validate required fields
		if (!cveId || typeof cveId !== "string") {
			res.status(400).json({
				success: false,
				error: "CVE ID is required and must be a string",
			});
			return;
		}

		if (!description || typeof description !== "string") {
			res.status(400).json({
				success: false,
				error: "Description is required and must be a string",
			});
			return;
		}

		const explanation = await explainCve(
			cveId,
			description,
			cvssScore ?? null,
			severity || "UNKNOWN"
		);

		res.json({
			success: true,
			data: explanation,
		});
	} catch (error) {
		console.error("Error generating CVE explanation:", error);
		res.status(500).json({
			success: false,
			error: "Failed to generate explanation. Please try again.",
		});
	}
}

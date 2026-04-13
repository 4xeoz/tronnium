import type { Request, Response } from "express";
import { analyzeSocContext, explainCve } from "../services/cveExplain.service";

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



export async function socAnalysisHandler(req: Request, res: Response): Promise<void> {
   const { cveId, description, cvssScore, severity, cvssVector, assetName, assetType, cpeName } = req.body;

  // Required fields
  if (!cveId || !description || !assetName || !assetType || !cpeName) {
    res.status(400).json({
      success: false,
      error: "cveId, description, assetName, assetType, and cpeName are required",
    });
    return;
  }


  try {
	const analysis = await analyzeSocContext({
	  cveId, description,
      cvssScore: cvssScore ?? null,
      severity: severity || "UNKNOWN",
      cvssVector: cvssVector ?? null,
      assetName, assetType, cpeName,
	});

	res.json({
		success: true,
		data: analysis,
	});
  }
  catch (error) {
	console.error("Error generating SOC analysis:", error);
	res.status(500).json({
		success: false,
		error: "Failed to generate SOC analysis. Please try again.",
	});
  }

}

import { Router } from "express";
import { jwtAuthGuard } from "../authentication/public";
import {
  generateVulnerabilitiesHandler,
  clearMockVulnerabilitiesHandler,
  getMockVulnerabilitiesHandler,
  getMockVulnerabilityStatsHandler,
  createTestVulnerabilityHandler,
  getSeedTemplatesHandler,
  seedTemplateHandler,
} from "./dev.controller";

const devRouter = Router();

// All dev routes require authentication
devRouter.use(jwtAuthGuard());

/**
 * POST /dev/generate-vulnerabilities
 * Generate mock vulnerabilities using LLM
 * Body: { environmentId: string, prompt: string, count?: number }
 */
devRouter.post("/generate-vulnerabilities", generateVulnerabilitiesHandler);

/**
 * GET /dev/mock-vulnerabilities/:environmentId
 * Get all mock vulnerabilities for an environment
 */
devRouter.get("/mock-vulnerabilities/:environmentId", getMockVulnerabilitiesHandler);

/**
 * DELETE /dev/mock-vulnerabilities/:environmentId
 * Clear all mock vulnerabilities for an environment
 */
devRouter.delete("/mock-vulnerabilities/:environmentId", clearMockVulnerabilitiesHandler);

/**
 * GET /dev/mock-vulnerabilities/:environmentId/stats
 * Get statistics about mock vulnerabilities
 */
devRouter.get("/mock-vulnerabilities/:environmentId/stats", getMockVulnerabilityStatsHandler);

/**
 * POST /dev/create-test-vulnerability
 * Manually create a single test vulnerability for dev/testing
 */
devRouter.post("/create-test-vulnerability", createTestVulnerabilityHandler);

/**
 * GET /dev/seed-templates
 * List available demo environment templates
 */
devRouter.get("/seed-templates", getSeedTemplatesHandler);

/**
 * POST /dev/seed-template
 * Seed a full demo environment from a template
 * Body: { templateId: string }
 */
devRouter.post("/seed-template", seedTemplateHandler);

export default devRouter;

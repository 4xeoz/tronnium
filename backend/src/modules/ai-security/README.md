# ai-security

AI-powered security analysis endpoints using Google's Gemini LLM.

## Purpose

Provides three analysis capabilities:
- **Generic CVE explanation** — Plain-language breakdown of a single CVE
- **SOC-contextual analysis** — Asset-specific threat analysis for a CVE (how it impacts a particular system type)
- **Environment briefing** — Holistic security briefing across all assets in an environment, identifying cross-asset patterns and prioritized actions

## Files

| File | Role |
|------|------|
| `ai.routes.ts` | Express router. Defines 3 routes under `/ai`. |
| `ai.controller.ts` | Request handlers. Validates input, calls downstream services, returns responses. |
| `soc-analysis.service.ts` | Builds a SOC-analysis prompt for Gemini and parses the JSON response into `SocAnalysis`. |
| `llm.service.ts` | **Orphaned/standalone.** Generic Gemini wrapper for structured field extraction. Not imported by any file in the codebase. |

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/ai/explain-cve` | None | Generic CVE explanation |
| `POST` | `/ai/soc-analysis` | None | Context-aware analysis for one CVE × one asset |
| `POST` | `/ai/environment-briefing` | JWT | Holistic briefing across all assets & CVEs in an environment |

## How it links together

```
ai.routes.ts
  → ai.controller.ts
      → soc-analysis.service.ts (for SOC analysis)
      → ../vulnerability-workflows/cve-explain.service.ts (for CVE explanation)
      → ../environments/environment-briefing.service.ts (for environment briefing)
```

## Key concepts

- **Structured JSON output**: All prompts instruct Gemini to return JSON. `responseMimeType: "application/json"` is set in the generation config.
- **Temperature**: ~0.2–0.3 (deterministic, factual).
- **Token management**: The briefing builder truncates descriptions (CRITICAL = 150 chars, HIGH = 80 chars) and suppresses full descriptions for MEDIUM/LOW to avoid token explosion.
- **Systemic risk detection**: The briefing builder tracks CVEs that appear on ≥2 assets and surfaces them explicitly.
- **Graceful degradation**: Every AI service returns a static fallback when `GEMINI_API_KEY` is missing.

import { useState } from "react";
import { validateCpeString, type CpeCandidate } from "@/lib/api/assets";

type ValidationResult = { isValid: boolean; message: string };

export function useCpeValidation() {
  const [cpeInput, setCpeInput] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validatedCpe, setValidatedCpe] = useState<CpeCandidate | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function validate() {
    if (!cpeInput.trim()) return;
    setError(null);
    setValidationResult(null);
    setValidatedCpe(null);
    setIsValidating(true);
    try {
      const result = await validateCpeString(cpeInput.trim());

      if (!result.success) {
        setValidationResult({ isValid: false, message: result.message || "Validation failed" });
        setError(result.message || "Validation failed");
        return;
      }
      const payload = result.data;
      setValidationResult({ isValid: payload.isValid, message: payload.message });
      if (payload.isValid) {
        setValidatedCpe({
          cpeName: cpeInput.trim(),
          cpeNameId: "",
          title: cpeInput.trim(),
          score: 100,
          vendor: payload.parsed?.vendor || "",
          product: payload.parsed?.product || "",
          version: payload.parsed?.version || "",
          breakdown: { vendor: 100, product: 100, version: 100, tokenOverlap: 100 },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to validate CPE");
    } finally {
      setIsValidating(false);
    }
  }

  function reset() {
    setCpeInput("");
    setIsValidating(false);
    setValidationResult(null);
    setValidatedCpe(null);
    setError(null);
  }

  return { cpeInput, setCpeInput, isValidating, validationResult, validatedCpe, error, validate, reset };
}

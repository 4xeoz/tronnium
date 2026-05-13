import { useState } from "react";
import type { CpeCandidate, CreateAssetInput } from "@/lib/api/assets";

type FormFields = {
  assetName: string;
  description: string;
  type: string;
  status: string;
  location: string;
  ipAddress: string;
  isExternallyFacing: boolean;
};

const DEFAULTS: FormFields = {
  assetName: "",
  description: "",
  type: "unknown",
  status: "active",
  location: "",
  ipAddress: "",
  isExternallyFacing: false,
};

export function useAddAssetForm() {
  const [fields, setFields] = useState<FormFields>(DEFAULTS);

  function setField<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setFields(DEFAULTS);
  }

  function buildCreateInput(selectedCpes: CpeCandidate[]): CreateAssetInput {
    const firstCpe = selectedCpes[0];
    return {
      name: fields.assetName.trim(),
      description: fields.description.trim() || undefined,
      type: fields.type || undefined,
      status: fields.status || undefined,
      location: fields.location.trim() || undefined,
      ipAddress: fields.ipAddress.trim() || undefined,
      manufacturer: firstCpe?.vendor || undefined,
      model: firstCpe?.product || undefined,
      cpes: selectedCpes.length > 0 ? selectedCpes : undefined,
      isExternallyFacing: fields.isExternallyFacing,
    };
  }

  return { fields, setField, reset, buildCreateInput };
}

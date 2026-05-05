"use client";

import { useState } from "react";
import { FiX } from "react-icons/fi";
import { createEnvironment, type CreateEnvironmentInput } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input, TextArea } from "@/components/ui/Input";

interface CreateEnvironmentSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateEnvironmentSlideOver({
  isOpen,
  onClose,
  onSuccess,
}: CreateEnvironmentSlideOverProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [labelsInput, setLabelsInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const labels = labelsInput
        .split(",")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const data: CreateEnvironmentInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        labels: labels.length > 0 ? labels : undefined,
      };

      await createEnvironment(data);
      
      setName("");
      setDescription("");
      setLabelsInput("");
      
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create environment");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/45 transition-opacity duration-200 z-40 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-surface border-l border-border shadow-[var(--shadow-card)] z-50 flex flex-col transform transition-transform duration-200 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-[22px] font-bold text-text-primary tracking-[-0.3px]">Create Environment</h3>
            <p className="text-[13px] text-text-muted mt-0.5">Add a new environment to organize assets</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center border border-border text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-all active:scale-95"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col p-6 gap-5 overflow-y-auto">
          {error && (
            <div className="p-3 bg-error-bg border border-error-border rounded-[10px] text-error-text text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-[12px] font-semibold uppercase tracking-[0.4px] text-text-secondary mb-2">
              Name *
            </label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Production IT"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-[12px] font-semibold uppercase tracking-[0.4px] text-text-secondary mb-2">
              Description
            </label>
            <TextArea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of this environment"
              rows={3}
            />
          </div>

          <div>
            <label htmlFor="labels" className="block text-[12px] font-semibold uppercase tracking-[0.4px] text-text-secondary mb-2">
              Labels
            </label>
            <Input
              id="labels"
              type="text"
              value={labelsInput}
              onChange={(e) => setLabelsInput(e.target.value)}
              placeholder="e.g., prod, it, hq (comma separated)"
            />
            <p className="mt-1.5 text-[11px] text-text-muted">Separate multiple labels with commas</p>
          </div>

          <div className="flex-1" />

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading} disabled={!name.trim()} className="flex-1">
              Create
            </Button>
          </div>
        </form>
      </aside>
    </>
  );
}

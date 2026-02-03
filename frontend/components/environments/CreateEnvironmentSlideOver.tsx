"use client";

import { useState } from "react";
import { FiX } from "react-icons/fi";
import { createEnvironment, type CreateEnvironmentInput } from "@/lib/api";

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
      
      // Reset form
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
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 transition-opacity duration-300 z-40 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-md bg-surface shadow-xl transform transition-transform duration-300 ease-in-out z-50 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-xl font-semibold text-text-primary">
              Create Environment
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-surface-secondary transition-colors"
            >
              <FiX className="w-5 h-5 text-text-secondary" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col p-6 gap-6">
            {error && (
              <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-text-primary mb-2"
              >
                Name *
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Production IT"
                required
                className="w-full px-4 py-3 rounded-lg border border-border bg-background text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-1 focus:border-transparent"
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-text-primary mb-2"
              >
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description of this environment"
                rows={3}
                className="w-full px-4 py-3 rounded-lg border border-border bg-background text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-1 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label
                htmlFor="labels"
                className="block text-sm font-medium text-text-primary mb-2"
              >
                Labels
              </label>
              <input
                type="text"
                id="labels"
                value={labelsInput}
                onChange={(e) => setLabelsInput(e.target.value)}
                placeholder="e.g., prod, it, hq (comma separated)"
                className="w-full px-4 py-3 rounded-lg border border-border bg-background text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-1 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-text-muted">
                Separate multiple labels with commas
              </p>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-lg border border-border text-text-secondary hover:bg-surface-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !name.trim()}
                className="flex-1 px-4 py-3 rounded-lg bg-brand-1 text-brand-2 font-medium hover:bg-brand-1/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Creating..." : "Create"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

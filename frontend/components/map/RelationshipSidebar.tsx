"use client";

import { useState } from "react";
import { FiX, FiTrash2, FiSave, FiAlertCircle } from "react-icons/fi";
import type { Edge } from "reactflow";
import type { Asset } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";

interface RelationshipSidebarProps {
  edge: Edge;
  assets: Asset[];
  onClose: () => void;
  onUpdate: (type: string, operationalCriticality: string, securityCriticality: string) => void;
  onDelete: () => void;
  isLoading?: boolean;
  error?: string | null;
}

const RELATIONSHIP_TYPES = [
  { value: "NETWORK_CONNECTS_TO", label: "Network Connects To" },
  { value: "MANAGED_BY", label: "Managed By" },
  { value: "AUTHENTICATES_VIA", label: "Authenticates Via" },
  { value: "EXECUTES_CODE_FROM", label: "Executes Code From" },
  { value: "RECEIVES_DATA_FROM", label: "Receives Data From" },
  { value: "SHARES_CREDENTIALS_WITH", label: "Shares Credentials With" },
];

const CRITICALITY_LEVELS = [
  { value: "low", label: "Low", colorClass: "text-success-text" },
  { value: "medium", label: "Medium", colorClass: "text-warning-text" },
  { value: "high", label: "High", colorClass: "text-error-text" },
];

const SECURITY_CRITICALITY_LEVELS = [
  { value: "low", label: "Low", colorClass: "text-success-text" },
  { value: "medium", label: "Medium", colorClass: "text-warning-text" },
  { value: "high", label: "High", colorClass: "text-error-text" },
  { value: "critical", label: "Critical", colorClass: "text-error-text" },
];

export default function RelationshipSidebar({ edge, assets, onClose, onUpdate, onDelete, isLoading = false, error = null }: RelationshipSidebarProps) {
  const relationship = edge.data?.relationship;
  const [type, setType] = useState(relationship?.type || "NETWORK_CONNECTS_TO");
  const [operationalCriticality, setOperationalCriticality] = useState(relationship?.operationalCriticality || "medium");
  const [securityCriticality, setSecurityCriticality] = useState(relationship?.securityCriticality || "low");
  const [isEditing, setIsEditing] = useState(false);

  const sourceAsset = assets.find(a => a.id === edge.source);
  const targetAsset = assets.find(a => a.id === edge.target);

  const handleSave = () => {
    onUpdate(type, operationalCriticality, securityCriticality);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setType(relationship?.type || "NETWORK_CONNECTS_TO");
    setOperationalCriticality(relationship?.operationalCriticality || "medium");
    setSecurityCriticality(relationship?.securityCriticality || "low");
    setIsEditing(false);
  };

  const selectedOperationalCriticality = CRITICALITY_LEVELS.find(c => c.value === operationalCriticality);
  const selectedSecurityCriticality = SECURITY_CRITICALITY_LEVELS.find(c => c.value === securityCriticality);

  return (
    <div className="w-80 bg-surface border-l border-border h-full overflow-y-auto flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-[18px] font-bold text-text-primary tracking-[-0.2px]">Relationship</h2>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center border border-transparent text-text-secondary hover:text-text-primary hover:border-border hover:bg-surface-secondary transition-all active:scale-95"
        >
          <FiX className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 space-y-6 flex-1">
        <div className="space-y-4">
          <h3 className="font-semibold text-text-primary">Connected Assets</h3>
          <div className="space-y-2">
            <div className="p-3 bg-background-secondary rounded-[10px]">
              <div className="text-sm text-text-secondary">From</div>
              <div className="font-semibold text-text-primary">{sourceAsset?.name || "Unknown Asset"}</div>
              <div className="text-xs text-text-muted">{sourceAsset?.type}</div>
            </div>
            <div className="flex justify-center">
              <div className="w-px h-6 bg-border"></div>
            </div>
            <div className="p-3 bg-background-secondary rounded-[10px]">
              <div className="text-sm text-text-secondary">To</div>
              <div className="font-semibold text-text-primary">{targetAsset?.name || "Unknown Asset"}</div>
              <div className="text-xs text-text-muted">{targetAsset?.type}</div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-text-primary">Properties</h3>
            {!isEditing && (
              <button onClick={() => setIsEditing(true)} className="text-sm text-brand-2 font-semibold hover:underline transition-colors">
                Edit
              </button>
            )}
          </div>

          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-[0.4px] text-text-secondary mb-2">Relationship Type</label>
            {isEditing ? (
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                {RELATIONSHIP_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
            ) : (
              <div className="px-3 py-2.5 bg-background-secondary rounded-[10px] text-text-primary text-[15px]">
                {RELATIONSHIP_TYPES.find(t => t.value === type)?.label || type}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-[0.4px] text-text-secondary mb-2">Operational Criticality</label>
            {isEditing ? (
              <Select value={operationalCriticality} onChange={(e) => setOperationalCriticality(e.target.value)}>
                {CRITICALITY_LEVELS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
            ) : (
              <div className={`px-3 py-2.5 bg-background-secondary rounded-[10px] font-semibold text-[15px] ${selectedOperationalCriticality?.colorClass || 'text-text-primary'}`}>
                {selectedOperationalCriticality?.label || operationalCriticality}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-[0.4px] text-text-secondary mb-2">Security Criticality</label>
            {isEditing ? (
              <Select value={securityCriticality} onChange={(e) => setSecurityCriticality(e.target.value)}>
                {SECURITY_CRITICALITY_LEVELS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
            ) : (
              <div className={`px-3 py-2.5 bg-background-secondary rounded-[10px] font-semibold text-[15px] ${selectedSecurityCriticality?.colorClass || 'text-text-primary'}`}>
                {selectedSecurityCriticality?.label || securityCriticality}
              </div>
            )}
          </div>

          {isEditing && (
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isLoading} isLoading={isLoading} className="flex-1">
                <FiSave className="w-4 h-4" />
                Save
              </Button>
              <Button variant="secondary" onClick={handleCancel} disabled={isLoading} className="flex-1">
                Cancel
              </Button>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 bg-error-bg border border-error-border rounded-[10px] flex gap-2 items-start">
            <FiAlertCircle className="w-4 h-4 text-error-text flex-shrink-0 mt-0.5" />
            <div className="text-sm text-error-text">{error}</div>
          </div>
        )}

        <div className="pt-4 border-t border-border">
          <Button variant="danger" onClick={onDelete} disabled={isLoading} isLoading={isLoading} className="w-full">
            <FiTrash2 className="w-4 h-4" />
            Delete Relationship
          </Button>
        </div>

        {relationship && (
          <div className="pt-4 border-t border-border space-y-2">
            <h3 className="font-semibold text-text-secondary">Metadata</h3>
            <div className="text-sm text-text-muted space-y-1">
              <div>ID: {relationship.id}</div>
              <div>Created: {new Date(relationship.createdAt).toLocaleDateString()}</div>
              <div>Updated: {new Date(relationship.updatedAt).toLocaleDateString()}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

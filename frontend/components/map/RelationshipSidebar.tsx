"use client"

import { useState } from "react"
import { X, Trash2, Save } from "lucide-react"
import type { Edge } from "reactflow"
import type { Asset } from "@/lib/api"

interface RelationshipSidebarProps {
  edge: Edge
  assets: Asset[]
  onClose: () => void
  onUpdate: (type: string, criticality: string) => void
  onDelete: () => void
}

const RELATIONSHIP_TYPES = [
  { value: "DEPENDS_ON", label: "Depends On" },
  { value: "CONNECTED_TO", label: "Connected To" },
  { value: "HOSTED_ON", label: "Hosted On" },
]

const CRITICALITY_LEVELS = [
  { value: "LOW", label: "Low", color: "text-green-600" },
  { value: "MEDIUM", label: "Medium", color: "text-yellow-600" },
  { value: "HIGH", label: "High", color: "text-red-600" },
]

export default function RelationshipSidebar({ edge, assets, onClose, onUpdate, onDelete }: RelationshipSidebarProps) {
  const relationship = edge.data?.relationship
  const [type, setType] = useState(relationship?.type || "DEPENDS_ON")
  const [criticality, setCriticality] = useState(relationship?.criticality || "MEDIUM")
  const [isEditing, setIsEditing] = useState(false)

  const sourceAsset = assets.find(a => a.id === edge.source)
  const targetAsset = assets.find(a => a.id === edge.target)

  const handleSave = () => {
    onUpdate(type, criticality)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setType(relationship?.type || "DEPENDS_ON")
    setCriticality(relationship?.criticality || "MEDIUM")
    setIsEditing(false)
  }

  return (
    <div className="w-80 bg-surface border-l border-border h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-text-primary">
          Relationship Details
        </h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-surface-secondary rounded-md transition-colors"
        >
          <X className="w-5 h-5 text-text-secondary" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Assets */}
        <div className="space-y-4">
          <h3 className="font-medium text-text-primary">Connected Assets</h3>
          
          <div className="space-y-2">
            <div className="p-3 bg-surface-secondary rounded-lg">
              <div className="text-sm text-text-secondary">From</div>
              <div className="font-medium text-text-primary">
                {sourceAsset?.name || "Unknown Asset"}
              </div>
              <div className="text-xs text-text-tertiary">
                {sourceAsset?.type}
              </div>
            </div>
            
            <div className="flex justify-center">
              <div className="w-px h-6 bg-border"></div>
            </div>
            
            <div className="p-3 bg-surface-secondary rounded-lg">
              <div className="text-sm text-text-secondary">To</div>
              <div className="font-medium text-text-primary">
                {targetAsset?.name || "Unknown Asset"}
              </div>
              <div className="text-xs text-text-tertiary">
                {targetAsset?.type}
              </div>
            </div>
          </div>
        </div>

        {/* Relationship Properties */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-text-primary">Properties</h3>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-sm text-brand-1 hover:text-brand-2 transition-colors"
              >
                Edit
              </button>
            )}
          </div>

          {/* Relationship Type */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Relationship Type
            </label>
            {isEditing ? (
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary focus:ring-2 focus:ring-brand-1 focus:border-brand-1"
              >
                {RELATIONSHIP_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <div className="px-3 py-2 bg-surface-secondary rounded-lg text-text-primary">
                {RELATIONSHIP_TYPES.find(t => t.value === type)?.label || type}
              </div>
            )}
          </div>

          {/* Criticality */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Criticality Level
            </label>
            {isEditing ? (
              <select
                value={criticality}
                onChange={(e) => setCriticality(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary focus:ring-2 focus:ring-brand-1 focus:border-brand-1"
              >
                {CRITICALITY_LEVELS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <div className={`px-3 py-2 bg-surface-secondary rounded-lg font-medium ${
                CRITICALITY_LEVELS.find(c => c.value === criticality)?.color || 'text-text-primary'
              }`}>
                {CRITICALITY_LEVELS.find(c => c.value === criticality)?.label || criticality}
              </div>
            )}
          </div>

          {/* Edit Actions */}
          {isEditing && (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-brand-1 text-white rounded-lg hover:bg-brand-2 transition-colors"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 px-3 py-2 bg-surface-secondary text-text-secondary rounded-lg hover:bg-surface-tertiary transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Delete Section */}
        <div className="pt-4 border-t border-border">
          <button
            onClick={onDelete}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-error-text hover:bg-error-bg rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete Relationship
          </button>
        </div>

        {/* Metadata */}
        {relationship && (
          <div className="pt-4 border-t border-border space-y-2">
            <h3 className="font-medium text-text-secondary">Metadata</h3>
            <div className="text-sm text-text-tertiary">
              <div>ID: {relationship.id}</div>
              <div>Created: {new Date(relationship.createdAt).toLocaleDateString()}</div>
              <div>Updated: {new Date(relationship.updatedAt).toLocaleDateString()}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
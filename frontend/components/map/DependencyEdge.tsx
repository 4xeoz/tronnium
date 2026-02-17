"use client";

import { memo } from "react";
import {
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
} from "reactflow";
import type { CriticalityLevel } from "@/lib/api";

/**
 * Custom edge component for asset relationships
 * Features:
 * - Color-coded by criticality (green=low, amber=medium, red=high)
 * - Animated arrows pointing to target
 * - Type labels showing relationship type
 * - Glow effect when selected
 * - Thicker strokes for higher criticality
 */

function getCriticalityColor(criticality: CriticalityLevel | undefined): string {
  if (!criticality) return "var(--border)";
  switch (criticality) {
    case "low":
      return "var(--success-text)";
    case "medium":
      return "var(--warning-text)";
    case "high":
      return "var(--error-text)";
    default:
      return "var(--border)";
  }
}

function getCriticalityWidth(criticality: CriticalityLevel | undefined, selected: boolean): number {
  if (selected) return 3;
  if (!criticality) return 1.5;
  switch (criticality) {
    case "low":
      return 1.75;
    case "medium":
      return 2;
    case "high":
      return 2.5;
    default:
      return 1.5;
  }
}

function DependencyEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps) {
  const criticality = data?.relationship?.criticality as CriticalityLevel | undefined;
  const relationType = (data?.relationship?.type || "DEPENDS_ON") as string;

  const color = selected ? "var(--brand-color-1)" : getCriticalityColor(criticality);
  const strokeWidth = getCriticalityWidth(criticality, !!selected);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const typeLabel = relationType
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");

  return (
    <>
      {/* Invisible fat hitbox for easier clicking */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="cursor-pointer"
      />

      {/* Main edge path with smooth curves */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        markerEnd={markerEnd}
        className="transition-all duration-200"
        style={{
          opacity: selected ? 1 : 0.7,
          filter: selected ? `drop-shadow(0 0 6px ${color})` : "none",
        }}
      />

      {/* Arrow marker */}
      <defs>
        <marker
          id={`arrow-${id}`}
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 10 3 L 0 6 Z" fill={color} />
        </marker>
      </defs>

      {/* Type and criticality label */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "none",
            zIndex: selected ? 10 : 1,
          }}
          className={`
            px-2 py-1 rounded text-[9px] font-semibold whitespace-nowrap
            border transition-all duration-200
            ${
              selected
                ? "bg-brand-1 text-brand-2 border-brand-1 shadow-lg opacity-100"
                : "bg-surface border-border text-text-muted opacity-0 group-hover:opacity-100"
            }
          `}
        >
          <span>{typeLabel}</span>
          {criticality && (
            <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded text-[7px] font-bold" style={{ backgroundColor: color, color: 'white' }}>
              {criticality.toUpperCase()}
            </span>
          )}
        </div>
      </EdgeLabelRenderer>

      {/* Criticality indicator dot on the path */}
      {criticality && (
        <circle
          cx={labelX}
          cy={labelY}
          r={criticality === "high" ? 2.5 : criticality === "medium" ? 2 : 1.5}
          fill={color}
          opacity={selected ? 1 : 0.5}
          className="transition-all duration-200"
        />
      )}
    </>
  );
}

export default memo(DependencyEdge);

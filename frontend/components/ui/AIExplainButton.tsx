"use client";

import { useState } from "react";
import { FiZap } from "react-icons/fi";
import { AIExplainModal } from "./AIExplainModal";
import { ScanSeverity } from "@/lib/api";

interface AIExplainButtonProps {
	cveId: string;
	description: string;
	cvssScore: number | null;
	severity: ScanSeverity;
}

export function AIExplainButton({
	cveId,
	description,
	cvssScore,
	severity,
}: AIExplainButtonProps) {
	const [isModalOpen, setIsModalOpen] = useState(false);

	return (
		<>
			<button
				onClick={() => setIsModalOpen(true)}
				className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 hover:border-indigo-500/50 rounded-lg transition-all duration-200"
				title="Get AI-powered explanation"
			>
				<FiZap className="w-3.5 h-3.5" />
				AI Explain
			</button>

			<AIExplainModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				cveId={cveId}
				description={description}
				cvssScore={cvssScore}
				severity={severity}
			/>
		</>
	);
}

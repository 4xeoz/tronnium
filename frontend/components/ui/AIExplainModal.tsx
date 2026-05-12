"use client";


import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FiX, FiZap, FiExternalLink, FiAlertCircle, FiCheckCircle } from "react-icons/fi";
import { fetchCveExplanation, type CveExplanation, type ScanSeverity} from "@/lib/api";
import { getSeverityColor } from "@/lib/formatters";

interface AIExplainModalProps {
	isOpen: boolean;
	onClose: () => void;
	cveId: string;
	description: string;
	cvssScore: number | null;
	severity: ScanSeverity;
}

export function AIExplainModal({
	isOpen,
	onClose,
	cveId,
	description,
	cvssScore,
	severity,
}: AIExplainModalProps) {
	const [explanation, setExplanation] = useState<CveExplanation | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [hasFetched, setHasFetched] = useState(false);

	const fetchExplanation = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const response = await fetchCveExplanation({
				cveId,
				description,
				cvssScore,
				severity,
			});
			setExplanation(response.data);
			
		} catch (err) {
			setError(err instanceof Error ? err.message : "An error occurred");
		} finally {
			setIsLoading(false);
		}
	}, [cveId, description, cvssScore, severity]);

	// Fetch explanation when modal opens
	useEffect(() => {
		if (isOpen && !hasFetched) {
			setHasFetched(true);
			fetchExplanation();
		}
	}, [isOpen, hasFetched, fetchExplanation]);

	// Reset state when modal closes
	useEffect(() => {
		if (!isOpen) {
			setExplanation(null);
			setError(null);
			setHasFetched(false);
		}
	}, [isOpen]);

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
						onClick={onClose}
					/>

					{/* Modal */}
					<motion.div
						initial={{ opacity: 0, scale: 0.95, y: 20 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: 20 }}
						transition={{ type: "spring", duration: 0.3 }}
						className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-50"
					>
						<div className="bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden mx-4">
							{/* Header */}
							<div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-secondary/50">
								<div className="flex items-center gap-3">
									<div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
										<FiZap className="w-4 h-4 text-indigo-500" />
									</div>
									<div>
										<h3 className="font-semibold text-text-primary">AI Analysis</h3>
										<span className="text-xs text-text-muted font-mono">{cveId}</span>
									</div>
								</div>
								<button
									onClick={onClose}
									className="w-8 h-8 rounded-lg hover:bg-surface-secondary flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
								>
									<FiX className="w-5 h-5" />
								</button>
							</div>

							{/* Content */}
							<div className="p-6 max-h-[70vh] overflow-y-auto">
								{/* Severity Badge */}
								<div className="flex items-center gap-2 mb-6">
									<span
										className={`px-2 py-1 rounded text-xs font-medium border ${getSeverityColor(
											severity
										)}`}
									>
										{severity}
									</span>
									{cvssScore && (
										<span className="text-xs text-text-secondary">
											CVSS: {cvssScore.toFixed(1)}
										</span>
									)}
								</div>

								{isLoading ? (
									<div className="flex flex-col items-center justify-center py-12">
										<div className="relative">
											<div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
											<div className="absolute inset-0 flex items-center justify-center">
												<FiZap className="w-5 h-5 text-indigo-500 animate-pulse" />
											</div>
										</div>
										<p className="mt-4 text-sm text-text-secondary">
											Analyzing vulnerability...
										</p>
									</div>
								) : error ? (
									<div className="flex flex-col items-center justify-center py-8 text-center">
										<FiAlertCircle className="w-12 h-12 text-error-text mb-3" />
										<p className="text-error-text text-sm mb-4">{error}</p>
										<button
											onClick={fetchExplanation}
											className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition-colors"
										>
											Try Again
										</button>
									</div>
								) : explanation ? (
									<div className="space-y-6">
										{/* Summary */}
										<div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4">
											<h4 className="text-xs font-medium text-indigo-500 uppercase tracking-wide mb-2">
												Summary
											</h4>
											<p className="text-sm text-text-primary leading-relaxed">
												{explanation.summary}
											</p>
										</div>

										{/* Impact */}
										<div>
											<h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
												Impact
											</h4>
											<p className="text-sm text-text-secondary leading-relaxed">
												{explanation.impact}
											</p>
										</div>

										{/* Remediation Steps */}
										<div>
											<h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">
												Remediation Steps
											</h4>
											<div className="space-y-2">
												{explanation.remediationSteps.map((step, index) => (
													<div
														key={index}
														className="flex items-start gap-3"
													>
														<div className="flex-shrink-0 w-5 h-5 rounded-full bg-success-bg border border-success-border flex items-center justify-center mt-0.5">
															<span className="text-[10px] font-medium text-success-text">
																{index + 1}
															</span>
														</div>
														<p className="text-sm text-text-secondary flex-1">{step}</p>
													</div>
												))}
											</div>
										</div>

										{/* Footer */}
										<div className="pt-4 border-t border-border">
											<div className="flex items-center justify-between">
												<span className="text-xs text-text-muted">
													Generated by AI • Verify with{" "}
													<a
														href={`https://nvd.nist.gov/vuln/detail/${cveId}`}
														target="_blank"
														rel="noopener noreferrer"
														className="text-indigo-500 hover:text-indigo-400 inline-flex items-center gap-1"
													>
														NVD
														<FiExternalLink className="w-3 h-3" />
													</a>
												</span>
												{explanation.model !== "stub" && (
													<span className="text-[10px] text-text-muted font-mono">
														{explanation.model}
													</span>
												)}
											</div>
										</div>
									</div>
								) : null}
							</div>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}

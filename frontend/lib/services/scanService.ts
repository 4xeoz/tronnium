import { fetchLatestScan, fetchScanHistory, fetchScanSettings, fetchVulnerabilityWorkflows } from "@/lib/api";
import { getRiskLevel, getSeverityColor } from "@/lib/formatters";

function toErrorResult(e: unknown) {
  return { success: false as const, data: null, message: e instanceof Error ? e.message : String(e) };
}

export async function getSecurityOverview(envId: string) {
  const [latestRes, historyRes, settingsRes, workflowRes] = await Promise.all([
    fetchLatestScan(envId).catch(toErrorResult),
    fetchScanHistory(envId, 10).catch(toErrorResult),
    fetchScanSettings(envId).catch(toErrorResult),
    fetchVulnerabilityWorkflows(envId).catch(toErrorResult),
  ]);

    let history = null;
    let settings = null;
    let latest = null;

    if (!latestRes.success && latestRes.message) {
      latest = { data: null ,  error: latestRes.message };
    } else {
      latest = { data: latestRes.data, error: null };
    }

    if (!historyRes.success && historyRes.message) {
      history = { data: null ,  error: historyRes.message };
    } else {
      history = { data: historyRes.data, error: null };
    }

    if (!settingsRes.success && settingsRes.message) {
      settings = { data: null ,  error: settingsRes.message };
    } else {
      settings = { data: settingsRes.data, error: null };
    }

    


  return {
    latestScan: latest ?? null,
    history: history,
    settings: settings,
    workflows: {
      data: workflowRes.success ? workflowRes.data : null,
      error: workflowRes.success ? null : workflowRes.message,
    }
  };
}
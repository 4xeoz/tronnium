import { fetchEnvironmentById, fetchAssets, fetchDashboardOverview } from "@/lib/api";
import type { Environment, Asset } from "@/lib/api";
import { env } from "process";

export async function getEnvironmentDetail(envId: string) {
  const [envRes, assetsRes, overviewRes] = await Promise.all([
    fetchEnvironmentById(envId),
    fetchAssets(envId),
    fetchDashboardOverview(envId),
  ]);


  let environment = null;
  let assets = null;
  let overview = null;

    if (!envRes.success && envRes.message) {
      environment = { data: null ,  error: envRes.message };
    } else {
      environment = { data: envRes.data, error: null };
    }

    if (!assetsRes.success && assetsRes.message) {
      assets = { data: null ,  error: assetsRes.message };
    } else {
      assets = { data: assetsRes.data, error: null };
    }

    if (overviewRes && !overviewRes.success && overviewRes.message) {
      overview = { data: null ,  error: overviewRes.message };
    } else if (overviewRes) {
      overview = { data: overviewRes.data, error: null };
    }




  return { 
    environment: environment,
    assets: assets,
    overview: overview,

   }
}



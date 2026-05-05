import { FiServer, FiDatabase, FiWifi, FiHardDrive, FiCpu } from "react-icons/fi";

export const typeIcons: Record<string, React.ElementType> = {
  server: FiServer,
  database: FiDatabase,
  network: FiWifi,
  iot: FiHardDrive,
  unknown: FiCpu,
};

export const SEVERITY_BADGE: Record<string, { variant: "error" | "warning" | "info" | "success"; text: string }> = {
  CRITICAL: { variant: "error", text: "CRIT" },
  HIGH:     { variant: "warning", text: "HIGH" },
  MEDIUM:   { variant: "info", text: "MED" },
  LOW:      { variant: "success", text: "LOW" },
};

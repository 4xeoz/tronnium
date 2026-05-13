import type { RelationType } from "@prisma/client";

export type SeedVuln = {
  cveIdPrefix: string;
  description: string;
  cvssScore: number;
  cvssVector: string;
  epssPercentile: number;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
};

export type SeedAsset = {
  key: string;
  name: string;
  type: string;
  domain: "IT" | "OT" | "UNKNOWN";
  isExternallyFacing: boolean;
  vulns?: SeedVuln[];
};

export type SeedRelationship = {
  fromKey: string;
  toKey: string;
  type: RelationType;
  operationalCriticality: "LOW" | "MEDIUM" | "HIGH";
  securityCriticality: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
};

export type SeedTemplate = {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  tags: string[];
  assets: SeedAsset[];
  relationships: SeedRelationship[];
};

export const SEED_TEMPLATES: SeedTemplate[] = [
  // ── Template 1: Enterprise IT Network ────────────────────────────────────
  {
    id: "enterprise-it",
    name: "Enterprise IT Network",
    description: "Classic enterprise stack with web-facing services, internal APIs, and databases.",
    longDescription:
      "Demonstrates multi-hop lateral movement: an internet-facing web server with a high-confidence RCE vulnerability is the entry point. From there the attacker pivots to an internal API server, then to a database and auth service via credential theft. Good for understanding compromise score decay across hops.",
    tags: ["IT", "web", "database", "credential-theft"],
    assets: [
      {
        key: "web",
        name: "External Web Server",
        type: "server",
        domain: "IT",
        isExternallyFacing: true,
        vulns: [
          {
            cveIdPrefix: "CVE-0000-10001",
            description: "Remote code execution via deserialization in web framework. Attacker-controlled input reaches ObjectInputStream without sanitization, enabling full server compromise.",
            cvssScore: 9.8,
            cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
            epssPercentile: 0.75,
            severity: "CRITICAL",
          },
        ],
      },
      {
        key: "api",
        name: "Internal API Server",
        type: "server",
        domain: "IT",
        isExternallyFacing: false,
        vulns: [
          {
            cveIdPrefix: "CVE-0000-10002",
            description: "Broken access control allows authenticated users to access other users' data. Authentication tokens are predictable, enabling credential theft across accounts.",
            cvssScore: 7.5,
            cvssVector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N",
            epssPercentile: 0.55,
            severity: "HIGH",
          },
        ],
      },
      {
        key: "db",
        name: "User Database",
        type: "database",
        domain: "IT",
        isExternallyFacing: false,
      },
      {
        key: "auth",
        name: "Auth Service",
        type: "server",
        domain: "IT",
        isExternallyFacing: false,
      },
      {
        key: "storage",
        name: "File Storage",
        type: "server",
        domain: "IT",
        isExternallyFacing: false,
      },
    ],
    relationships: [
      { fromKey: "web", toKey: "api", type: "NETWORK_CONNECTS_TO", operationalCriticality: "HIGH", securityCriticality: "HIGH" },
      { fromKey: "api", toKey: "db", type: "NETWORK_CONNECTS_TO", operationalCriticality: "HIGH", securityCriticality: "CRITICAL" },
      { fromKey: "api", toKey: "auth", type: "AUTHENTICATES_VIA", operationalCriticality: "HIGH", securityCriticality: "HIGH" },
      { fromKey: "web", toKey: "storage", type: "RECEIVES_DATA_FROM", operationalCriticality: "MEDIUM", securityCriticality: "MEDIUM" },
    ],
  },

  // ── Template 2: Cloud Microservices ──────────────────────────────────────
  {
    id: "cloud-microservices",
    name: "Cloud Microservices",
    description: "Container-based microservices deployment with API gateway, payment processing, and message queues.",
    longDescription:
      "A compromised API gateway (container escape) can reach every downstream service in one or two hops. The payment service has a SQL injection that compounds the blast radius. Useful for demonstrating how a flat microservices architecture without segmentation amplifies a single entry point.",
    tags: ["IT", "cloud", "containers", "microservices"],
    assets: [
      {
        key: "gateway",
        name: "API Gateway",
        type: "network",
        domain: "IT",
        isExternallyFacing: true,
        vulns: [
          {
            cveIdPrefix: "CVE-0000-20001",
            description: "Container escape via runc symlink race condition. Attacker can write to host filesystem and pivot to adjacent containers, escalating to full cluster compromise.",
            cvssScore: 10.0,
            cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
            epssPercentile: 0.82,
            severity: "CRITICAL",
          },
        ],
      },
      {
        key: "user-svc",
        name: "User Service",
        type: "server",
        domain: "IT",
        isExternallyFacing: false,
        vulns: [
          {
            cveIdPrefix: "CVE-0000-20002",
            description: "JWT secret hardcoded in environment variable leaked via debug endpoint. Allows forging arbitrary user tokens and exfiltrating PII from the user database.",
            cvssScore: 7.5,
            cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
            epssPercentile: 0.55,
            severity: "HIGH",
          },
        ],
      },
      {
        key: "order-svc",
        name: "Order Service",
        type: "server",
        domain: "IT",
        isExternallyFacing: false,
      },
      {
        key: "payment-svc",
        name: "Payment Service",
        type: "server",
        domain: "IT",
        isExternallyFacing: false,
        vulns: [
          {
            cveIdPrefix: "CVE-0000-20003",
            description: "SQL injection in payment processing endpoint allows extracting full payment records and executing arbitrary database commands, including UNION-based data exfiltration.",
            cvssScore: 9.1,
            cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N",
            epssPercentile: 0.6,
            severity: "CRITICAL",
          },
        ],
      },
      {
        key: "queue",
        name: "Message Queue",
        type: "server",
        domain: "IT",
        isExternallyFacing: false,
      },
      {
        key: "pgdb",
        name: "PostgreSQL Database",
        type: "database",
        domain: "IT",
        isExternallyFacing: false,
      },
    ],
    relationships: [
      { fromKey: "gateway", toKey: "user-svc", type: "NETWORK_CONNECTS_TO", operationalCriticality: "HIGH", securityCriticality: "HIGH" },
      { fromKey: "gateway", toKey: "order-svc", type: "NETWORK_CONNECTS_TO", operationalCriticality: "HIGH", securityCriticality: "HIGH" },
      { fromKey: "gateway", toKey: "payment-svc", type: "NETWORK_CONNECTS_TO", operationalCriticality: "HIGH", securityCriticality: "CRITICAL" },
      { fromKey: "user-svc", toKey: "pgdb", type: "NETWORK_CONNECTS_TO", operationalCriticality: "HIGH", securityCriticality: "CRITICAL" },
      { fromKey: "order-svc", toKey: "queue", type: "RECEIVES_DATA_FROM", operationalCriticality: "MEDIUM", securityCriticality: "MEDIUM" },
      { fromKey: "payment-svc", toKey: "pgdb", type: "NETWORK_CONNECTS_TO", operationalCriticality: "HIGH", securityCriticality: "CRITICAL" },
    ],
  },

  // ── Template 3: Zero Trust Failure Paths ─────────────────────────────────
  {
    id: "zero-trust-failure",
    name: "Zero Trust Failure Paths",
    description: "Jump host compromise cascades through CI/CD, container registries, and a secrets manager to production.",
    longDescription:
      "Shows how a single critical RCE on a jump host can break zero-trust assumptions. The attacker pivots through the CI/CD server (which has code execution + credential access), then reaches the secrets manager and ultimately the production database. Demonstrates the danger of shared credentials and implicit trust between pipeline components.",
    tags: ["IT", "zero-trust", "CI/CD", "secrets"],
    assets: [
      {
        key: "jump",
        name: "Jump Host",
        type: "server",
        domain: "IT",
        isExternallyFacing: true,
        vulns: [
          {
            cveIdPrefix: "CVE-0000-50001",
            description: "Critical RCE in SSH daemon via memory corruption. Pre-auth, no user interaction required. Full system compromise from internet with a single packet.",
            cvssScore: 10.0,
            cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
            epssPercentile: 0.88,
            severity: "CRITICAL",
          },
        ],
      },
      {
        key: "dev-ws",
        name: "Developer Workstation",
        type: "server",
        domain: "IT",
        isExternallyFacing: false,
      },
      {
        key: "cicd",
        name: "CI/CD Server",
        type: "server",
        domain: "IT",
        isExternallyFacing: false,
        vulns: [
          {
            cveIdPrefix: "CVE-0000-50002",
            description: "Server-side template injection in pipeline configuration parser enables arbitrary code execution. Pipeline secrets (registry credentials, deploy keys) are accessible in the execution context.",
            cvssScore: 8.1,
            cvssVector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N",
            epssPercentile: 0.6,
            severity: "HIGH",
          },
        ],
      },
      {
        key: "registry",
        name: "Container Registry",
        type: "server",
        domain: "IT",
        isExternallyFacing: false,
      },
      {
        key: "secrets",
        name: "Secrets Manager",
        type: "server",
        domain: "IT",
        isExternallyFacing: false,
        vulns: [
          {
            cveIdPrefix: "CVE-0000-50003",
            description: "Path traversal in secret retrieval API allows privileged users to access secrets outside their namespace, including database credentials and API keys from other tenants.",
            cvssScore: 6.0,
            cvssVector: "CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:U/C:H/I:N/A:N",
            epssPercentile: 0.5,
            severity: "MEDIUM",
          },
        ],
      },
      {
        key: "prod-db",
        name: "Production Database",
        type: "database",
        domain: "IT",
        isExternallyFacing: false,
      },
    ],
    relationships: [
      { fromKey: "jump", toKey: "dev-ws", type: "SHARES_CREDENTIALS_WITH", operationalCriticality: "MEDIUM", securityCriticality: "MEDIUM" },
      { fromKey: "jump", toKey: "cicd", type: "NETWORK_CONNECTS_TO", operationalCriticality: "HIGH", securityCriticality: "HIGH" },
      { fromKey: "dev-ws", toKey: "cicd", type: "AUTHENTICATES_VIA", operationalCriticality: "HIGH", securityCriticality: "HIGH" },
      { fromKey: "cicd", toKey: "registry", type: "EXECUTES_CODE_FROM", operationalCriticality: "HIGH", securityCriticality: "CRITICAL" },
      { fromKey: "cicd", toKey: "secrets", type: "AUTHENTICATES_VIA", operationalCriticality: "HIGH", securityCriticality: "CRITICAL" },
      { fromKey: "secrets", toKey: "prod-db", type: "AUTHENTICATES_VIA", operationalCriticality: "HIGH", securityCriticality: "CRITICAL" },
      { fromKey: "registry", toKey: "prod-db", type: "NETWORK_CONNECTS_TO", operationalCriticality: "MEDIUM", securityCriticality: "HIGH" },
    ],
  },

  // ── Template 4: OT Power Grid (ICS/SCADA) ────────────────────────────────
  {
    id: "ot-power-grid",
    name: "OT Power Grid (ICS/SCADA)",
    description: "Industrial control system for a power grid. Features adjacent-only (AV:A) vulnerabilities on PLCs showing OT-IT convergence risks.",
    longDescription:
      "An HMI workstation exposed on the corporate network is the entry point. From there the attacker reaches the SCADA server and engineering workstation, then pivots to PLC controllers via adjacent-only Modbus vulnerabilities (AV:A). The AV:A classification increases traversal cost — the attacker must first gain a foothold on the OT network segment. Highlights why OT-IT network segmentation is critical.",
    tags: ["OT", "ICS", "SCADA", "PLC", "AV:A"],
    assets: [
      {
        key: "hmi",
        name: "HMI Workstation",
        type: "server",
        domain: "OT",
        isExternallyFacing: true,
        vulns: [
          {
            cveIdPrefix: "CVE-0000-30001",
            description: "Remote code execution in SCADA HMI software via malformed project file parsing. Attacker can execute arbitrary commands with SYSTEM privileges through the engineering interface.",
            cvssScore: 9.0,
            cvssVector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:H/A:H",
            epssPercentile: 0.62,
            severity: "CRITICAL",
          },
        ],
      },
      {
        key: "ews",
        name: "Engineering Workstation",
        type: "server",
        domain: "OT",
        isExternallyFacing: false,
        vulns: [
          {
            cveIdPrefix: "CVE-0000-30002",
            description: "Plaintext credential storage in legacy OT engineering software. Credentials for PLCs and RTUs stored in world-readable config files, enabling lateral movement to field devices.",
            cvssScore: 6.5,
            cvssVector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N",
            epssPercentile: 0.4,
            severity: "HIGH",
          },
        ],
      },
      {
        key: "scada",
        name: "SCADA Server",
        type: "server",
        domain: "OT",
        isExternallyFacing: false,
      },
      {
        key: "plc-a",
        name: "PLC Controller A",
        type: "iot",
        domain: "OT",
        isExternallyFacing: false,
        vulns: [
          {
            cveIdPrefix: "CVE-0000-30003",
            description: "Unauthenticated Modbus command injection on adjacent OT network segment. Attacker can write arbitrary coil/register values, overriding physical process control logic and causing unsafe states.",
            cvssScore: 8.1,
            cvssVector: "CVSS:3.1/AV:A/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H",
            epssPercentile: 0.35,
            severity: "HIGH",
          },
        ],
      },
      {
        key: "plc-b",
        name: "PLC Controller B",
        type: "iot",
        domain: "OT",
        isExternallyFacing: false,
      },
      {
        key: "historian",
        name: "Historian Server",
        type: "database",
        domain: "IT",
        isExternallyFacing: false,
      },
    ],
    relationships: [
      { fromKey: "hmi", toKey: "scada", type: "MANAGED_BY", operationalCriticality: "HIGH", securityCriticality: "HIGH" },
      { fromKey: "hmi", toKey: "ews", type: "SHARES_CREDENTIALS_WITH", operationalCriticality: "MEDIUM", securityCriticality: "MEDIUM" },
      { fromKey: "ews", toKey: "plc-a", type: "EXECUTES_CODE_FROM", operationalCriticality: "HIGH", securityCriticality: "HIGH" },
      { fromKey: "ews", toKey: "plc-b", type: "EXECUTES_CODE_FROM", operationalCriticality: "HIGH", securityCriticality: "HIGH" },
      { fromKey: "scada", toKey: "historian", type: "RECEIVES_DATA_FROM", operationalCriticality: "LOW", securityCriticality: "LOW" },
      { fromKey: "plc-a", toKey: "plc-b", type: "NETWORK_CONNECTS_TO", operationalCriticality: "MEDIUM", securityCriticality: "MEDIUM" },
    ],
  },

  // ── Template 5: OT Manufacturing Floor ───────────────────────────────────
  {
    id: "ot-manufacturing",
    name: "OT Manufacturing Floor",
    description: "Factory automation with MES, robot controllers, and safety PLCs. Shows AV:A propagation through proprietary industrial protocols.",
    longDescription:
      "An operator terminal connected to the corporate network is the entry point (spear-phishing RCE requiring user interaction). Once inside, the attacker reaches the MES server which has a clean network-pivot vuln, then fans out to robot controllers via adjacent-only proprietary bus vulnerabilities and finally to the safety PLC. Safety PLC compromise represents the highest-severity outcome — loss of safe state. Illustrates how UI-required entry points still lead to catastrophic outcomes if the blast radius is not contained.",
    tags: ["OT", "manufacturing", "MES", "robots", "safety", "AV:A"],
    assets: [
      {
        key: "operator",
        name: "Operator Terminal",
        type: "server",
        domain: "OT",
        isExternallyFacing: true,
        vulns: [
          {
            cveIdPrefix: "CVE-0000-40001",
            description: "Remote code execution via malicious HMI project file delivered through spear-phishing. Operator must open the crafted file, triggering a memory corruption exploit in the industrial HMI client.",
            cvssScore: 9.6,
            cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:H/I:H/A:H",
            epssPercentile: 0.7,
            severity: "CRITICAL",
          },
        ],
      },
      {
        key: "mes",
        name: "MES Server",
        type: "server",
        domain: "OT",
        isExternallyFacing: false,
        vulns: [
          {
            cveIdPrefix: "CVE-0000-40002",
            description: "Unauthenticated RCE in Manufacturing Execution System web console via command injection in production order processing endpoint. Full system compromise with no credentials required.",
            cvssScore: 9.0,
            cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:N",
            epssPercentile: 0.55,
            severity: "CRITICAL",
          },
        ],
      },
      {
        key: "robot1",
        name: "Robot Controller 1",
        type: "iot",
        domain: "OT",
        isExternallyFacing: false,
        vulns: [
          {
            cveIdPrefix: "CVE-0000-40003",
            description: "Unauthenticated command injection over proprietary fieldbus protocol (EtherNet/IP) on adjacent OT segment. Attacker can override joint position commands, causing unsafe mechanical movement.",
            cvssScore: 8.1,
            cvssVector: "CVSS:3.1/AV:A/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H",
            epssPercentile: 0.3,
            severity: "HIGH",
          },
        ],
      },
      {
        key: "robot2",
        name: "Robot Controller 2",
        type: "iot",
        domain: "OT",
        isExternallyFacing: false,
      },
      {
        key: "safety-plc",
        name: "Safety PLC",
        type: "iot",
        domain: "OT",
        isExternallyFacing: false,
      },
      {
        key: "qc-sensor",
        name: "QC Sensor Network",
        type: "iot",
        domain: "OT",
        isExternallyFacing: false,
      },
    ],
    relationships: [
      { fromKey: "operator", toKey: "mes", type: "MANAGED_BY", operationalCriticality: "HIGH", securityCriticality: "CRITICAL" },
      { fromKey: "mes", toKey: "robot1", type: "EXECUTES_CODE_FROM", operationalCriticality: "HIGH", securityCriticality: "HIGH" },
      { fromKey: "mes", toKey: "robot2", type: "EXECUTES_CODE_FROM", operationalCriticality: "HIGH", securityCriticality: "HIGH" },
      { fromKey: "mes", toKey: "safety-plc", type: "MANAGED_BY", operationalCriticality: "HIGH", securityCriticality: "CRITICAL" },
      { fromKey: "robot1", toKey: "safety-plc", type: "NETWORK_CONNECTS_TO", operationalCriticality: "MEDIUM", securityCriticality: "MEDIUM" },
      { fromKey: "mes", toKey: "qc-sensor", type: "RECEIVES_DATA_FROM", operationalCriticality: "LOW", securityCriticality: "LOW" },
    ],
  },
];

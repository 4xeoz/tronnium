import type { RelationType } from "@prisma/client";

export type SeedVuln = {
  cveIdPrefix: string;
  description: string;
  cvssScore: number;
  cvssVector: string;
  epssPercentile: number;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
};

export type SeedCpe = {
  name: string;
  title: string;
  vendor: string;
  product: string;
  version: string;
};

export type SeedAsset = {
  key: string;
  name: string;
  type: string;
  domain: "IT" | "OT" | "UNKNOWN";
  isExternallyFacing: boolean;
  cpe: SeedCpe;
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
    description: "A classic three-tier app where a public web server becomes the doorway to everything inside.",
    longDescription:
      "The Problem: The external web server is directly reachable from the internet and runs a critical unauthenticated RCE (CVSS 9.8). It should never have been exposed without a WAF or VPN gateway.\n\n" +
      "What Happened: An attacker sends a single malicious payload to the web server and gains full control. From there they move laterally to the internal API server, extract credentials from its broken access control, and use those stolen credentials to access the user database and authentication service. The file storage is also reachable but gated.\n\n" +
      "What You'll Discover: The app detects 1 attack entry point (the web server) with a compromise score around 95%. The API server is reachable in 1 hop at roughly 75%. The database and auth service sit at 2 hops with scores around 55% — showing how compromise decays with distance. The file storage appears as a gated node (lock icon) because the traversal cost exceeds the default budget.",
    tags: ["IT", "web", "database", "credential-theft"],
    assets: [
      {
        key: "web",
        name: "External Web Server",
        type: "server",
        domain: "IT",
        isExternallyFacing: true,
        cpe: { name: "cpe:2.3:a:nginx:nginx:1.24.0:*:*:*:*:*:*:*", title: "Nginx 1.24.0", vendor: "nginx", product: "nginx", version: "1.24.0" },
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
        cpe: { name: "cpe:2.3:a:nodejs:node.js:18.12.0:*:*:*:*:*:*:*", title: "Node.js 18.12.0", vendor: "nodejs", product: "node.js", version: "18.12.0" },
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
        cpe: { name: "cpe:2.3:a:postgresql:postgresql:15.1:*:*:*:*:*:*:*", title: "PostgreSQL 15.1", vendor: "postgresql", product: "postgresql", version: "15.1" },
      },
      {
        key: "auth",
        name: "Auth Service",
        type: "server",
        domain: "IT",
        isExternallyFacing: false,
        cpe: { name: "cpe:2.3:a:redhat:keycloak:21.0.1:*:*:*:*:*:*:*", title: "Keycloak 21.0.1", vendor: "redhat", product: "keycloak", version: "21.0.1" },
      },
      {
        key: "storage",
        name: "File Storage",
        type: "server",
        domain: "IT",
        isExternallyFacing: false,
        cpe: { name: "cpe:2.3:a:minio:minio:2023.1.1:*:*:*:*:*:*:*", title: "MinIO 2023.1.1", vendor: "minio", product: "minio", version: "2023.1.1" },
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
    description: "A flat Kubernetes-style deployment where one compromised gateway exposes every service downstream.",
    longDescription:
      "The Problem: The API gateway is internet-facing and vulnerable to container escape (CVSS 10.0). Worse, the microservices architecture has no network segmentation — every service talks directly to every other service through the gateway.\n\n" +
      "What Happened: The attacker breaks out of the gateway container onto the host, then has direct network access to the user service, order service, payment service, and message queue. The payment service also has a SQL injection, letting the attacker extract payment records directly from the shared PostgreSQL database.\n\n" +
      "What You'll Discover: The app detects 1 entry point (the gateway) with a near-100% compromise score. Because the architecture is flat, almost every asset is reachable within 1–2 hops. The blast radius will be wide — you'll see 6 assets reached with high scores across the board. This is the classic 'one entry, total exposure' pattern that flat microservices create.",
    tags: ["IT", "cloud", "containers", "microservices"],
    assets: [
      {
        key: "gateway",
        name: "API Gateway",
        type: "network",
        domain: "IT",
        isExternallyFacing: true,
        cpe: { name: "cpe:2.3:a:konghq:kong:3.2.0:*:*:*:*:*:*:*", title: "Kong Gateway 3.2.0", vendor: "konghq", product: "kong", version: "3.2.0" },
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
        cpe: { name: "cpe:2.3:a:vmware:spring_boot:3.0.0:*:*:*:*:*:*:*", title: "Spring Boot 3.0.0", vendor: "vmware", product: "spring_boot", version: "3.0.0" },
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
        cpe: { name: "cpe:2.3:a:djangoproject:django:4.2:*:*:*:*:*:*:*", title: "Django 4.2", vendor: "djangoproject", product: "django", version: "4.2" },
      },
      {
        key: "payment-svc",
        name: "Payment Service",
        type: "server",
        domain: "IT",
        isExternallyFacing: false,
        cpe: { name: "cpe:2.3:a:golang:go:1.20.0:*:*:*:*:*:*:*", title: "Go 1.20.0", vendor: "golang", product: "go", version: "1.20.0" },
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
        cpe: { name: "cpe:2.3:a:pivotal_software:rabbitmq:3.11.0:*:*:*:*:*:*:*", title: "RabbitMQ 3.11.0", vendor: "pivotal_software", product: "rabbitmq", version: "3.11.0" },
      },
      {
        key: "pgdb",
        name: "PostgreSQL Database",
        type: "database",
        domain: "IT",
        isExternallyFacing: false,
        cpe: { name: "cpe:2.3:a:postgresql:postgresql:15.1:*:*:*:*:*:*:*", title: "PostgreSQL 15.1", vendor: "postgresql", product: "postgresql", version: "15.1" },
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
    description: "A 'zero trust' pipeline that collapses because one jump host shares credentials with everything else.",
    longDescription:
      "The Problem: The jump host is exposed to the internet and runs a pre-auth RCE (CVSS 10.0). Despite the 'zero trust' label, the CI/CD pipeline, container registry, secrets manager, and production database all trust each other's credentials implicitly. There is no segmentation between build and production.\n\n" +
      "What Happened: The attacker owns the jump host, then uses shared SSH credentials to reach the developer workstation. From there they authenticate to the CI/CD server, which has template injection allowing arbitrary code execution. The CI/CD server can push code to the container registry and authenticate to the secrets manager. The secrets manager holds the production database credentials. Every hop is authenticated — the attacker never needs to exploit another vulnerability after the first one.\n\n" +
      "What You'll Discover: The app detects 1 entry point (the jump host) with a compromise score near 100%. The CI/CD server and secrets manager will show elevated knowledge scores because the traversal uses AUTHENTICATES_VIA and SHARES_CREDENTIALS_WITH edges — the engine tracks credential theft as a separate knowledge metric. You'll see the production database as reachable in 3–4 hops, demonstrating that 'zero trust' without credential isolation is just trust with extra steps.",
    tags: ["IT", "zero-trust", "CI/CD", "secrets"],
    assets: [
      {
        key: "jump",
        name: "Jump Host",
        type: "server",
        domain: "IT",
        isExternallyFacing: true,
        cpe: { name: "cpe:2.3:a:openbsd:openssh:9.0p1:*:*:*:*:*:*:*", title: "OpenSSH 9.0p1", vendor: "openbsd", product: "openssh", version: "9.0p1" },
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
        cpe: { name: "cpe:2.3:o:microsoft:windows_11:22h2:*:*:*:*:*:*:*", title: "Windows 11 22H2", vendor: "microsoft", product: "windows_11", version: "22h2" },
      },
      {
        key: "cicd",
        name: "CI/CD Server",
        type: "server",
        domain: "IT",
        isExternallyFacing: false,
        cpe: { name: "cpe:2.3:a:jenkins:jenkins:2.387.3:*:*:*:*:*:*:*", title: "Jenkins 2.387.3", vendor: "jenkins", product: "jenkins", version: "2.387.3" },
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
        cpe: { name: "cpe:2.3:a:docker:registry:2.8.1:*:*:*:*:*:*:*", title: "Docker Registry 2.8.1", vendor: "docker", product: "registry", version: "2.8.1" },
      },
      {
        key: "secrets",
        name: "Secrets Manager",
        type: "server",
        domain: "IT",
        isExternallyFacing: false,
        cpe: { name: "cpe:2.3:a:hashicorp:vault:1.13.0:*:*:*:*:*:*:*", title: "HashiCorp Vault 1.13.0", vendor: "hashicorp", product: "vault", version: "1.13.0" },
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
        cpe: { name: "cpe:2.3:a:postgresql:postgresql:14.5:*:*:*:*:*:*:*", title: "PostgreSQL 14.5", vendor: "postgresql", product: "postgresql", version: "14.5" },
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
    description: "A power grid where the IT corporate network bleeds straight into OT controllers with no air gap.",
    longDescription:
      "The Problem: The HMI workstation is on the corporate network and reachable from the internet. It manages the SCADA server, which controls the power grid's PLC controllers. There is no meaningful segmentation between IT and OT — the engineering workstation has credentials for both networks.\n\n" +
      "What Happened: The attacker exploits the HMI's remote code execution vulnerability to gain a foothold. They pivot to the SCADA server, then use the engineering workstation's stored plaintext credentials to reach the PLC controllers. The PLCs are vulnerable to unauthenticated Modbus command injection, but only from adjacent network segments (AV:A), meaning the attacker must first land on the OT network.\n\n" +
      "What You'll Discover: The app detects 1 entry point (the HMI workstation). The PLC controllers will show as reachable but with higher traversal costs due to their AV:A (adjacent-only) attack vector — the engine increases edge cost when the source lacks a direct network-pivot vulnerability. You'll see a clear IT→OT convergence path: HMI → SCADA → Engineering WS → PLCs. The historian server is reachable but with low security criticality, showing up as a lower-priority node.",
    tags: ["OT", "ICS", "SCADA", "PLC", "AV:A"],
    assets: [
      {
        key: "hmi",
        name: "HMI Workstation",
        type: "server",
        domain: "OT",
        isExternallyFacing: true,
        cpe: { name: "cpe:2.3:a:siemens:wincc:7.5:*:*:*:*:*:*:*", title: "Siemens WinCC 7.5", vendor: "siemens", product: "wincc", version: "7.5" },
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
        cpe: { name: "cpe:2.3:a:siemens:tia_portal:17.0:*:*:*:*:*:*:*", title: "Siemens TIA Portal 17.0", vendor: "siemens", product: "tia_portal", version: "17.0" },
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
        cpe: { name: "cpe:2.3:a:ge:ifix:6.5:*:*:*:*:*:*:*", title: "GE iFIX 6.5", vendor: "ge", product: "ifix", version: "6.5" },
      },
      {
        key: "plc-a",
        name: "PLC Controller A",
        type: "iot",
        domain: "OT",
        isExternallyFacing: false,
        cpe: { name: "cpe:2.3:o:siemens:simatic_s7-1500_firmware:2.9.2:*:*:*:*:*:*:*", title: "Siemens S7-1500 Firmware 2.9.2", vendor: "siemens", product: "simatic_s7-1500_firmware", version: "2.9.2" },
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
        cpe: { name: "cpe:2.3:o:siemens:simatic_s7-1200_firmware:4.5.0:*:*:*:*:*:*:*", title: "Siemens S7-1200 Firmware 4.5.0", vendor: "siemens", product: "simatic_s7-1200_firmware", version: "4.5.0" },
      },
      {
        key: "historian",
        name: "Historian Server",
        type: "database",
        domain: "IT",
        isExternallyFacing: false,
        cpe: { name: "cpe:2.3:a:osisoft:pi_server:2018:*:*:*:*:*:*:*", title: "OSIsoft PI Server 2018", vendor: "osisoft", product: "pi_server", version: "2018" },
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
    description: "A factory floor where a single phished operator terminal can eventually reach the safety systems.",
    longDescription:
      "The Problem: The operator terminal is on the corporate network and vulnerable to spear-phishing RCE (CVSS 9.6, requires user interaction). The MES server, robot controllers, and safety PLC all sit on the same flat OT network with no segmentation between operational and safety systems.\n\n" +
      "What Happened: An operator opens a malicious HMI project file. The attacker gains control of the terminal, then pivots to the MES server which has an unauthenticated RCE in its web console. From the MES server the attacker fans out to both robot controllers via the proprietary fieldbus protocol, and finally to the safety PLC. The safety PLC has no direct vulnerability — it is reached purely through network connectivity from the MES server.\n\n" +
      "What You'll Discover: The app detects 1 entry point (the operator terminal) with a compromise score around 95%. The MES server acts as a major pivot point with a high network-pivot score, enabling wide blast radius. The robot controllers appear as reachable nodes with moderate scores. The safety PLC is the most critical outcome — it has no vulnerability of its own but is reachable through the graph, demonstrating how safety systems can be compromised indirectly when they share a network with operational gear. The QC sensor network is reachable but with low operational criticality.",
    tags: ["OT", "manufacturing", "MES", "robots", "safety", "AV:A"],
    assets: [
      {
        key: "operator",
        name: "Operator Terminal",
        type: "server",
        domain: "OT",
        isExternallyFacing: true,
        cpe: { name: "cpe:2.3:a:rockwellautomation:factorytalk_view:13.0:*:*:*:*:*:*:*", title: "FactoryTalk View 13.0", vendor: "rockwellautomation", product: "factorytalk_view", version: "13.0" },
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
        cpe: { name: "cpe:2.3:a:sap:manufacturing_execution:15.1:*:*:*:*:*:*:*", title: "SAP Manufacturing Execution 15.1", vendor: "sap", product: "manufacturing_execution", version: "15.1" },
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
        cpe: { name: "cpe:2.3:a:abb:robotware:7.0:*:*:*:*:*:*:*", title: "ABB RobotWare 7.0", vendor: "abb", product: "robotware", version: "7.0" },
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
        cpe: { name: "cpe:2.3:a:abb:robotware:7.0:*:*:*:*:*:*:*", title: "ABB RobotWare 7.0", vendor: "abb", product: "robotware", version: "7.0" },
      },
      {
        key: "safety-plc",
        name: "Safety PLC",
        type: "iot",
        domain: "OT",
        isExternallyFacing: false,
        cpe: { name: "cpe:2.3:o:rockwellautomation:guardlogix_5580_firmware:33.011:*:*:*:*:*:*:*", title: "GuardLogix 5580 Firmware 33.011", vendor: "rockwellautomation", product: "guardlogix_5580_firmware", version: "33.011" },
      },
      {
        key: "qc-sensor",
        name: "QC Sensor Network",
        type: "iot",
        domain: "OT",
        isExternallyFacing: false,
        cpe: { name: "cpe:2.3:a:cognex:in-sight_explorer:6.0:*:*:*:*:*:*:*", title: "Cognex In-Sight Explorer 6.0", vendor: "cognex", product: "in-sight_explorer", version: "6.0" },
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

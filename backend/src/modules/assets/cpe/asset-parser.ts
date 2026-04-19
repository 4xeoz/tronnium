import type { ParsedAsset } from "../../../types/cpe.types";

const KNOWN_VENDORS: Set<string> = new Set([
  "microsoft", "apple", "google", "apache", "oracle", "ibm", "cisco",
  "adobe", "mozilla", "linux", "canonical", "redhat", "debian", "ubuntu",
  "openssl", "openssh", "nginx", "php", "python", "nodejs", "java",
  "wordpress", "drupal", "joomla", "magento", "prestashop",
  "samsung", "huawei", "dell", "hp", "lenovo", "asus", "acer",
  "vmware", "citrix", "fortinet", "paloalto", "checkpoint",
  "ewon", "hms", "siemens", "schneider", "rockwell", "honeywell",
]);

const NON_VENDOR_WORDS: Set<string> = new Set([
  "server", "client", "firmware", "software", "hardware", "driver",
  "http", "https", "ftp", "ssh", "ssl", "tls", "tcp", "udp",
  "web", "mail", "dns", "proxy", "gateway", "firewall", "router",
  "the", "for", "and", "with", "pro", "enterprise", "professional",
  "standard", "edition", "version", "update", "patch", "release",
]);

async function normalizedText(
  text: string,
  options?: { preserveVersions?: boolean }
): Promise<string> {
  const opts = options || {};
  opts.preserveVersions = opts.preserveVersions ?? false;

  if (opts.preserveVersions) {
    return text
      .trim()
      .toLowerCase()
      .replace(/[_\-]/g, " ")
      .replace(/[^\w\s.]/g, "")
      .replace(/\s+/g, " ");
  }

  return text
    .trim()
    .toLowerCase()
    .replace(/[_\-.]/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}

function extractVersionFromRaw(text: string): {
  version: string | null;
  textWithoutVersion: string;
} {
  const versionPatterns = [
    /\bv?(\d+\.\d+\.\d+(?:\.\d+)?(?:[a-z]\d*)?)\b/i,
    /\bv?(\d+\.\d+(?:[a-z]\d*)?)\b/i,
    /\b(v\d+(?:\.\d+)*)\b/i,
  ];

  for (const pattern of versionPatterns) {
    const match = text.match(pattern);
    if (match) {
      const version = match[1].replace(/^v/i, "");
      const textWithoutVersion = text
        .replace(match[0], " ")
        .replace(/\s+/g, " ")
        .trim();
      return { version, textWithoutVersion };
    }
  }

  return { version: null, textWithoutVersion: text };
}

async function tokenizeText(text: string): Promise<string[]> {
  const normalized = await normalizedText(text);
  return normalized.split(" ").filter((token) => token.length > 0);
}

async function versionCandidatesExtractor(tokens: string[]): Promise<string[]> {
  if (tokens.length === 0) {
    return [];
  }

  const versionPatterns = [
    /^\d+(\.\d+){1,3}([a-zA-Z0-9]+)?$/,
    /^\d+\.\d+(\.\d+)?[a-z]\d*$/i,
    /^\d+\.\d+(\.\d+)?$/,
    /^v?\d+(\.\d+)+$/i,
    /^\d+\.\d+[-_]\d+$/,
    /^\d+\.\d+$/,
    /^\d{4}$/,
    /^\d+$/,
    /^\d+[a-z]$/i,
  ];

  const candidates: string[] = [];

  for (const token of tokens) {
    for (const pattern of versionPatterns) {
      if (pattern.test(token)) {
        candidates.push(token);
        break;
      }
    }
  }

  return candidates;
}

async function vendorExtractor(tokens: string[]): Promise<string | null> {
  if (tokens.length === 0) {
    return null;
  }

  for (const token of tokens) {
    const cleaned = token.replace(/(inc|corp|ltd|llc|gmbh|co)$/i, "").trim();
    if (KNOWN_VENDORS.has(cleaned)) {
      return cleaned;
    }
  }

  for (const token of tokens) {
    const cleaned = token.replace(/(inc|corp|ltd|llc|gmbh|co)$/i, "").trim();
    if (cleaned.length > 1 && !NON_VENDOR_WORDS.has(cleaned)) {
      return cleaned;
    }
  }

  return tokens[0].replace(/(inc|corp|ltd|llc|gmbh|co)$/i, "").trim();
}

async function productExtractor(
  tokens: string[],
  vendor: string | null
): Promise<string | null> {
  if (tokens.length === 0) {
    return null;
  }

  let productTokens = vendor
    ? tokens.filter((token) => token !== vendor)
    : tokens;

  if (productTokens.length === 0) {
    return vendor;
  }

  if (productTokens[0] && KNOWN_VENDORS.has(productTokens[0])) {
    return productTokens[0];
  }

  for (const token of productTokens) {
    if (!NON_VENDOR_WORDS.has(token) && token.length > 1) {
      return token;
    }
  }

  const meaningfulTokens = productTokens.filter(
    (t) => !NON_VENDOR_WORDS.has(t) || productTokens.length <= 2
  );
  return meaningfulTokens.slice(0, 2).join(" ") || productTokens[0];
}

export async function parseAsset(rawAssetName: string): Promise<ParsedAsset> {
  const { version, textWithoutVersion } = extractVersionFromRaw(rawAssetName);

  const normalized = await normalizedText(textWithoutVersion, {
    preserveVersions: false,
  });
  const tokens = normalized.split(" ").filter((token) => token.length > 0);

  const vendor = await vendorExtractor(tokens);
  const product = await productExtractor(tokens, vendor);
  const versionCandidates = version
    ? [version]
    : await versionCandidatesExtractor(tokens);

  return {
    raw: rawAssetName,
    normalized: await normalizedText(rawAssetName, { preserveVersions: true }),
    tokens,
    vendor,
    product,
    version,
    versionCandidates,
  };
}

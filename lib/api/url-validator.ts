/**
 * SSRF protection: validates that a user-supplied URL is safe to fetch.
 * Blocks private/internal network ranges, loopback, metadata endpoints,
 * and dangerous schemes.
 */

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
}

// IPv4 CIDR membership helpers (no external deps)
function parseIPv4(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    const byte = parseInt(part, 10);
    if (isNaN(byte) || byte < 0 || byte > 255 || String(byte) !== part) return null;
    n = (n << 8) | byte;
  }
  return n >>> 0;
}

function ipv4InRange(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/');
  const mask = bits ? (~0 << (32 - parseInt(bits, 10))) >>> 0 : 0xffffffff;
  const rangeNum = parseIPv4(range);
  const ipNum = parseIPv4(ip);
  if (rangeNum === null || ipNum === null) return false;
  return (ipNum & mask) === (rangeNum & mask);
}

const BLOCKED_IPV4_RANGES = [
  '127.0.0.0/8',    // loopback
  '10.0.0.0/8',     // RFC-1918 private
  '172.16.0.0/12',  // RFC-1918 private
  '192.168.0.0/16', // RFC-1918 private
  '169.254.0.0/16', // link-local / AWS metadata
  '0.0.0.0/8',      // "this" network
  '100.64.0.0/10',  // shared address (carrier-grade NAT)
  '192.0.0.0/24',   // IETF protocol assignments
  '198.18.0.0/15',  // benchmarking
  '198.51.100.0/24',// documentation (TEST-NET-2)
  '203.0.113.0/24', // documentation (TEST-NET-3)
  '224.0.0.0/4',    // multicast
  '240.0.0.0/4',    // reserved
];

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'ip6-localhost',
  'ip6-loopback',
  'broadcasthost',
]);

// Simple check for known IPv6 loopback/link-local
const BLOCKED_IPV6_PREFIXES = [
  '::1',
  '::ffff:',
  'fc00:',
  'fd',
  'fe80:',
  'ff',
];

function isBlockedIPv6(host: string): boolean {
  const lower = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (lower === '::1') return true;
  for (const prefix of BLOCKED_IPV6_PREFIXES) {
    if (lower.startsWith(prefix)) return true;
  }
  return false;
}

function isBlockedIPv4(host: string): boolean {
  for (const range of BLOCKED_IPV4_RANGES) {
    if (ipv4InRange(host, range)) return true;
  }
  return false;
}

/**
 * Validates an external URL for SSRF safety.
 *
 * @param url - The URL string to validate.
 * @returns { valid: true } if safe, { valid: false, error: string } otherwise.
 */
export function validateExternalUrl(url: string): UrlValidationResult {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required and must be a string.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: 'Invalid URL format.' };
  }

  // Only allow http and https schemes
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      error: `Scheme "${parsed.protocol.replace(':', '')}" is not allowed. Only http and https are permitted.`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block dangerous hostnames
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { valid: false, error: `Requests to "${hostname}" are not permitted.` };
  }

  // Block IPv6 loopback / link-local / private
  if (hostname.includes(':') || hostname.startsWith('[')) {
    if (isBlockedIPv6(hostname)) {
      return { valid: false, error: 'Requests to this IPv6 address range are not permitted.' };
    }
  }

  // Block private / metadata IPv4 ranges
  // Only run if it looks like an IPv4 literal (digits and dots)
  if (/^[\d.]+$/.test(hostname)) {
    if (isBlockedIPv4(hostname)) {
      return { valid: false, error: 'Requests to private or reserved IP address ranges are not permitted.' };
    }
  }

  // Block hostnames that resolve to internal names via DNS rebinding patterns
  // (heuristic: internal-looking TLDs / .local / .internal)
  if (
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname.endsWith('.corp') ||
    hostname.endsWith('.home')
  ) {
    return { valid: false, error: 'Requests to internal network hostnames are not permitted.' };
  }

  return { valid: true };
}

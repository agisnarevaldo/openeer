export const API_KEY_PREFIX = "op_live_";
export const DEFAULT_RATE_LIMIT_RPM = 60;

const SECRET_BYTE_LENGTH = 32;

export interface GeneratedApiKey {
  key: string;
  hash: string;
  prefix: string;
  lastFour: string;
}

export function generateApiKey(): GeneratedApiKey {
  const secret = Buffer.from(
    crypto.getRandomValues(new Uint8Array(SECRET_BYTE_LENGTH))
  ).toString("base64url");
  const key = `${API_KEY_PREFIX}${secret}`;

  return {
    key,
    hash: hashApiKey(key),
    prefix: API_KEY_PREFIX,
    lastFour: key.slice(-4),
  };
}

export function hashApiKey(key: string): string {
  return new Bun.CryptoHasher("sha256").update(key).digest("hex");
}

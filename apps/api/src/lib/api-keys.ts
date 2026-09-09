import { API_KEY_PREFIX, hashApiKey } from "@openeer/db";

export { API_KEY_PREFIX, hashApiKey };
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

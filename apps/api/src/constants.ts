export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "beacon_session";

/** Session lifetime (seconds). Default 14 days. */
export const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS ?? `${14 * 24 * 60 * 60}`);

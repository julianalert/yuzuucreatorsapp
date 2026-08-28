export const HANDLE_COOKIE = "yz_handle";
const HANDLE_RE = /^[a-zA-Z0-9._]{1,30}$/;

/** Strip @ and anything Instagram wouldn't accept. */
export function cleanHandle(raw: string): string {
  return raw.replace(/^@/, "").replace(/[^a-zA-Z0-9._]/g, "").toLowerCase().slice(0, 30);
}

export function isValidHandle(handle: string): boolean {
  return HANDLE_RE.test(handle);
}

import { cookies } from "next/headers";
import { HANDLE_COOKIE, cleanHandle, isValidHandle } from "./pending-handle";

export async function readPendingHandle(): Promise<string> {
  const store = await cookies();
  const cleaned = cleanHandle(decodeURIComponent(store.get(HANDLE_COOKIE)?.value ?? ""));
  return isValidHandle(cleaned) ? cleaned : "";
}

export async function clearPendingHandle(): Promise<void> {
  const store = await cookies();
  store.delete(HANDLE_COOKIE);
}

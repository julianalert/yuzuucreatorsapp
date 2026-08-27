import "server-only";
import { notFound } from "next/navigation";
import { requireCreator } from "./auth";

/** Env-allowlisted admin gate. ADMIN_EMAILS is comma-separated. */
export async function requireAdmin() {
  const creator = await requireCreator();
  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.includes(creator.email.toLowerCase())) notFound();
  return creator;
}

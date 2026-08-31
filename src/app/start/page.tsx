import { redirect } from "next/navigation";
import { latestGuestBuild, readGuestToken, routeForGuestBuild } from "@/lib/guest";

/** /start on its own just resumes wherever the guest build is. */
export default async function StartPage() {
  const token = await readGuestToken();
  const build = token ? await latestGuestBuild(token) : null;
  redirect(build ? routeForGuestBuild(build) : "/");
}

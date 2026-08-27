import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { functions } from "@/lib/inngest/functions";

// each Inngest step executes inside one request to this route; model calls can
// run for minutes, so take the longest duration the platform allows instead of
// the 300s default that was killing long generations mid-step
export const maxDuration = 800;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});

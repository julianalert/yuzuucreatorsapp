import { Inngest } from "inngest";

export interface Events {
  "build/requested": {
    buildId: string;
    creatorId: string;
    handle: string;
    selfDescription?: string;
    /** Set when this build is a rebuild after a sample rejection. */
    rebuildOfBuildId?: string;
  };
  "build/topic.chosen": { buildId: string; topicIndex: number };
  /** Creator walked away at the idea-picking step; the build row is deleted. */
  "build/discarded": { buildId: string };
  "build/samples.reviewed": { buildId: string; approved: boolean; reason?: string };
  "order/paid": { orderId: string };
}

export const inngest = new Inngest({ id: "yuzuu" });

/** Typed wrapper over inngest.send. */
export function sendEvent<K extends keyof Events>(name: K, data: Events[K]) {
  return inngest.send({ name, data });
}

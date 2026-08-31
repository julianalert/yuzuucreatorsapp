/* One-off: push the smoke-test guest build to awaiting_topic with mock ideas */
const { Client } = require("pg");
const BUILD_ID = "11606fe1-6893-4c1e-937c-f0b84ccd4554";

const proposals = {
  proposals: [
    {
      topic_title: "The 30-Day Calm Walks Reset",
      promise: "From pulling chaos to loose-leash walks in a month",
      why_this_works: "Your comments are full of owners dreading the daily walk.",
      segmentation_preview: ["puppy pullers", "reactive rescues", "adolescent regression"],
      scores: { acuteness: 8, segmentability: 9, credibility: 8 },
      duration_days: 30,
    },
    {
      topic_title: "Reactive Dog First-Aid Plan",
      promise: "Know exactly what to do when another dog appears",
      why_this_works: "Lunging questions dominate your most-discussed posts.",
      segmentation_preview: ["on-leash reactive", "fear freezers"],
      scores: { acuteness: 9, segmentability: 7, credibility: 8 },
      duration_days: 21,
    },
    {
      topic_title: "Ten-Minute Training Days",
      promise: "A busy-owner plan that fits real schedules",
      why_this_works: "Owners keep asking if 10 minutes a day is enough.",
      segmentation_preview: ["busy professionals", "new owners"],
      scores: { acuteness: 7, segmentability: 8, credibility: 9 },
      duration_days: 30,
      bonus: true,
    },
  ],
};

const audience = {
  evidence: {
    pulling: [
      "My 14 month old pulls so hard the first five minutes I dread walks now",
      "We walk an hour a day and he still pulls the whole time, I'm exhausted",
    ],
  },
  audience_words: ["pulling", "reactive", "exhausted"],
};

(async () => {
  const c = new Client({ connectionString: process.env.URI });
  await c.connect();
  await c.query(
    `update public.builds
       set status = 'awaiting_topic', stage = 'propose',
           topic_proposals = $1, audience_card = $2
     where id = $3 and creator_id is null`,
    [JSON.stringify(proposals), JSON.stringify(audience), BUILD_ID]
  );
  console.log("build pushed to awaiting_topic");
  await c.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

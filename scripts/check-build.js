/* One-off: inspect the smoke-test guest build */
const { Client } = require("pg");
(async () => {
  const c = new Client({ connectionString: process.env.URI });
  await c.connect();
  const { rows } = await c.query(
    `select id, creator_id, guest_token, handle, pending_topic_index, status, stage, halted_at,
            topic_proposals is not null as has_proposals
     from public.builds order by created_at desc limit 5`
  );
  console.log(JSON.stringify(rows, null, 2));
  await c.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

-- Per-user generation: no archetypes, no segments, no PDFs.
-- Pre-launch, no back-compat: existing blueprints/samples/outputs are in the
-- old shape and must be regenerated (rebuild products; old rows are inert).

-- orders: buyers are no longer resolved into archetype buckets
alter table public.orders drop column if exists resolved_archetype;
alter table public.orders drop column if exists resolved_signals;

-- samples: keyed by synthetic buyer persona instead of archetype;
-- sections now holds the full generated document JSON
alter table public.samples rename column archetype to persona;
alter table public.samples rename column archetype_label to persona_label;
alter table public.samples drop column if exists pdf_path;

-- outputs: delivery is a hosted page, not a PDF
alter table public.outputs drop column if exists pdf_path;

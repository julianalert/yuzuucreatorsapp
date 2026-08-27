import type {
  GeneratedOutput,
  GeneratedSection,
  OutputTemplate,
  TemplateSection,
} from "@/lib/blueprint/types";

/**
 * Renders one buyer's generated document from the product template + the
 * structured JSON the model produced. Pure server component; styles live in
 * app/plan.css (imported by the pages that use this).
 */

function Callout({ gen }: { gen: GeneratedSection }) {
  if (!gen.callout?.body) return null;
  return (
    <div className="pd-callout">
      <span className="pd-micro">{gen.callout.label || "Your situation"}</span>
      <p>{gen.callout.body}</p>
    </div>
  );
}

function Body({ paragraphs }: { paragraphs?: string[] }) {
  if (!paragraphs?.length) return null;
  return (
    <div className="pd-body">
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

function SectionContent({ section, gen }: { section: TemplateSection; gen: GeneratedSection }) {
  switch (section.component) {
    case "cards":
      return (
        <div className="pd-cards">
          {(gen.cards ?? []).map((c, i) => (
            <div key={i} className="pd-card">
              {c.kicker ? <span className="kicker">{c.kicker}</span> : null}
              <h3>{c.title}</h3>
              <p>{c.body}</p>
              {c.tag ? <span className="tag">{c.tag}</span> : null}
            </div>
          ))}
        </div>
      );
    case "timeline":
      return (
        <div className="pd-timeline">
          {(gen.timeline ?? []).map((t, i) => (
            <div key={i} className="pd-step">
              <span className="marker">{t.marker || i + 1}</span>
              <span className="range">{t.range}</span>
              <h3>{t.title}</h3>
              <p>{t.body}</p>
            </div>
          ))}
        </div>
      );
    case "table":
      return (
        <div className="pd-table-wrap">
          <table className="pd-table">
            <thead>
              <tr>
                {(section.table_columns ?? []).map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(gen.table?.rows ?? []).map((r, i) => (
                <tr key={i}>
                  {r.cells.map((cell, j) => (
                    <td key={j}>
                      {cell}
                      {r.badge && j === r.cells.length - 1 ? (
                        <span className={`pd-badge pd-badge-${r.badge}`}>{r.badge}</span>
                      ) : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "rhythm":
      return (
        <div className="pd-rhythm">
          {(gen.rhythm ?? []).map((r, i) => (
            <div key={i} className="pd-slot">
              <span className="time">{r.time}</span>
              <div>
                <h4>{r.title}</h4>
                <p>{r.desc}</p>
              </div>
            </div>
          ))}
        </div>
      );
    case "checklist":
      return (
        <div className="pd-checklist">
          {(gen.checklist ?? []).map((g, i) => (
            <div key={i} className="pd-check-group">
              <div className="g">{g.label}</div>
              <ul>
                {g.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
    case "brief":
      return gen.brief ? (
        <div className="pd-brief">
          <h3>{gen.brief.title}</h3>
          {gen.brief.groups.map((g, i) => (
            <div key={i} className="pd-brief-group">
              <div className="g">{g.label}</div>
              <ul>
                {g.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null;
    case "prose":
      return null; // carried entirely by intro paragraphs
  }
}

export function PlanDocument({
  template,
  output,
  creatorName,
  disclaimers = [],
}: {
  template: OutputTemplate;
  output: GeneratedOutput;
  creatorName: string;
  disclaimers?: string[];
}) {
  const { cover } = output;
  const axes = template.fingerprint_axes ?? [];

  return (
    <article className="pd">
      <div className="pd-cover">
        <span className="pd-micro">
          {template.doc_label} · {template.cover_label}
        </span>
        <h1 className="pd-cover-title">{cover.title}</h1>
        <p className="pd-cover-sub">{cover.subtitle}</p>

        {cover.meta?.length ? (
          <div className="pd-meta">
            {cover.meta.slice(0, 4).map((m, i) => (
              <div key={i}>
                <div className="v">{m.value}</div>
                <div className="k">{m.label}</div>
              </div>
            ))}
          </div>
        ) : null}

        {axes.length && cover.fingerprint?.length === axes.length ? (
          <div className="pd-fp">
            <div className="pd-micro pd-fp-title">{template.fingerprint_title}</div>
            {axes.map((axis, i) => {
              const v = Math.max(0, Math.min(10, cover.fingerprint[i]));
              return (
                <div key={axis} className="pd-fp-row">
                  <span className="l">{axis}</span>
                  <span className="pd-fp-track">
                    <span className="pd-fp-fill" style={{ width: `${v * 10}%`, display: "block" }} />
                  </span>
                  <span className="n">{v}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {template.sections.map((section) => {
        const gen = output.sections?.[section.id];
        if (!gen) return null;
        return (
          <section key={section.id} id={section.id} className={`pd-section pd-acc-${section.accent}`}>
            <span className="pd-eyebrow">{section.eyebrow}</span>
            <h2 className="pd-h2">{section.title}</h2>
            {section.description ? <p className="pd-desc">{section.description}</p> : null}
            <Callout gen={gen} />
            <Body paragraphs={gen.intro} />
            <SectionContent section={section} gen={gen} />
            {gen.outro ? <Body paragraphs={[gen.outro]} /> : null}
          </section>
        );
      })}

      <div className="pd-foot">
        <span className="pd-micro">Written for you by {creatorName} · one of one</span>
        {disclaimers.map((d, i) => (
          <p key={i}>{d}</p>
        ))}
      </div>
    </article>
  );
}

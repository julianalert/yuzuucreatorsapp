import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * productForViewer decides who may see an unpublished product. A spec build
 * is a real creator's likeness and content sitting on our servers before they
 * have agreed to anything, so "who can load this page" is the whole safety
 * story — hence tests at this level rather than on the token compare alone.
 */

interface Row {
  [k: string]: unknown;
}

let creatorRow: Row | null = null;
let publishedRow: Row | null = null;
let draftRow: Row | null = null;

function fakeClient() {
  return {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const chain = {
        select: () => chain,
        order: () => chain,
        limit: () => chain,
        eq: (col: string, val: unknown) => {
          filters[col] = val;
          return chain;
        },
        maybeSingle: async () => {
          if (table === "creators") return { data: creatorRow };
          // the published lookup is the one that filters on published=true
          if (filters.published === true) return { data: publishedRow };
          return { data: draftRow };
        },
      };
      return chain;
    },
  };
}

vi.mock("./supabase/admin", () => ({ supabaseAdmin: () => fakeClient() }));

const { productForViewer } = await import("./public");

const OWNER = "user-1";
const TOKEN = "11111111-1111-1111-1111-111111111111";
const WRONG = "22222222-2222-2222-2222-222222222222";

function blueprint(extra: Row = {}): Row {
  return {
    id: "bp-1",
    version: 1,
    price_cents: 2700,
    preview_token: TOKEN,
    data: {},
    ...extra,
  };
}

beforeEach(() => {
  creatorRow = {
    id: "c-1",
    user_id: OWNER,
    handle: "someone",
    display_name: "Someone",
    avatar_url: null,
  };
  publishedRow = null;
  draftRow = blueprint();
});

describe("productForViewer — unpublished draft", () => {
  it("is invisible to a stranger with no token", async () => {
    const r = await productForViewer("someone", null);
    expect(r.product).toBeNull();
    expect(r.previewKind).toBeNull();
  });

  it("is invisible to a stranger with the wrong token", async () => {
    const r = await productForViewer("someone", null, WRONG);
    expect(r.product).toBeNull();
  });

  it("is invisible to a signed-in creator who is not the owner", async () => {
    const r = await productForViewer("someone", "someone-else");
    expect(r.product).toBeNull();
  });

  it("opens to the owner with no token, as owner preview", async () => {
    const r = await productForViewer("someone", OWNER);
    expect(r.product?.blueprintId).toBe("bp-1");
    expect(r.previewKind).toBe("owner");
  });

  it("opens to a stranger holding the right token, as token preview", async () => {
    const r = await productForViewer("someone", null, TOKEN);
    expect(r.product?.blueprintId).toBe("bp-1");
    expect(r.isPreview).toBe(true);
    expect(r.previewKind).toBe("token");
  });

  it("rejects a token that is a prefix of the real one", async () => {
    const r = await productForViewer("someone", null, TOKEN.slice(0, 8));
    expect(r.product).toBeNull();
  });

  it("rejects the previous draft's token once a rebuild rotates it", async () => {
    draftRow = blueprint({ id: "bp-2", preview_token: WRONG });
    const r = await productForViewer("someone", null, TOKEN);
    expect(r.product).toBeNull();
  });

  it("stays hidden when there is no draft at all", async () => {
    draftRow = null;
    const r = await productForViewer("someone", null, TOKEN);
    expect(r.product).toBeNull();
  });

  it("stays hidden for an unknown handle", async () => {
    creatorRow = null;
    const r = await productForViewer("nobody", null, TOKEN);
    expect(r.product).toBeNull();
  });
});

describe("productForViewer — published product", () => {
  beforeEach(() => {
    publishedRow = blueprint({ id: "bp-live" });
  });

  it("shows the live page to everyone, not as a preview", async () => {
    const r = await productForViewer("someone", null);
    expect(r.product?.blueprintId).toBe("bp-live");
    expect(r.isPreview).toBe(false);
    expect(r.previewKind).toBeNull();
  });

  it("marks the owner's own visit as preview so it is not counted", async () => {
    const r = await productForViewer("someone", OWNER);
    expect(r.previewKind).toBe("owner");
  });

  it("does not let a token turn a live page into a preview", async () => {
    const r = await productForViewer("someone", null, TOKEN);
    expect(r.previewKind).toBeNull();
    expect(r.isPreview).toBe(false);
  });
});

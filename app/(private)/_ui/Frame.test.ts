// workspaceWords(slug) (issue 438): the workspace's saved language is read only for a viewer with no valid
// language cookie and a valid slug, and then used.
import { beforeEach, describe, expect, it, vi } from "vitest";

const held = vi.hoisted(() => ({ cookie: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (held.cookie ? { value: held.cookie } : undefined) }),
  headers: async () => new Headers({ "accept-language": "pt-BR" }),
}));
const read = vi.hoisted(() => vi.fn(async (_slug: string) => "fr" as string | null));
vi.mock("./desk-default-language", () => ({ deskDefaultLanguage: read }));

const { workspaceWords } = await import("./Frame");

beforeEach(() => {
  held.cookie = undefined;
  read.mockClear();
});

describe("workspaceWords", () => {
  it("reads the workspace's language and uses it when there is no cookie", async () => {
    expect((await workspaceWords("nse")).language).toBe("fr");
    expect(read).toHaveBeenCalledWith("nse");
  });

  it("reads nothing when the cookie is a desk language", async () => {
    held.cookie = "en";
    expect((await workspaceWords("nse")).language).toBe("en");
    expect(read).not.toHaveBeenCalled();
  });

  it("falls to the workspace's language when the cookie is stale", async () => {
    held.cookie = "es";
    expect((await workspaceWords("nse")).language).toBe("fr");
  });

  it("reads nothing for a slug that is not one", async () => {
    expect((await workspaceWords("../x")).language).toBe("pt-BR");
    expect(read).not.toHaveBeenCalled();
  });
});

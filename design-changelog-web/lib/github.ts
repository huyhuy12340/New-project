import { emptyIndex, normalizeIndex } from "./diff-parser";
import { readLocalIndex } from "./data-store";
import type { ChangelogIndex } from "./types";

const INDEX_PATH = "data/index.json";

function getDataRepoConfig() {
  return {
    repo: process.env.GITHUB_DATA_REPO,
    branch: process.env.GITHUB_DATA_BRANCH ?? "main",
    token: process.env.GITHUB_TOKEN,
  };
}

function buildHeaders(token?: string) {
  const headers = new Headers({
    Accept: "application/vnd.github.raw+json",
  });

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return headers;
}

export async function loadIndex(): Promise<ChangelogIndex> {
  const localIndex = await readLocalIndex();
  if (localIndex) {
    return localIndex;
  }

  const { repo, branch, token } = getDataRepoConfig();

  if (!repo) {
    return emptyIndex();
  }

  const response = await fetch(
    `https://api.github.com/repos/${repo}/contents/${INDEX_PATH}?ref=${branch}`,
    {
      headers: buildHeaders(token),
      next: {
        revalidate: 60,
      },
    },
  );

  if (!response.ok) {
    return emptyIndex();
  }

  const payload = (await response.json()) as
    | {
        content?: string;
        encoding?: string;
      }
    | Partial<ChangelogIndex>;

  if ("content" in payload && typeof payload.content === "string") {
    const decoded = Buffer.from(
      payload.content,
      payload.encoding === "base64" ? "base64" : "utf8",
    ).toString("utf8");

    return normalizeIndex(JSON.parse(decoded) as Partial<ChangelogIndex>);
  }

  return normalizeIndex(payload as Partial<ChangelogIndex>);
}

export async function loadSectionEntry(sectionId: string, date: string) {
  const index = await loadIndex();
  return (
    index.entries.find(
      (entry) => entry.sectionId === sectionId && entry.date === date,
    ) ?? null
  );
}

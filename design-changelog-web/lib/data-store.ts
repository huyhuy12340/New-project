import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";

import { normalizeIndex } from "@/lib/diff-parser";
import type { ChangelogEntry, ChangelogIndex, PageCatalog } from "@/lib/types";

function getLocalRepoRoot() {
  const root = process.env.DATA_REPO_PATH;
  if (!root) {
    throw new Error("DATA_REPO_PATH is not set.");
  }

  return path.resolve(root);
}

export function getLocalIndexPath() {
  return path.join(getLocalRepoRoot(), "data", "index.json");
}

export function getLocalPagesPath() {
  return path.join(getLocalRepoRoot(), "data", "pages.json");
}

export function getEntryPath(entryId: string) {
  return path.join(getLocalRepoRoot(), "data", "entries", `${entryId}.json`);
}

export function getBaselinePath(sourceId: string) {
  return path.join(getLocalRepoRoot(), "data", "baselines", `${sourceId}.json`);
}

async function ensureParent(filePath: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

export async function readLocalIndex(): Promise<ChangelogIndex | null> {
  try {
    const raw = await readFile(getLocalIndexPath(), "utf8");
    return normalizeIndex(JSON.parse(raw) as Partial<ChangelogIndex>);
  } catch {
    return null;
  }
}

export async function readLocalPages(): Promise<PageCatalog | null> {
  try {
    const raw = await readFile(getLocalPagesPath(), "utf8");
    return JSON.parse(raw) as PageCatalog;
  } catch {
    return null;
  }
}

export async function writeLocalIndex(index: ChangelogIndex) {
  const filePath = getLocalIndexPath();
  await ensureParent(filePath);
  await writeFile(filePath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
}

export async function writeLocalPages(pages: PageCatalog) {
  const filePath = getLocalPagesPath();
  await ensureParent(filePath);
  await writeFile(filePath, `${JSON.stringify(pages, null, 2)}\n`, "utf8");
}

export async function writeEntryFile(entry: ChangelogEntry) {
  const filePath = getEntryPath(entry.id);
  await ensureParent(filePath);
  await writeFile(filePath, `${JSON.stringify(entry, null, 2)}\n`, "utf8");
}

export async function readBaseline(sourceId: string): Promise<unknown | null> {
  try {
    const raw = await readFile(getBaselinePath(sourceId), "utf8");
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export async function writeBaseline(sourceId: string, baseline: unknown) {
  const filePath = getBaselinePath(sourceId);
  await ensureParent(filePath);
  await writeFile(filePath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
}

export async function clearBaselines() {
  const folder = path.join(getLocalRepoRoot(), "data", "baselines");
  await rm(folder, { force: true, recursive: true });
  await mkdir(folder, { recursive: true });
}

export async function clearEntryFiles() {
  const folder = path.join(getLocalRepoRoot(), "data", "entries");
  await rm(folder, { force: true, recursive: true });
  await mkdir(folder, { recursive: true });
}

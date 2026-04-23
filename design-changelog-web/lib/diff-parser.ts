import type {
  ChangelogEntry,
  ChangelogIndex,
  EntrySummary,
  FrameChange,
} from "./types";

export function emptySummary(): EntrySummary {
  return {
    edited: 0,
    added: 0,
    removed: 0,
  };
}

export function emptyIndex(): ChangelogIndex {
  return {
    lastUpdated: "",
    figmaFileKey: "",
    figmaFileName: "",
    sources: [],
    entries: [],
  };
}

export function normalizeIndex(
  value: Partial<ChangelogIndex> | null | undefined,
): ChangelogIndex {
  return {
    lastUpdated: value?.lastUpdated ?? "",
    figmaFileKey: value?.figmaFileKey ?? "",
    figmaFileName: value?.figmaFileName ?? "",
    sources: Array.isArray(value?.sources) ? value.sources : [],
    entries: Array.isArray(value?.entries) ? value.entries : [],
  };
}

export function getSectionHistory(
  index: ChangelogIndex,
  sectionId: string,
): ChangelogEntry[] {
  return index.entries
    .filter((entry) => entry.sectionId === sectionId)
    .sort((left, right) => right.date.localeCompare(left.date));
}

export function groupEntriesBySection(
  index: ChangelogIndex,
  selectedDate?: string,
): ChangelogEntry[] {
  const filteredEntries = selectedDate
    ? index.entries.filter((entry) => entry.date === selectedDate)
    : index.entries;

  return [...filteredEntries].sort((left, right) =>
    left.sectionName.localeCompare(right.sectionName),
  );
}

export function findEntry(
  index: ChangelogIndex,
  sectionId: string,
  date: string,
): ChangelogEntry | undefined {
  return index.entries.find(
    (entry) => entry.sectionId === sectionId && entry.date === date,
  );
}

export type SectionGroup = {
  sectionId: string
  sectionName: string
  frames: FrameChange[]
  hasChanges: boolean
}

/** Groups frames by their sectionId, ordered by sections that have changes first. */
export function getFramesBySection(frames: FrameChange[]): SectionGroup[] {
  const map = new Map<string, SectionGroup>()
  for (const frame of frames) {
    const key = frame.sectionId ?? "unknown"
    const existing = map.get(key) ?? {
      sectionId: key,
      sectionName: frame.sectionName ?? "Unknown Section",
      frames: [],
      hasChanges: false,
    }
    existing.frames.push(frame)
    if (frame.status === "added" || frame.status === "edited" || frame.status === "removed") {
      existing.hasChanges = true
    }
    map.set(key, existing)
  }
  return [...map.values()].sort((a, b) => Number(b.hasChanges) - Number(a.hasChanges))
}



export type ChangeStatus = "added" | "edited" | "removed" | "pending";

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayerChange {
  id: string;
  name: string;
  type: string;
  status: ChangeStatus;
  path: string;
  boundingBox: BoundingBox;
  changes: Array<{
    prop: string;
    before: string | number | null;
    after: string | number | null;
  }>;
}

export interface FrameChange {
  id: string;
  name: string;
  sectionId?: string;
  sectionName?: string;
  thumbnail?: string | null;
  status: ChangeStatus;
  figmaDeepLink: string;
  boundingBox: BoundingBox;
  layers: LayerChange[];
}

export interface EntrySummary {
  edited: number;
  added: number;
  removed: number;
}

export interface ChangelogEntry {
  id: string;
  sourceId?: string;
  versionId?: string;
  sectionId: string;
  sectionName: string;
  date: string;
  lastDetectedAt: string;
  summary: EntrySummary;
  diffFile: string;
  beforeImage: string;
  afterImage: string;
  sectionThumbnail?: string | null;
  figmaDeepLink: string;
  frames: FrameChange[];
}

export interface ChangelogIndex {
  lastUpdated: string;
  figmaFileKey: string;
  figmaFileName: string;
  sources: Array<{
    id: string;
    url: string;
    fileKey: string;
    fileName: string;
    nodeId: string | null;
    nodeName: string | null;
    archived?: boolean;
    sectionId: string;
    sectionName: string;
    lastVersionId: string | null;
    lastVersionAt: string | null;
  }>;
  entries: ChangelogEntry[];
}

export type PageCategory = "coach-app" | "client-app" | "web" | string;

export interface TrackedPage {
  id: string;
  folderSlug: string;
  folderName: string;
  pageName: string;
  figmaFileKey: string;
  figmaFileName: string;
  figmaPageId: string | null;
  figmaPageName: string | null;
  figmaUrl: string;
  categories: PageCategory[];
  addedAt: string;
  addedBy: string;
  archived?: boolean;
}

export interface PageCatalog {
  pages: TrackedPage[];
}

export interface FolderSummary {
  folderSlug: string;
  folderName: string;
  pageCount: number;
  latestDate: string;
}

export interface ResolvedFigmaPage {
  figmaFileKey: string;
  figmaFileName: string;
  figmaPageId: string;
  figmaPageName: string;
  figmaUrl: string;
  folderSlug: string;
  folderName: string;
  pageName: string;
}

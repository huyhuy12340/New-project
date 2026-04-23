type FigmaFileResponse = {
  name: string;
  version: string;
  thumbnailUrl?: string;
  document: FigmaNode;
};

type FigmaVersionsResponse = {
  versions?: Array<{
    id: string;
    created_at: string;
    label?: string;
    description?: string;
  }>;
};

type FigmaNodesResponse = {
  nodes?: Record<
    string,
    {
      document?: FigmaNode;
    }
  >;
};

export type FigmaNode = {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  characters?: string;
  children?: FigmaNode[];
  absoluteBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  fills?: unknown[];
  strokes?: unknown[];
  effects?: unknown[];
  opacity?: number;
};

export type FigmaImageResponse = {
  images?: Record<string, string | null>;
};

function getToken() {
  const token = process.env.FIGMA_TOKEN;
  if (!token) {
    throw new Error("FIGMA_TOKEN is not set.");
  }
  return token;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function figmaFetch<T>(path: string, attempt = 0): Promise<T> {
  const timeout =
    typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(25000)
      : undefined
  const response = await fetch(`https://api.figma.com/v1${path}`, {
    headers: {
      "X-Figma-Token": getToken(),
      Accept: "application/json",
    },
    signal: timeout,
    cache: "no-store",
  })

  if (response.ok) {
    return (await response.json()) as T
  }

  const body = await response.text()
  if ((response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504) && attempt < 3) {
    const delay = 750 * 2 ** attempt
    await sleep(delay)
    return figmaFetch<T>(path, attempt + 1)
  }

  throw new Error(`Figma API request failed for ${path}: ${response.status} ${body}`)
}

export async function getFigmaFile(fileKey: string) {
  return figmaFetch<FigmaFileResponse>(`/files/${fileKey}`);
}

export async function getFigmaVersions(fileKey: string) {
  return figmaFetch<FigmaVersionsResponse>(`/files/${fileKey}/versions`);
}

export async function getFigmaImageUrls(fileKey: string, ids: string[]) {
  if (ids.length === 0) {
    return {};
  }

  const response = await figmaFetch<FigmaImageResponse>(
    `/images/${fileKey}?ids=${encodeURIComponent(ids.join(","))}`,
  );

  return response.images ?? {};
}

export async function getFigmaNodes(fileKey: string, ids: string[]) {
  if (ids.length === 0) {
    return {};
  }

  const response = await figmaFetch<FigmaNodesResponse>(
    `/files/${fileKey}/nodes?ids=${encodeURIComponent(ids.join(","))}`,
  );

  return response.nodes ?? {};
}

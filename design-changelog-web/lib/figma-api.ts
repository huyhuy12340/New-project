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

export async function getFigmaFile(fileKey: string, options: { depth?: number } = {}) {
  const params = options.depth ? `?depth=${options.depth}` : "";
  return figmaFetch<FigmaFileResponse>(`/files/${fileKey}${params}`);
}

export async function getFigmaVersions(fileKey: string) {
  return figmaFetch<FigmaVersionsResponse>(`/files/${fileKey}/versions`);
}

/**
 * Fetches image URLs for a list of node IDs, with automatic batching (100 ids per request)
 */
export async function getFigmaImageUrls(
  fileKey: string,
  ids: string[],
  options: { scale?: number; format?: "jpg" | "png" | "svg" | "pdf" } = {},
) {
  if (ids.length === 0) {
    return {};
  }

  const batchSize = 20;
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    batches.push(ids.slice(i, i + batchSize));
  }

  const allImages: Record<string, string | null> = {};

  for (const batchIds of batches) {
    try {
      const params = new URLSearchParams({
        ids: batchIds.join(","),
        scale: String(options.scale ?? 1),
        format: options.format ?? "png",
      });

      console.log(`[batch] requesting ${batchIds.length} ids, first: ${batchIds[0]}`);
      
      const response = await figmaFetch<FigmaImageResponse>(
        `/images/${fileKey}?${params.toString()}`,
      );
      
      if (response.images) {
        Object.assign(allImages, response.images);
      }
    } catch (error) {
      console.error(`[batch] failed:`, error);
    }
  }

  console.log(`[getFigmaImageUrls] Total batches: ${batches.length}, Total results: ${Object.keys(allImages).length}, Null count: ${Object.values(allImages).filter(v => v === null).length}`)

  return allImages;
}

/**
 * Fetches full node data for a list of IDs, with sequential batching
 */
export async function getFigmaNodes(fileKey: string, ids: string[]) {
  if (ids.length === 0) {
    return {};
  }

  const batchSize = 20;
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    batches.push(ids.slice(i, i + batchSize));
  }

  const allNodes: Record<string, { document?: FigmaNode }> = {};

  for (const batchIds of batches) {
    try {
      const response = await figmaFetch<FigmaNodesResponse>(
        `/files/${fileKey}/nodes?ids=${encodeURIComponent(batchIds.join(","))}`,
      );
      if (response.nodes) {
        Object.assign(allNodes, response.nodes);
      }
    } catch (error) {
      console.error(`Batch ${batches.indexOf(batchIds)} (Nodes) failed:`, error);
    }
  }

  return allNodes;
}

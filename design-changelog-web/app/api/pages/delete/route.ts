import { NextResponse } from "next/server";
import { readLocalIndex, writeLocalIndex } from "@/lib/data-store";
import { removeTrackedPage } from "@/lib/catalog";

export async function POST(request: Request) {
  try {
    const { pageId } = await request.json();

    if (!pageId) {
      return NextResponse.json({ error: "Missing pageId" }, { status: 400 });
    }

    // 1. Update index.json
    const index = await readLocalIndex();
    if (index) {
      index.sources = index.sources.filter((s) => s.id !== pageId);
      index.entries = index.entries.filter((e) => e.sourceId !== pageId);
      await writeLocalIndex(index);
    }

    // 2. Update pages.json (catalog)
    await removeTrackedPage(pageId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Delete API]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

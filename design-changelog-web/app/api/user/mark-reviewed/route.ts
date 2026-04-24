import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { readUserState, writeUserState, UserState } from "@/lib/data-store"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { pageId, versionId } = await req.json()
    const userId = session.user.email

    let state = await readUserState(userId)
    if (!state) {
      state = { userId, pageStates: {} }
    }

    state.pageStates[pageId] = {
      ...state.pageStates[pageId],
      lastSeenVersionId: versionId,
      currentVersionId: versionId,
    }

    await writeUserState(userId, state)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to update state" }, { status: 500 })
  }
}

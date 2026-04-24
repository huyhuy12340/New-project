import { NextResponse } from "next/server"
import { createUser, findUserByEmail } from "@/lib/user-store"

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Missing email or password" }, { status: 400 })
    }

    const existing = await findUserByEmail(email)
    if (existing) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 })
    }

    const user = await createUser(email, password, name)
    
    return NextResponse.json({ 
      message: "User created successfully",
      user: { id: user.id, email: user.email } 
    })
  } catch (error: any) {
    console.error("Signup error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

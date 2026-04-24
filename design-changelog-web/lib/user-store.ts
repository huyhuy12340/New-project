import { readFile, writeFile, mkdir } from "fs/promises"
import path from "path"
import bcrypt from "bcryptjs"

const DATA_DIR = process.env.DATA_REPO_PATH || "./data"
const USERS_FILE = path.resolve(DATA_DIR, "data", "users.json")

export interface User {
  id: string
  email: string
  passwordHash: string
  name?: string
  createdAt: string
}

async function ensureUsersFile() {
  const dir = path.dirname(USERS_FILE)
  await mkdir(dir, { recursive: true })
  try {
    await readFile(USERS_FILE, "utf-8")
  } catch {
    await writeFile(USERS_FILE, JSON.stringify([]), "utf-8")
  }
}

export async function getUsers(): Promise<User[]> {
  await ensureUsersFile()
  const raw = await readFile(USERS_FILE, "utf-8")
  return JSON.parse(raw)
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const users = await getUsers()
  return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null
}

export async function createUser(email: string, passwordPlain: string, name?: string): Promise<User> {
  const existing = await findUserByEmail(email)
  if (existing) throw new Error("User already exists")

  const users = await getUsers()
  const passwordHash = await bcrypt.hash(passwordPlain, 10)
  
  const newUser: User = {
    id: `u-${Date.now()}`,
    email: email.toLowerCase(),
    passwordHash,
    name,
    createdAt: new Date().toISOString()
  }

  users.push(newUser)
  await writeFile(USERS_FILE, JSON.stringify(users, null, 2), "utf-8")
  return newUser
}

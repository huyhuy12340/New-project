import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import type { ReactNode } from "react"

import { LayoutWrapper } from "@/components/layout-wrapper"
import { Providers } from "@/components/providers"
import { loadPageCatalog } from "@/lib/catalog"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { readUserState } from "@/lib/data-store"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Design Changelog",
  description: "Page-level daily changelog for Figma updates.",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  const catalog = await loadPageCatalog()
  const session = await getServerSession(authOptions)
  const userState = session?.user?.email ? await readUserState(session.user.email) : null

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <Providers>
          <LayoutWrapper pages={catalog.pages} userState={userState}>
            {children}
          </LayoutWrapper>
        </Providers>
      </body>
    </html>
  )
}

import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import type { ReactNode } from "react"

import { AppHeader } from "@/components/app-header"
import { AppSidebar } from "@/components/app-sidebar"
import { SearchPalette } from "@/components/search-palette"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { loadPageCatalog } from "@/lib/catalog"
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

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <SidebarProvider>
          <AppSidebar pages={catalog.pages} />
          <SidebarInset>
            <div className="flex min-h-screen flex-col">
              <AppHeader pages={catalog.pages} />
              <main className="flex-1 pt-10">{children}</main>
            </div>
          </SidebarInset>
        </SidebarProvider>
        <SearchPalette pages={catalog.pages} />
      </body>
    </html>
  )
}

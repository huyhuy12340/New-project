"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { AppSidebar } from "@/components/app-sidebar"
import { SearchPalette } from "@/components/search-palette"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import type { TrackedPage } from "@/lib/types"
import type { UserState } from "@/lib/data-store"

interface LayoutWrapperProps {
  children: React.ReactNode
  pages: TrackedPage[]
  userState: UserState | null
}

export function LayoutWrapper({ children, pages, userState }: LayoutWrapperProps) {
  const pathname = usePathname()
  const isAuthPage = pathname === "/login" || pathname === "/signup"

  if (isAuthPage) {
    return <main className="min-h-screen">{children}</main>
  }

  return (
    <SidebarProvider>
      <AppSidebar pages={pages} userState={userState} />
      <SidebarInset>
        <div className="flex min-h-screen flex-col">
          <AppHeader pages={pages} />
          <main className="flex-1 pt-10">{children}</main>
        </div>
      </SidebarInset>
      <SearchPalette pages={pages} />
    </SidebarProvider>
  )
}

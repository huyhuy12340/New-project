"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronRight, Layout, Package, Search } from "lucide-react"
import { FigmaIcon } from "@/components/figma-icon"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { TrackedPage } from "@/lib/types"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  pages: TrackedPage[]
}

export function AppSidebar({ pages, ...props }: AppSidebarProps) {
  const groupedPages = React.useMemo(() => {
    const groups: Record<string, Record<string, TrackedPage[]>> = {}

    pages.forEach((page) => {
      const category = page.categories?.[0] || "Uncategorized"
      const fileName = page.figmaFileName

      if (!groups[category]) {
        groups[category] = {}
      }

      if (!groups[category][fileName]) {
        groups[category][fileName] = []
      }

      groups[category][fileName].push(page)
    })

    return groups
  }, [pages])

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Package className="size-[14px]" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">Design Changelog</span>
                  <span className="text-xs text-muted-foreground">v2.5</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {Object.entries(groupedPages).map(([category, files]) => (
          <SidebarGroup key={category}>
            <SidebarGroupLabel className="capitalize">{category}</SidebarGroupLabel>
            <SidebarMenu>
              {Object.entries(files).map(([fileName, filePages]) => (
                <Collapsible
                  key={fileName}
                  asChild
                  defaultOpen={false}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip={fileName}>
                        <FigmaIcon className="size-[14px]" />
                        <span className="truncate">{fileName}</span>
                        <ChevronRight className="ml-auto size-[14px] transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {filePages.map((page) => (
                          <SidebarMenuSubItem key={page.id}>
                            <SidebarMenuSubButton asChild>
                              <Link href={`/${page.folderSlug}/${page.id}`}>
                                <Layout className="size-[14px]" />
                                <span className="truncate">{page.pageName}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

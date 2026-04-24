"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { 
  ChevronRight, 
  Layout, 
  Package, 
  MoreHorizontal, 
  Trash2, 
  ChevronsUpDown,
  LogOut,
  BadgeCheck,
  Bell,
  Sparkles
} from "lucide-react"
import { FigmaIcon } from "@/components/figma-icon"
import type { UserState } from "@/lib/data-store"

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
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarFooter,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { TrackedPage } from "@/lib/types"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  pages: TrackedPage[]
  userState: UserState | null
}

export function AppSidebar({ pages, userState, ...props }: AppSidebarProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [selectedPage, setSelectedPage] = React.useState<TrackedPage | null>(null)
  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null)
  const [isActionLoading, setIsActionLoading] = React.useState(false)

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

  const handleDelete = async () => {
    if (!selectedPage) return

    setIsActionLoading(true)
    try {
      const res = await fetch("/api/pages/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: selectedPage.id }),
      })

      if (!res.ok) throw new Error("Failed to delete page")
      
      setDeleteDialogOpen(false)
      router.refresh()
      router.push("/")
    } catch (err) {
      alert("Error deleting page")
    } finally {
      setIsActionLoading(false)
    }
  }

  return (
    <>
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
                        <SidebarMenuButton tooltip={fileName} className="pr-2!">
                          <FigmaIcon className="size-[14px] shrink-0" />
                          <span className="flex-1 truncate">{fileName}</span>
                          <ChevronRight className="ml-auto size-[14px] shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {filePages.map((page) => {
                            const lastSeenVersionId = userState?.pageStates[page.id]?.lastSeenVersionId || null
                            const hasLocalChanges = page.lastVersionId && page.lastVersionId !== lastSeenVersionId

                            return (
                              <SidebarMenuSubItem key={page.id} className="group/item relative">
                                <SidebarMenuSubButton asChild>
                                  <Link href={`/${page.folderSlug}/${page.id}`} className="group/link relative flex w-full items-center gap-2 overflow-hidden">
                                    <Layout className="size-[14px] shrink-0" />
                                    <span className={`truncate group-hover/item:pr-6 ${openMenuId === page.id ? "pr-6" : ""}`}>
                                      {page.pageName}
                                    </span>
                                    {hasLocalChanges && (
                                      <div className="ml-auto size-1.5 shrink-0 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)]" />
                                    )}
                                  </Link>
                                </SidebarMenuSubButton>
                                <DropdownMenu onOpenChange={(open) => setOpenMenuId(open ? page.id : null)}>
                                  <DropdownMenuTrigger asChild>
                                    <SidebarMenuAction className={`opacity-0 group-hover/item:opacity-100 ${openMenuId === page.id ? "opacity-100" : ""}`}>
                                      <MoreHorizontal className="size-4" />
                                      <span className="sr-only">More</span>
                                    </SidebarMenuAction>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-40">
                                    <DropdownMenuItem 
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => {
                                        setSelectedPage(page)
                                        setDeleteDialogOpen(true)
                                      }}
                                    >
                                      <Trash2 className="mr-2 size-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </SidebarMenuSubItem>
                            )
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name || ""} />
                      <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                        {session?.user?.name?.slice(0, 2).toUpperCase() || "US"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{session?.user?.name || "User"}</span>
                      <span className="truncate text-xs text-muted-foreground">{session?.user?.email}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                  side="bottom"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name || ""} />
                        <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                          {session?.user?.name?.slice(0, 2).toUpperCase() || "US"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">{session?.user?.name || "User"}</span>
                        <span className="truncate text-xs text-muted-foreground">{session?.user?.email}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()}>
                    <LogOut className="mr-2 size-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Page</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-semibold">{selectedPage?.pageName}</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete} 
              disabled={isActionLoading}
            >
              {isActionLoading ? "Deleting..." : "Delete Page"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

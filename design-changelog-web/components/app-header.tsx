"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { AddPageDialog } from "@/components/add-page-dialog"
import type { TrackedPage } from "@/lib/types"

type AppHeaderProps = {
  pages: TrackedPage[]
}

export function AppHeader({ pages }: AppHeaderProps) {
  const pathname = usePathname()

  // Generate dynamic breadcrumbs based on pathname
  const crumbs = React.useMemo(() => {
    if (pathname === "/") return []

    const segments = pathname.split("/").filter(Boolean)
    const result: { label: string; href?: string }[] = [{ label: "Home", href: "/" }]

    let currentHref = ""
    segments.forEach((segment, index) => {
      currentHref += `/${segment}`
      const isLast = index === segments.length - 1
      
      const matchingPage = pages.find(p => p.id === segment || p.folderSlug === segment)
      
      let label = segment
      if (matchingPage) {
        if (matchingPage.folderSlug === segment && index === 0) {
          label = matchingPage.folderName
        } else if (matchingPage.id === segment) {
          label = matchingPage.pageName
        }
      }

      result.push({
        label,
        href: isLast ? undefined : currentHref
      })
    })

    return result
  }, [pathname, pages])

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-2 border-b bg-background/95 px-4 backdrop-blur transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        
        <Breadcrumb>
          <BreadcrumbList>
            {crumbs.length === 0 ? (
              <BreadcrumbItem>
                <BreadcrumbPage>Home</BreadcrumbPage>
              </BreadcrumbItem>
            ) : (
              crumbs.map((crumb, index) => (
                <React.Fragment key={index}>
                  <BreadcrumbItem>
                    {crumb.href ? (
                      <Link href={crumb.href} className="transition-colors hover:text-foreground">
                        {crumb.label}
                      </Link>
                    ) : (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                  {index < crumbs.length - 1 && <BreadcrumbSeparator />}
                </React.Fragment>
              ))
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      
      <div className="flex items-center gap-4">
        <AddPageDialog />
      </div>
    </header>
  )
}

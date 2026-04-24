"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, RotateCw, MoreHorizontal, Trash2, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { FigmaIcon } from "@/components/figma-icon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Crumb = {
  label: string;
  href?: string;
};

type PageHeaderProps = {
  crumbs?: Crumb[]; // Optional now
  title: string;
  pageId?: string; // New: for rename/delete
  description?: string;
  figmaUrl?: string;
  latestVersionId?: string;
  action?: React.ReactNode;
};

export function PageHeader({ title, pageId, description, figmaUrl, latestVersionId }: PageHeaderProps) {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [isActionLoading, setIsActionLoading] = React.useState(false);

  const handleDelete = async () => {
    if (!pageId) return;

    setIsActionLoading(true);
    try {
      const res = await fetch("/api/pages/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId }),
      });

      if (!res.ok) throw new Error("Failed to delete page");
      
      setDeleteDialogOpen(false);
      router.refresh();
      router.push("/");
    } catch (err) {
      alert("Error deleting page");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleMarkReviewed = async () => {
    if (!pageId || !latestVersionId) return;

    setIsActionLoading(true);
    try {
      const res = await fetch("/api/user/mark-reviewed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, versionId: latestVersionId }),
      });

      if (!res.ok) throw new Error("Failed to mark as reviewed");
      
      router.refresh();
      window.location.reload();
    } catch (err) {
      alert("Error marking as reviewed");
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <>
      <header className="space-y-3">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h1 className={cn("text-3xl font-semibold tracking-tight text-foreground sm:text-4xl")}>
              {title}
            </h1>
            
            {pageId && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8">
                    <MoreHorizontal className="size-4" />
                    <span className="sr-only">More options</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem 
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="mr-2 size-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {description ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm leading-6 text-muted-foreground">
                <FigmaIcon className="size-3.5 shrink-0" />
                <p className="max-w-3xl">{description}</p>
              </div>
              
              {figmaUrl && (
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="xs" 
                    className="h-7 gap-1.5 px-2.5 text-xs font-normal"
                    onClick={async (e) => {
                      const btn = e.currentTarget;
                      const originalContent = btn.innerHTML;
                      btn.disabled = true;
                      btn.innerHTML = "Syncing...";
                      try {
                        const syncUrl = pageId
                          ? `/api/cron/poll-figma?pageId=${pageId}`
                          : `/api/cron/poll-figma`
                        const res = await fetch(syncUrl);
                        const data = await res.json();
                        if (!res.ok) {
                          alert(`Sync failed: ${data.error || "Unknown error"}`);
                          btn.innerHTML = originalContent;
                          btn.disabled = false;
                          return;
                        }
                        window.location.reload();
                      } catch (err: any) {
                        alert(`Sync failed: ${err.message}`);
                        btn.innerHTML = originalContent;
                        btn.disabled = false;
                      }
                    }}
                  >
                    <RotateCw className="size-3" />
                    Sync now
                  </Button>
                  <Button variant="outline" size="xs" asChild className="h-7 gap-1.5 px-2.5 text-xs font-normal">
                    <a href={figmaUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-3" />
                      Open in Figma
                    </a>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="xs" 
                    className="h-7 gap-1.5 px-2.5 text-xs font-normal bg-emerald-500/5 text-emerald-600 border-emerald-200 hover:bg-emerald-500/10 hover:text-emerald-700 hover:border-emerald-300"
                    onClick={handleMarkReviewed}
                    disabled={isActionLoading || !latestVersionId}
                  >
                    <CheckCheck className="size-3" />
                    Mark as Reviewed
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </header>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Page</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-semibold">{title}</span>? This action cannot be undone.
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
  );
}

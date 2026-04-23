"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { FigmaIcon } from "@/components/figma-icon";
import { Button } from "@/components/ui/button";

type Crumb = {
  label: string;
  href?: string;
};

type PageHeaderProps = {
  crumbs: Crumb[];
  title: string;
  description?: string;
  figmaUrl?: string;
  action?: React.ReactNode;
};

export function PageHeader({ title, description, figmaUrl }: PageHeaderProps) {
  return (
    <header className="space-y-3">
      <div className="space-y-4">
        <h1 className={cn("text-3xl font-semibold tracking-tight text-foreground sm:text-4xl")}>
          {title}
        </h1>
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
                      const res = await fetch("/api/cron/poll-figma");
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
                    Open in Figma
                    <ExternalLink className="size-3" />
                  </a>
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </header>
  );
}

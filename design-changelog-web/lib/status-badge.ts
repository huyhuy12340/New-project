import type { ChangeStatus } from "@/lib/types"

export function statusBadgeClassName(status: ChangeStatus) {
  switch (status) {
    case "added":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
    case "edited":
      return "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50"
    case "removed":
      return "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50"
    case "pending":
      return "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-50"
    default:
      return ""
  }
}

export function statusLabel(status: ChangeStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

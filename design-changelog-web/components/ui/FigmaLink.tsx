import Link from "next/link";
import { Button } from "@/components/ui/button";

type FigmaLinkProps = {
  href: string;
  label: string;
};

export function FigmaLink({ href, label }: FigmaLinkProps) {
  return (
    <Button asChild size="sm" variant="secondary">
      <Link href={href} rel="noreferrer" target="_blank">
        {label}
      </Link>
    </Button>
  );
}

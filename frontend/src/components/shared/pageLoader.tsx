import { Loader2 } from "lucide-react";

export function PageLoader() {
  return (
    <div className="flex h-40 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export function InlineLoader({ className }: { className?: string }) {
  return <Loader2 className={className ?? "h-5 w-5 animate-spin text-muted-foreground"} />;
}

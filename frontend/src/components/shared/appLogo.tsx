import { cn } from "@/utils/cn";

export function AppLogo({ className }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="PharmaGest"
      className={cn("h-14 w-14 object-contain", className)}
    />
  );
}

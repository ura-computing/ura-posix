import { cn } from "@/utils/cn";

export function AppLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg", className)}>
      <svg viewBox="0 0 24 24" className="h-7 w-7 text-primary-foreground" fill="currentColor">
        <path d="M10.5 3.75a.75.75 0 0 0-1.5 0v.75H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5A2.25 2.25 0 0 0 6.75 19.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 17.25 4.5H15v-.75a.75.75 0 0 0-1.5 0v.75h-3V3.75ZM9 7.5A.75.75 0 0 1 9.75 6.75h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 9 7.5Zm-.75 3a.75.75 0 0 0 0 1.5h3v3a.75.75 0 0 0 1.5 0v-3h3a.75.75 0 0 0 0-1.5h-3v-3a.75.75 0 0 0-1.5 0v3h-3Z" />
      </svg>
    </div>
  );
}

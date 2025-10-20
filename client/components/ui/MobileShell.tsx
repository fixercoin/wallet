import React from "react";
import { cn } from "@/lib/utils";

interface MobileShellProps {
  children: React.ReactNode;
  className?: string;
}

export default function MobileShell({ children, className }: MobileShellProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 flex items-center justify-center bg-[linear-gradient(135deg,_#0f1520_0%,_#0b1220_50%,_#070c16_100%)] overflow-hidden",
      )}
      data-mobile-shell
    >
      <div
        className={cn(
          "relative w-screen h-screen bg-background text-foreground overflow-hidden",
          "supports-[padding:max(0px,env(safe-area-inset-top))]:pt-[max(0px,env(safe-area-inset-top))]",
          "supports-[padding:max(0px,env(safe-area-inset-bottom))]:pb-[max(0px,env(safe-area-inset-bottom))]",
          className,
        )}
      >
        <div className="absolute inset-x-0 top-0 h-[max(0px,env(safe-area-inset-top))] pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-[max(0px,env(safe-area-inset-bottom))] pointer-events-none" />
        <div className="h-full overflow-y-auto scrollbar-none will-change-transform">
          {children}
        </div>
      </div>
    </div>
  );
}

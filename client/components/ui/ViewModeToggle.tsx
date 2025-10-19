import React from "react";
import { cn } from "@/lib/utils";

type Mode = "auto" | "mobile" | "full";

export default function ViewModeToggle({
  mode,
  setMode,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
}) {
  return (
    <div className="fixed right-4 top-4 z-[60]">
      <div className="flex items-center gap-2 bg-black/40 dark:bg-white/10 rounded-full p-1 backdrop-blur-md shadow-md">
        <button
          onClick={() => setMode("auto")}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-medium",
            mode === "auto"
              ? "bg-white/90 text-black"
              : "text-white/80 hover:bg-white/5"
          )}
          aria-pressed={mode === "auto"}
          title="Auto (responsive)"
        >
          Auto
        </button>
        <button
          onClick={() => setMode("mobile")}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-medium",
            mode === "mobile"
              ? "bg-white/90 text-black"
              : "text-white/80 hover:bg-white/5"
          )}
          aria-pressed={mode === "mobile"}
          title="Mobile app style"
        >
          Mobile
        </button>
        <button
          onClick={() => setMode("full")}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-medium",
            mode === "full"
              ? "bg-white/90 text-black"
              : "text-white/80 hover:bg-white/5"
          )}
          aria-pressed={mode === "full"}
          title="Full page (desktop)"
        >
          Full
        </button>
      </div>
    </div>
  );
}

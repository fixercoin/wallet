import React from "react";

interface NetworkSignalIconProps {
  bars: number; // 0-4
  isOnline: boolean;
  latency?: number | null;
}

export const NetworkSignalIcon: React.FC<NetworkSignalIconProps> = ({
  bars,
  isOnline,
  latency,
}) => {
  // Determine color based on connection quality
  const getColors = () => {
    if (!isOnline || bars === 0) {
      return {
        glow: "rgba(239, 68, 68, 0.4)",
        outer: "#ef4444",
        mid: "#dc2626",
        inner: "#b91c1c",
      };
    }
    if (bars === 1) {
      return {
        glow: "rgba(239, 68, 68, 0.4)",
        outer: "#ef4444",
        mid: "#dc2626",
        inner: "#b91c1c",
      };
    }
    if (bars === 2) {
      return {
        glow: "rgba(234, 179, 8, 0.4)",
        outer: "#eab308",
        mid: "#ca8a04",
        inner: "#a16207",
      };
    }
    if (bars === 3) {
      return {
        glow: "rgba(34, 197, 94, 0.4)",
        outer: "#22c55e",
        mid: "#16a34a",
        inner: "#15803d",
      };
    }
    // bars === 4
    return {
      glow: "rgba(34, 197, 94, 0.6)",
      outer: "#22c55e",
      mid: "#16a34a",
      inner: "#15803d",
    };
  };

  const colors = getColors();

  const title = isOnline
    ? `Signal: ${bars}/4 (${latency}ms)`
    : "No internet connection";

  return (
    <div
      className="relative h-8 w-8 flex items-center justify-center group"
      title={title}
      aria-label={`Network signal ${bars} bars`}
    >
      <svg
        viewBox="0 0 32 32"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="glow-signal">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="signal-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={colors.glow} />
            <stop offset="100%" stopColor={colors.glow} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Glow effect background */}
        <circle
          cx="16"
          cy="16"
          r="14"
          fill="url(#signal-glow)"
          opacity={bars >= 3 ? 1 : 0.5}
        />

        {/* Outer arc - shows when bars >= 1 */}
        <path
          d="M 16 8 A 8 8 0 0 1 22.63 9.37"
          stroke={colors.outer}
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity={bars >= 1 ? 1 : 0.2}
          filter="url(#glow-signal)"
          className="transition-opacity duration-300"
        />

        {/* Middle arc - shows when bars >= 2 */}
        <path
          d="M 16 12 A 4 4 0 0 1 19.32 12.68"
          stroke={colors.mid}
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity={bars >= 2 ? 1 : 0.2}
          filter="url(#glow-signal)"
          className="transition-opacity duration-300"
        />

        {/* Outer arc 2 - shows when bars >= 3 */}
        <path
          d="M 16 4 A 12 12 0 0 1 25.29 6.71"
          stroke={colors.outer}
          strokeWidth="2"
          strokeLinecap="round"
          opacity={bars >= 3 ? 1 : 0.2}
          filter="url(#glow-signal)"
          className="transition-opacity duration-300"
        />

        {/* Middle arc 2 - shows when bars >= 3 */}
        <path
          d="M 16 10 A 6 6 0 0 1 20.95 11.05"
          stroke={colors.mid}
          strokeWidth="2"
          strokeLinecap="round"
          opacity={bars >= 3 ? 1 : 0.2}
          filter="url(#glow-signal)"
          className="transition-opacity duration-300"
        />

        {/* Center dot - always visible */}
        <circle
          cx="16"
          cy="22"
          r="2.5"
          fill={colors.inner}
          filter="url(#glow-signal)"
          className="transition-all duration-300"
        />
      </svg>

      {/* Tooltip showing latency */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        {isOnline ? `${latency}ms` : "Offline"}
      </div>
    </div>
  );
};

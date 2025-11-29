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
        color: "#ef4444",
        glowColor: "#ef4444",
      };
    }
    if (bars === 1) {
      return {
        color: "#ef4444",
        glowColor: "#ef4444",
      };
    }
    if (bars === 2) {
      return {
        color: "#eab308",
        glowColor: "#eab308",
      };
    }
    if (bars === 3) {
      return {
        color: "#22c55e",
        glowColor: "#22c55e",
      };
    }
    // bars === 4
    return {
      color: "#22c55e",
      glowColor: "#84cc16",
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
        viewBox="0 0 64 64"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="glow-wifi">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="dot-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={colors.glowColor} stopOpacity="1" />
            <stop offset="70%" stopColor={colors.glowColor} stopOpacity="0.4" />
            <stop offset="100%" stopColor={colors.glowColor} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outermost arc - shows when bars >= 4 */}
        <path
          d="M 32 8 A 24 24 0 0 1 54.43 13.57"
          stroke={colors.color}
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity={bars >= 4 ? 1 : 0.15}
          filter="url(#glow-wifi)"
          className="transition-opacity duration-300"
        />

        {/* Third arc - shows when bars >= 3 */}
        <path
          d="M 32 18 A 14 14 0 0 1 48.79 20.21"
          stroke={colors.color}
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity={bars >= 3 ? 1 : 0.15}
          filter="url(#glow-wifi)"
          className="transition-opacity duration-300"
        />

        {/* Second arc - shows when bars >= 2 */}
        <path
          d="M 32 28 A 7 7 0 0 1 42.95 30.95"
          stroke={colors.color}
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity={bars >= 2 ? 1 : 0.15}
          filter="url(#glow-wifi)"
          className="transition-opacity duration-300"
        />

        {/* First arc - shows when bars >= 1 */}
        <path
          d="M 32 40 A 1 1 0 0 1 33 41"
          stroke={colors.color}
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity={bars >= 1 ? 1 : 0.15}
          filter="url(#glow-wifi)"
          className="transition-opacity duration-300"
        />
      </svg>

      {/* Tooltip showing latency */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        {isOnline ? `${latency}ms` : "Offline"}
      </div>
    </div>
  );
};

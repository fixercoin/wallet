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
      return "#ef4444"; // red
    }
    if (bars === 1) {
      return "#ef4444"; // red
    }
    if (bars === 2) {
      return "#eab308"; // yellow
    }
    if (bars === 3) {
      return "#22c55e"; // green
    }
    // bars === 4
    return "#22c55e"; // green
  };

  const color = getColors();

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
        viewBox="0 0 24 24"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="glow-wifi">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outermost arc - largest, shows when bars >= 4 */}
        <path
          d="M 12 3 C 16.97 3 21.55 5.18 24.36 8.64"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity={bars >= 4 ? 1 : 0.2}
          filter="url(#glow-wifi)"
          className="transition-opacity duration-300"
        />

        {/* Third arc - shows when bars >= 3 */}
        <path
          d="M 12 7 C 15.32 7 18.35 8.46 20.49 10.81"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity={bars >= 3 ? 1 : 0.2}
          filter="url(#glow-wifi)"
          className="transition-opacity duration-300"
        />

        {/* Second arc - shows when bars >= 2 */}
        <path
          d="M 12 11 C 14.21 11 16.15 11.85 17.54 13.24"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity={bars >= 2 ? 1 : 0.2}
          filter="url(#glow-wifi)"
          className="transition-opacity duration-300"
        />

        {/* First arc - smallest, shows when bars >= 1 */}
        <path
          d="M 12 15 C 13.1 15 14.05 14.55 14.7 13.9"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity={bars >= 1 ? 1 : 0.2}
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

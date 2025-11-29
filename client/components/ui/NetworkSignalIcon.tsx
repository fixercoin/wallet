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
            <feGaussianBlur stdDeviation="1.2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outermost arc - shows when bars >= 4 */}
        <path
          d="M 3.1 8.9 Q 12 0 20.9 8.9"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={bars >= 4 ? 1 : 0.2}
          filter="url(#glow-wifi)"
          className="transition-opacity duration-300"
        />

        {/* Third arc - shows when bars >= 3 */}
        <path
          d="M 5.5 11.3 Q 12 5 18.5 11.3"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={bars >= 3 ? 1 : 0.2}
          filter="url(#glow-wifi)"
          className="transition-opacity duration-300"
        />

        {/* Second arc - shows when bars >= 2 */}
        <path
          d="M 8 13.7 Q 12 10 16 13.7"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={bars >= 2 ? 1 : 0.2}
          filter="url(#glow-wifi)"
          className="transition-opacity duration-300"
        />

        {/* First arc/dot - shows when bars >= 1 */}
        <path
          d="M 10.5 16 Q 12 15 13.5 16"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
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

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
  const getSignalStatus = () => {
    if (!isOnline || bars === 0) {
      return {
        color: "#ef4444",
        text: "OFFLINE",
      };
    }
    if (bars === 1) {
      return {
        color: "#ef4444",
        text: "POOR",
      };
    }
    if (bars === 2) {
      return {
        color: "#eab308",
        text: "FAIR",
      };
    }
    if (bars === 3) {
      return {
        color: "#22c55e",
        text: "GOOD",
      };
    }
    return {
      color: "#22c55e",
      text: "EXCELLENT",
    };
  };

  const status = getSignalStatus();
  const title = isOnline
    ? `Signal: ${bars}/4 (${latency}ms)`
    : "No internet connection";

  return (
    <div
      className="relative flex items-center justify-center gap-1.5 group"
      title={title}
      aria-label={`Network signal ${status.text}`}
    >
      {/* Colored dot */}
      <div
        className="w-2.5 h-2.5 rounded-full transition-colors duration-300 flex-shrink-0"
        style={{ backgroundColor: status.color }}
      />

      {/* Signal condition text */}
      <span
        className="text-[10px] uppercase transition-colors duration-300 whitespace-nowrap"
        style={{ color: status.color }}
      >
        {status.text}
      </span>

      {/* Tooltip showing latency */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        {isOnline ? `${latency}ms` : "Offline"}
      </div>
    </div>
  );
};

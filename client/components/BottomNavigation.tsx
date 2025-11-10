import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

export const BottomNavigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: "HOME", path: "/" },
    { label: "MARKET MAKER", path: "/swap" },
    { label: "DROP DISTRIBUTOR", path: "/fixorium/add" },
    { label: "HISTORY", path: "/wallet/history" },
  ];

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-gray-800 border-t border-gray-700 shadow-lg">
      <div className="flex items-center justify-between h-16 px-1 sm:px-2 md:px-4 gap-1 sm:gap-2 md:gap-4">
        {navItems.map((item) => {
          const active = isActive(item.path);

          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`flex-1 flex items-center justify-center py-2 px-1 sm:px-2 rounded-none transition-colors font-semibold uppercase text-xs sm:text-sm whitespace-nowrap min-w-0 ${
                active
                  ? "text-green-500"
                  : "text-gray-400 hover:text-gray-200"
              }`}
              aria-label={item.label}
            >
              <span className="overflow-hidden text-ellipsis">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

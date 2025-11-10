import React from "react";
import { Home, TrendingUp, Gift, History } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

export const BottomNavigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: "HOME", icon: Home, path: "/" },
    { label: "MARKET MAKER", icon: TrendingUp, path: "/swap" },
    { label: "DROP DISTRIBUTOR", icon: Gift, path: "/fixorium/add" },
    { label: "HISTORY", icon: History, path: "/wallet/history" },
  ];

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-gray-800 border-t border-gray-700 shadow-lg">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`flex items-center justify-center py-2 px-4 rounded-none transition-colors text-sm font-semibold uppercase ${
                active
                  ? "text-green-500"
                  : "text-gray-400 hover:text-gray-200"
              }`}
              aria-label={item.label}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

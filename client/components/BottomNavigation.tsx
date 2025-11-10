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
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-lg">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-none transition-colors ${
                active
                  ? "text-green-600 bg-green-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
              aria-label={item.label}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

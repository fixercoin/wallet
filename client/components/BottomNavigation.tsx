import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, TrendingUp, Gift, Clock, ExternalLink } from "lucide-react";

import { useEffect, useState } from "react";

export const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [noFixed, setNoFixed] = useState<boolean>(() => {
    try {
      return document.body.classList.contains("no-fixed-bottom");
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const obs = new MutationObserver(() => {
      try {
        setNoFixed(document.body.classList.contains("no-fixed-bottom"));
      } catch {}
    });
    try {
      obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    } catch {}
    return () => obs.disconnect();
  }, []);

  const navItems = [
    { icon: Home, path: "/", label: "Home" },
    { icon: TrendingUp, path: "/autobot", label: "Market Maker" },
    { icon: Gift, path: "/airdrop", label: "Drop Distributor" },
    { icon: ExternalLink, path: "/dapps", label: "DApps" },
    { icon: Clock, path: "/wallet/history", label: "History" },
  ];

  const isActive = (path: string) => {
    return (
      location.pathname === path || location.pathname.startsWith(path + "/")
    );
  };

  return (
    <div className={`${noFixed ? "relative" : "fixed"} bottom-0 left-0 right-0 z-40 bg-gray-800 border-t border-gray-700 shadow-lg`}>
      <div className="flex items-center justify-between h-14 px-1 sm:px-2 md:px-4 gap-1 sm:gap-2 md:gap-4">
        {navItems.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;

          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`flex-1 flex items-center justify-center py-2 px-1 sm:px-2 rounded-none transition-colors ${
                active ? "text-green-500" : "text-gray-400 hover:text-gray-200"
              }`}
              aria-label={item.label}
            >
              <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

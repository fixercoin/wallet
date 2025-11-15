import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

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
      obs.observe(document.body, {
        attributes: true,
        attributeFilter: ["class"],
      });
    } catch {}
    return () => obs.disconnect();
  }, []);

  const navItems = [
    { path: "/", label: "HOME" },
    { path: "/autobot", label: "SNIPPER" },
    { path: "/airdrop", label: "DROPS" },
    { path: "/dapps", label: "DAPP" },
    { path: "/wallet/history", label: "HISTORY" },
  ];

  const isActive = (path: string) => {
    return (
      location.pathname === path || location.pathname.startsWith(path + "/")
    );
  };

  if (noFixed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#333]" style={{ backgroundColor: '#1f1f1f' }}>
      <div className="flex items-center justify-between h-14 px-1 sm:px-2 md:px-4 gap-1 sm:gap-2 md:gap-4">
        {navItems.map((item) => {
          const active = isActive(item.path);

          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`flex-1 flex items-center justify-center py-2 px-1 sm:px-2 rounded-none transition-colors text-xs sm:text-sm font-semibold ${
                active ? "text-green-500" : "text-gray-400 hover:text-gray-200"
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

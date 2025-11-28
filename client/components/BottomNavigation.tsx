import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Home, Rocket, Flame, Star } from "lucide-react";

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
    { path: "/", label: "HOME", icon: Home },
    { path: "/autobot", label: "ADVANCE TRADE", icon: Rocket },
    { path: "/burn", label: "BURN", icon: Flame },
    { path: "/airdrop", label: "ARIDROP", icon: Star },
  ];

  const isActive = (path: string) => {
    return (
      location.pathname === path || location.pathname.startsWith(path + "/")
    );
  };

  if (noFixed) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#333]"
      style={{ backgroundColor: "#1f1f1f" }}
    >
      <div className="flex items-center justify-between h-14 xs:h-16 sm:h-16 md:h-20 lg:h-24 px-0 sm:px-1.5 md:px-4 lg:px-6 gap-0 xs:gap-0.5 sm:gap-1 md:gap-1.5 w-full">
        {navItems.map((item, index) => {
          const active = isActive(item.path);
          const Icon = item.icon;

          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="flex-1 px-0.5 xs:px-1 sm:px-2 md:px-4 lg:px-6 py-1 xs:py-1.5 sm:py-2 md:py-2.5 lg:py-3 transition-colors font-medium rounded-none leading-tight min-w-0 text-center flex flex-col items-center justify-center gap-0.5 xs:gap-1 text-white"
              aria-label={item.label}
              title={item.label}
            >
              <Icon className="w-4 h-4 xs:w-5 xs:h-5 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 flex-shrink-0 text-white opacity-50" />
              <span className="block truncate text-[7px] xs:text-[8px] sm:text-[9px] md:text-xs lg:text-sm">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

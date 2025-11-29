import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Home, Rocket, Flame, Users } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";

export const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { wallet } = useWallet();
  const [classHidden, setClassHidden] = useState(() =>
    document.body.classList.contains("no-fixed-bottom"),
  );

  // Hide navigation on:
  // 1. Pages with no-fixed-bottom class (WalletSetup, recovery)
  // 2. Home page when no wallet exists
  const shouldHideNav = classHidden || (location.pathname === "/" && !wallet);

  useEffect(() => {
    const obs = new MutationObserver(() => {
      setClassHidden(document.body.classList.contains("no-fixed-bottom"));
    });
    obs.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);

  const navItems = [
    { path: "/", label: "HOME", icon: Home },
    { path: "/autobot", label: "ADVANCE TRADE", icon: Rocket },
    { path: "/burn", label: "BURN TOKEN", icon: Flame },
    { path: "/airdrop", label: "ARIDROP", icon: Users },
  ];

  const isActive = (path: string) => {
    return (
      location.pathname === path || location.pathname.startsWith(path + "/")
    );
  };

  if (shouldHideNav) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#333]"
      style={{ backgroundColor: "#1f1f1f" }}
    >
      <div className="flex items-center justify-between h-16 xs:h-20 sm:h-20 md:h-24 lg:h-28 px-0 sm:px-1.5 md:px-4 lg:px-6 gap-0 xs:gap-0.5 sm:gap-1 md:gap-1.5 w-full">
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
              <span className="block truncate text-[9px] xs:text-[10px] sm:text-[11px] md:text-sm lg:text-base">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Home } from "lucide-react";
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

  const navItems = [{ path: "/", label: "HOME", icon: Home }];

  const isActive = (path: string) => {
    return (
      location.pathname === path || location.pathname.startsWith(path + "/")
    );
  };

  if (shouldHideNav) return null;

  return (
    <div
      className="fixed bottom-4 left-0 right-0 z-40"
      style={{ backgroundColor: "#1f1f1f" }}
    >
      <div className="flex items-center justify-around h-16 xs:h-20 sm:h-20 md:h-24 lg:h-28 px-2 sm:px-3 md:px-6 lg:px-8 gap-2 xs:gap-3 sm:gap-4 md:gap-6 lg:gap-8 w-full">
        {navItems.map((item, index) => {
          const active = isActive(item.path);
          const Icon = item.icon;

          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center justify-center gap-2 flex-1 h-auto py-4 px-2 rounded-md font-bold text-xs bg-transparent hover:bg-[#22c55e]/10 border border-[#22c55e]/40 text-white transition-colors"
              aria-label={item.label}
              title={item.label}
            >
              <Icon className="w-8 h-8 text-[#22c55e]" />
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

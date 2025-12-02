import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Home, ArrowRightLeft, Sigma, Users } from "lucide-react";
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
    { path: "/autobot", label: "TRADE", icon: ArrowRightLeft },
    { path: "/burn", label: "BURN TOKEN", icon: Sigma },
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
      className="fixed bottom-0 left-0 right-0 z-40"
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
              className="px-4 xs:px-5 sm:px-6 md:px-8 lg:px-10 py-3 xs:py-4 sm:py-5 md:py-6 lg:py-7 transition-colors leading-tight text-center flex flex-col items-center justify-center text-white"
              aria-label={item.label}
              title={item.label}
            >
              <Icon className="w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 flex-shrink-0 text-white" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

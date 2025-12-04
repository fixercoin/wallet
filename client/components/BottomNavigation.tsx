import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Home, MessageSquare } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { getUnreadNotifications } from "@/lib/p2p-chat";

export const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { wallet } = useWallet();
  const [classHidden, setClassHidden] = useState(() =>
    document.body.classList.contains("no-fixed-bottom"),
  );
  const [unreadCount, setUnreadCount] = useState(0);

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

  // Monitor unread notifications
  useEffect(() => {
    if (!wallet) return;

    const updateUnreadCount = () => {
      const unread = getUnreadNotifications(wallet.publicKey);
      setUnreadCount(unread.length);
    };

    updateUnreadCount();

    // Check for updates every 2 seconds
    const interval = setInterval(updateUnreadCount, 2000);

    // Also listen for storage changes
    const handleStorageChange = () => {
      updateUnreadCount();
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [wallet]);

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
      <div className="flex items-center justify-between h-16 xs:h-20 sm:h-20 md:h-24 lg:h-28 px-2 xs:px-3 sm:px-3 md:px-6 lg:px-8 gap-2 xs:gap-3 sm:gap-4 md:gap-6 lg:gap-8 w-full">
        <div className="flex items-center justify-around flex-1 gap-2 xs:gap-3 sm:gap-4 md:gap-6 lg:gap-8">
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

          <button
            onClick={() => navigate("/p2p")}
            className={`flex flex-col items-center justify-center gap-2 flex-1 h-auto py-4 px-2 rounded-md font-bold text-xs transition-colors ${
              isActive("/p2p") || isActive("/buy-crypto")
                ? "bg-[#22c55e]/20 border border-[#22c55e] text-[#22c55e]"
                : "bg-transparent hover:bg-[#22c55e]/10 border border-[#22c55e]/40 text-white"
            }`}
            aria-label="P2P Trade"
            title="P2P Trade"
          >
            <MessageSquare className="w-8 h-8" />
            <span className="whitespace-nowrap">P2P TRADE</span>
          </button>
        </div>

        <div className="relative flex items-center">
          <button
            onClick={() => navigate("/p2p")}
            className="relative flex items-center justify-center w-12 h-12 rounded-full border border-[#FF7A5C] hover:bg-[#FF7A5C]/10 transition-colors"
            aria-label="P2P Chat Notifications"
            title="View chat notifications"
          >
            <MessageSquare className="w-6 h-6 text-[#FF7A5C]" />

            {unreadCount > 0 && (
              <div className="absolute top-0 right-0 w-5 h-5 bg-[#FF7A5C] rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
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

  if (shouldHideNav) return null;

  return (
    <div
      className="fixed bottom-4 left-0 right-0 z-40"
      style={{ backgroundColor: "#1f1f1f" }}
    >
      <div className="flex items-center justify-between h-16 xs:h-20 sm:h-20 md:h-24 lg:h-28 px-2 xs:px-3 sm:px-3 md:px-6 lg:px-8 gap-2 xs:gap-3 sm:gap-4 md:gap-6 lg:gap-8 w-full">
        {/* P2P TRADE Text */}
        <div
          onClick={() => navigate("/p2p")}
          className="cursor-pointer flex-1 text-center"
          title="P2P Trade"
        >
          <span className="text-white font-bold text-sm xs:text-base whitespace-nowrap">
            P2P TRADE
          </span>
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

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
    { path: "/autobot", label: "BOOST" },
    { path: "/airdrop", label: "AIRDROP" },
    { path: "/wallet/history", label: "HISTORY" },
    { path: "/assets", label: "ASSET" },
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
      <div className="flex items-center justify-center h-14 md:h-16 lg:h-20 px-1 sm:px-2 md:px-4 lg:px-6 flex-wrap">
        {navItems.map((item, index) => {
          const active = isActive(item.path);

          return (
            <React.Fragment key={item.label}>
              <button
                onClick={() => navigate(item.path)}
                className={`px-2 sm:px-3 md:px-4 lg:px-6 py-1 md:py-2 lg:py-3 transition-colors text-xs md:text-sm lg:text-base font-medium rounded-none ${
                  active
                    ? "text-green-500"
                    : "text-gray-400 hover:text-gray-200"
                }`}
                aria-label={item.label}
                title={item.label}
              >
                {item.label}
              </button>
              {index < navItems.length - 1 && (
                <span className="text-gray-500 px-1 md:px-2 lg:px-3 text-xs md:text-sm lg:text-base">|</span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

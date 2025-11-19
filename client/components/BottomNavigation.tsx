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
      <div className="flex items-center justify-center h-14 px-1 sm:px-2 md:px-4">
        {navItems.map((item, index) => {
          const active = isActive(item.path);

          return (
            <React.Fragment key={item.label}>
              <button
                onClick={() => navigate(item.path)}
                className={`px-3 sm:px-4 py-2 transition-colors text-sm sm:text-base font-medium rounded-none ${
                  active ? "text-green-500" : "text-gray-400 hover:text-gray-200"
                }`}
                aria-label={item.label}
                title={item.label}
              >
                {item.label}
              </button>
              {index < navItems.length - 1 && (
                <span className="text-gray-500 px-2">|</span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

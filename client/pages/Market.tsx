import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Market() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to the new Fiat System
    navigate("/fiat", { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1f1f1f] to-[#2a2a2a] text-white flex items-center justify-center">
      <p className="text-gray-400">Redirecting to Fiat System...</p>
    </div>
  );
}

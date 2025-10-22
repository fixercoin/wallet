import React from "react";
import { useNavigate } from "react-router-dom";
import ExpressP2P from "@/components/wallet/ExpressP2P";

export default function Express() {
  const navigate = useNavigate();
  return <ExpressP2P onBack={() => navigate("/")} />;
}

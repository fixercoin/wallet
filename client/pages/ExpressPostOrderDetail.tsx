import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function ExpressPostOrderDetailDisabled() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/", { replace: true });
  }, [navigate]);
  return null;
}

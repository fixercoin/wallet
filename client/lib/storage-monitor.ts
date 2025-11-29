/**
 * Monitor storage changes and detect when wallet data is lost
 */

let storageWarningShown = false;

export function initStorageMonitoring(): void {
  if (typeof window === "undefined") return;

  // Listen for storage changes from other tabs/windows
  window.addEventListener("storage", (event) => {
    console.log("[StorageMonitor] Storage event detected:", {
      key: event.key,
      newValue: event.newValue ? "exists" : "null",
      oldValue: event.oldValue ? "exists" : "null",
      url: event.url,
    });

    // Check if wallet data was removed
    if (
      event.key === "solana_wallet_accounts" &&
      event.oldValue &&
      !event.newValue
    ) {
      console.warn(
        "[StorageMonitor] ⚠️ Wallet data was cleared from another tab",
      );
      showWarning("Wallet data was cleared. Please reload the page.");
    }

    // Check if wallet data was modified
    if (event.key === "solana_wallet_accounts" && event.newValue) {
      console.log("[StorageMonitor] Wallet data was updated from another tab");
    }
  });

  // Periodic check for storage accessibility
  const checkStorageAccessibility = () => {
    try {
      const test = "__storage_check__";
      localStorage.setItem(test, Date.now().toString());
      localStorage.removeItem(test);
      console.log("[StorageMonitor] ✅ localStorage is accessible");
    } catch (e) {
      console.warn("[StorageMonitor] ⚠️ localStorage access error:", e);
      showWarning("Storage access error. Wallet data may not persist.");
    }
  };

  // Check on load and every 30 seconds
  checkStorageAccessibility();
  setInterval(checkStorageAccessibility, 30000);

  // Listen for page visibility to check storage when tab becomes active
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      console.log(
        "[StorageMonitor] Tab became visible, checking storage...",
        Date.now(),
      );
      checkStorageAccessibility();
    }
  });

  // Detect when browser storage quota is exceeded
  window.addEventListener("error", (event) => {
    if (
      event.message &&
      (event.message.includes("QuotaExceededError") ||
        event.message.includes("QUOTA_EXCEEDED_ERR"))
    ) {
      console.error(
        "[StorageMonitor] ❌ Storage quota exceeded:",
        event.message,
      );
      showWarning(
        "Storage quota exceeded. Please clear some browser data and try again.",
      );
    }
  });

  console.log("[StorageMonitor] Storage monitoring initialized");
}

function showWarning(message: string): void {
  if (storageWarningShown) return;

  storageWarningShown = true;
  console.warn("[StorageMonitor] Warning:", message);

  // Show toast notification if toaster is available
  try {
    // This would require importing toast, but we avoid circular imports
    // Just log for now - the app will handle the missing wallet on next refresh
    console.warn("[StorageMonitor] User should be notified:", message);
  } catch (e) {
    // Silently fail
  }
}

export function getStorageStatus(): {
  isAccessible: boolean;
  hasWalletData: boolean;
  timestamp: number;
} {
  try {
    const isAccessible = (() => {
      try {
        const test = "__test__";
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
      } catch {
        return false;
      }
    })();

    const walletData = localStorage.getItem("solana_wallet_accounts");
    return {
      isAccessible,
      hasWalletData: walletData !== null,
      timestamp: Date.now(),
    };
  } catch (e) {
    return {
      isAccessible: false,
      hasWalletData: false,
      timestamp: Date.now(),
    };
  }
}

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";

interface ConnectionRequest {
  id: string;
  origin: string;
  timestamp: number;
  resolve: (approved: boolean) => void;
}

let pendingRequest: ConnectionRequest | null = null;
let requestListeners: Set<(request: ConnectionRequest | null) => void> =
  new Set();

export const requestWalletConnection = (origin: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const id = `req-${Date.now()}-${Math.random()}`;
    const request: ConnectionRequest = {
      id,
      origin,
      timestamp: Date.now(),
      resolve,
    };
    pendingRequest = request;
    notifyListeners(request);
  });
};

const notifyListeners = (request: ConnectionRequest | null) => {
  requestListeners.forEach((listener) => listener(request));
};

export const subscribeToPendingConnection = (
  listener: (request: ConnectionRequest | null) => void,
) => {
  requestListeners.add(listener);
  if (pendingRequest) {
    listener(pendingRequest);
  }
  return () => {
    requestListeners.delete(listener);
  };
};

export const ConnectionAcceptanceDialog: React.FC = () => {
  const { wallet } = useWallet();
  const [open, setOpen] = useState(false);
  const [currentRequest, setCurrentRequest] =
    useState<ConnectionRequest | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToPendingConnection((request) => {
      if (request) {
        setCurrentRequest(request);
        setOpen(true);
      }
    });
    return unsubscribe;
  }, []);

  const handleApprove = () => {
    if (currentRequest) {
      currentRequest.resolve(true);
      pendingRequest = null;
      notifyListeners(null);
    }
    setOpen(false);
    setCurrentRequest(null);
  };

  const handleReject = () => {
    if (currentRequest) {
      currentRequest.resolve(false);
      pendingRequest = null;
      notifyListeners(null);
    }
    setOpen(false);
    setCurrentRequest(null);
  };

  const getOriginDisplay = (origin: string): string => {
    try {
      const url = new URL(origin);
      return url.hostname;
    } catch {
      return origin;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            Connection Request
          </DialogTitle>
          <DialogDescription>
            A website is requesting access to your wallet
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Website:
            </p>
            <p className="mt-1 break-all font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
              {currentRequest && getOriginDisplay(currentRequest.origin)}
            </p>
          </div>

          {wallet && (
            <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
              <div className="flex items-start gap-2">
                <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Wallet Ready
                  </p>
                  <p className="mt-1 text-xs text-blue-700 dark:text-blue-200">
                    {wallet.label || wallet.publicKey.slice(0, 8)}...
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
              This will allow the website to:
            </p>
            <ul className="mt-2 space-y-1 text-xs text-gray-700 dark:text-gray-300">
              <li>• View your wallet address</li>
              <li>• Request transaction signatures</li>
              <li>• Request message signatures</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleReject}>
            Reject
          </Button>
          <Button onClick={handleApprove}>Approve</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

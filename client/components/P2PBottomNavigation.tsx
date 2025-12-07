import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface P2PBottomNavigationProps {
  onPaymentClick?: () => void;
  onCreateOfferClick?: () => void;
}

export const P2PBottomNavigation: React.FC<P2PBottomNavigationProps> = ({
  onPaymentClick,
  onCreateOfferClick,
}) => {
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#1a1a1a] to-[#1a1a1a]/95 p-4 pb-8">
      <div className="max-w-7xl mx-auto flex justify-center items-center gap-4">
        <Button
          onClick={() => navigate("/buy-order")}
          className="h-16 w-16 bg-transparent border border-gray-300/30 text-gray-300 hover:bg-gray-300/10 font-bold rounded-full text-xs uppercase flex items-center justify-center"
        >
          BUY
        </Button>
        <Button
          onClick={() => navigate("/sell-order")}
          className="h-16 w-16 bg-transparent border border-gray-300/30 text-gray-300 hover:bg-gray-300/10 font-bold rounded-full text-xs uppercase flex items-center justify-center"
        >
          SELL
        </Button>
        <Button
          onClick={onPaymentClick}
          className="h-16 w-16 bg-transparent border border-gray-300/30 text-gray-300 hover:bg-gray-300/10 font-bold rounded-full text-xs uppercase flex items-center justify-center"
        >
          ADD
        </Button>
        <Button
          onClick={() => setShowPostDialog(true)}
          className="h-16 w-16 bg-transparent border border-gray-300/30 text-gray-300 hover:bg-gray-300/10 font-bold rounded-full text-xs uppercase flex items-center justify-center"
        >
          POST
        </Button>
      </div>

      {/* Post Dialog */}
      <Dialog
        open={showPostDialog}
        onOpenChange={(open) => {
          setShowPostDialog(open);
          if (!open) {
            setSelectedServer(null);
            setServerPassword("");
            setPasswordVerified(false);
            setPasswordError("");
          }
        }}
      >
        <DialogContent className="bg-[#1a2847] border border-gray-300/30 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white uppercase">
              CREATE POST
            </DialogTitle>
            <DialogDescription className="text-white/70 uppercase">
              CREATE POST HERE
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Server Selection */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-3 uppercase">
                SELECT SERVER
              </label>
              <div className="space-y-2">
                {SERVERS.map((server) => (
                  <Button
                    key={server.id}
                    onClick={() => handleServerSelect(server.id)}
                    className={`w-full px-4 py-3 rounded-lg transition-all font-semibold uppercase ${
                      selectedServer === server.id
                        ? "bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] text-white"
                        : "bg-[#1a2540]/50 border border-gray-300/30 text-gray-300 hover:bg-[#1a2540]/70"
                    }`}
                  >
                    {server.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Password Input */}
            {selectedServer && !passwordVerified && (
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2 uppercase">
                  ENTER PASSWORD
                </label>
                <div className="space-y-2">
                  <input
                    type="password"
                    value={serverPassword}
                    onChange={(e) => {
                      setServerPassword(e.target.value);
                      setPasswordError("");
                    }}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        handlePasswordSubmit();
                      }
                    }}
                    placeholder="Enter password"
                    className="w-full px-4 py-2 rounded-lg bg-[#1a2540]/50 border border-gray-300/30 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#FF7A5C]"
                  />
                  {passwordError && (
                    <p className="text-red-400 text-xs">{passwordError}</p>
                  )}
                  <Button
                    onClick={handlePasswordSubmit}
                    className="w-full bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white font-semibold rounded-lg uppercase"
                  >
                    VERIFY PASSWORD
                  </Button>
                </div>
              </div>
            )}

            {/* Buy or Sell Selection */}
            {selectedServer && passwordVerified && (
              <div>
                <label className="block text-sm font-medium text-white/80 mb-3 uppercase">
                  POST TYPE
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => {
                      setShowPostDialog(false);
                      setSelectedServer(null);
                      setServerPassword("");
                      setPasswordVerified(false);
                      navigate("/buy-crypto");
                    }}
                    className="h-24 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-blue-600/20 to-blue-600/10 border border-blue-500/30 hover:border-blue-500/50 text-white font-semibold rounded-lg transition-all uppercase"
                  >
                    <ShoppingCart className="w-6 h-6" />
                    <span className="text-xs">BUY</span>
                  </Button>
                  <Button
                    onClick={() => {
                      setShowPostDialog(false);
                      setSelectedServer(null);
                      setServerPassword("");
                      setPasswordVerified(false);
                      navigate("/sell-now");
                    }}
                    className="h-24 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-green-600/20 to-green-600/10 border border-green-500/30 hover:border-green-500/50 text-white font-semibold rounded-lg transition-all uppercase"
                  >
                    <TrendingUp className="w-6 h-6" />
                    <span className="text-xs">SELL</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

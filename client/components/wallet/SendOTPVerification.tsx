import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Phone, Lock } from "lucide-react";
import {
  createOTPSession,
  verifyOTP,
  storeOTPSession,
  maskPhoneNumber,
  normalizePhoneNumber,
  getOTPTimeRemaining,
  isValidPhoneNumber,
} from "@/lib/otp-utils";
import type { OTPSession } from "@/lib/otp-utils";
import { sendSMS, getMessages } from "@/lib/fake-sms";
import { useToast } from "@/hooks/use-toast";

interface SendOTPVerificationProps {
  transactionAmount: string;
  recipientAddress: string;
  tokenSymbol: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

type VerificationStep = "phone" | "otp";

export const SendOTPVerification: React.FC<SendOTPVerificationProps> = ({
  transactionAmount,
  recipientAddress,
  tokenSymbol,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  const [step, setStep] = useState<VerificationStep>("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [otpSession, setOtpSession] = useState<OTPSession | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [smsPreview, setSmsPreview] = useState<{
    body: string;
    ts: number;
  } | null>(null);
  const { toast } = useToast();

  // Countdown timer for OTP expiry
  useEffect(() => {
    if (!otpSession || step !== "otp") return;

    const timer = setInterval(() => {
      const remaining = getOTPTimeRemaining(otpSession);
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(timer);
        setError("OTP code has expired. Please request a new one.");
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [otpSession, step]);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate phone number
    if (!phoneNumber.trim()) {
      setError("Please enter a phone number");
      return;
    }

    if (!isValidPhoneNumber(phoneNumber)) {
      setError("Invalid phone number. Please enter a valid phone number.");
      return;
    }

    // Generate OTP
    try {
      setIsProcessing(true);
      const session = createOTPSession(phoneNumber);

      // Send via fake SMS service (demo-only)
      try {
        const msg = sendSMS(
          session.phoneNumber,
          `Your Fixorium verification code is ${session.code}`,
        );
        setSmsPreview({ body: msg.body, ts: msg.ts });
      } catch (e) {
        console.warn("Failed to send fake SMS", e);
      }

      // Store session and progress to OTP step
      console.log(`[OTP Demo] Code: ${session.code}`);

      storeOTPSession(session);
      setOtpSession(session);
      setTimeRemaining(getOTPTimeRemaining(session));
      setStep("otp");
      setOtpCode("");

      // Notify user (demo)
      toast({
        title: "OTP Sent",
        description: `Sent to ${maskPhoneNumber(session.phoneNumber)}`,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate OTP code",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!otpCode.trim()) {
      setError("Please enter the OTP code");
      return;
    }

    if (!otpSession) {
      setError("OTP session expired. Please start over.");
      return;
    }

    // Verify OTP
    const result = verifyOTP(otpSession, otpCode);

    if (!result.valid) {
      setError(result.error || "Invalid OTP code");
      // Update session with new attempt count
      storeOTPSession(otpSession);
      setOtpSession({ ...otpSession });
      return;
    }

    // OTP verified successfully - proceed with transaction
    try {
      setIsProcessing(true);
      await onConfirm();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Transaction failed. Please try again.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    setPhoneNumber("");
    setOtpCode("");
    setOtpSession(null);
    setError(null);
    setStep("phone");
    onCancel();
  };

  return (
    <div className="express-p2p-page light-theme min-h-screen bg-white text-gray-900 relative overflow-hidden flex flex-col">
      <div className="flex-1 flex items-center justify-center relative z-20">
        <div className="w-full">
          <div className="rounded-2xl border border-[#e6f6ec]/20 bg-gradient-to-br from-[#ffffff] via-[#f0fff4] to-[#a7f3d0] overflow-hidden">
            <div className="space-y-6 p-6">
              {/* Header */}
              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mb-2 ring-2 ring-blue-200/30">
                  <Lock className="h-6 w-6 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {step === "phone"
                    ? "Verify with Phone Number"
                    : "Enter OTP Code"}
                </h2>
                <p className="text-sm text-gray-600">
                  {step === "phone"
                    ? "For your security, enter your phone number to receive a verification code"
                    : "We've sent a 6-digit code to your phone"}
                </p>
              </div>

              {/* Transaction Summary */}
              <Alert className="bg-blue-50 border-blue-200">
                <AlertTriangle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900 text-sm">
                  Confirm transaction: <strong>{transactionAmount}</strong>{" "}
                  {tokenSymbol} to{" "}
                  <span className="font-mono">
                    {recipientAddress.slice(0, 8)}...
                    {recipientAddress.slice(-8)}
                  </span>
                </AlertDescription>
              </Alert>

              {/* Phone Number Step */}
              {step === "phone" && (
                <form onSubmit={handlePhoneSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="phone"
                      className="text-gray-700 flex items-center gap-2"
                    >
                      <Phone className="h-4 w-4" />
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      disabled={isProcessing}
                      className="bg-white text-gray-900 border-gray-300 placeholder:text-gray-400"
                      autoFocus
                    />
                    <p className="text-xs text-gray-600">
                      Enter your phone number. In production, we'll send a
                      verification code via SMS.
                    </p>
                  </div>

                  {error && (
                    <Alert className="bg-red-500/10 text-red-700 border-red-200">
                      <AlertDescription className="text-sm">
                        {error}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      onClick={handleCancel}
                      disabled={isProcessing}
                      variant="outline"
                      className="flex-1 bg-gray-100 text-gray-900 hover:bg-gray-200"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isProcessing || !phoneNumber.trim()}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold"
                    >
                      {isProcessing ? "Sending..." : "Send OTP Code"}
                    </Button>
                  </div>
                </form>
              )}

              {/* OTP Verification Step */}
              {step === "otp" && otpSession && (
                <form onSubmit={handleOTPSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-gray-700">
                      Verification Code Sent To:{" "}
                      <span className="font-semibold">
                        {maskPhoneNumber(otpSession.phoneNumber)}
                      </span>
                    </Label>
                    <Input
                      type="text"
                      placeholder="000000"
                      value={otpCode}
                      onChange={(e) => {
                        const val = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 6);
                        setOtpCode(val);
                      }}
                      maxLength={6}
                      disabled={isProcessing}
                      className="bg-white text-gray-900 border-gray-300 placeholder:text-gray-400 text-center text-2xl font-mono tracking-widest"
                      autoFocus
                    />
                    <div className="flex justify-between items-center text-xs text-gray-600">
                      <span>Enter 6-digit code</span>
                      <span
                        className={
                          timeRemaining <= 30
                            ? "text-red-600 font-semibold"
                            : ""
                        }
                      >
                        Expires in {timeRemaining}s
                      </span>
                    </div>
                  </div>

                  {/* Demo OTP Display (remove in production) */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-xs text-yellow-800">
                      <strong>Demo Mode:</strong> Your OTP code is:{" "}
                      <code className="font-bold text-yellow-900">
                        {otpSession.code}
                      </code>
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      (In production, this code would be sent via SMS and not
                      displayed here)
                    </p>
                  </div>

                  {/* Sent SMS preview (demo fake SMS inbox) */}
                  {smsPreview && (
                    <div className="bg-white/5 border border-gray-200 rounded-lg p-3 mt-2">
                      <p className="text-xs text-gray-700">
                        <strong>SMS Inbox (demo):</strong>
                      </p>
                      <p className="text-sm text-gray-900 font-mono mt-1">
                        {smsPreview.body}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-xs text-gray-600">
                      Attempts remaining:{" "}
                      {otpSession.maxAttempts - otpSession.attempts}
                    </p>
                  </div>

                  {error && (
                    <Alert className="bg-red-500/10 text-red-700 border-red-200">
                      <AlertDescription className="text-sm">
                        {error}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      onClick={() => setStep("phone")}
                      disabled={isProcessing}
                      variant="outline"
                      className="flex-1 bg-gray-100 text-gray-900 hover:bg-gray-200"
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      disabled={isProcessing || otpCode.length !== 6}
                      className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold"
                    >
                      {isProcessing ? "Verifying..." : "Confirm Transaction"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

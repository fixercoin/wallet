import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";

export interface Transaction {
  id: string;
  wallet: string;
  type: "deposit" | "withdraw" | "exchange";
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
  toAmount: number;
  timestamp: string;
  status: "pending" | "completed" | "failed";
  paymentMethod?: string;
  notes?: string;
}

export default function FiatTransactions() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "deposit" | "withdraw" | "exchange">("all");

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!wallet) return;

      setLoading(true);
      try {
        const response = await fetch(
          `/api/fiat/transactions?wallet=${wallet}`,
        );
        const data = await response.json();
        setTransactions(data.transactions || []);
      } catch (error) {
        console.error("Error fetching transactions:", error);
        toast.error("Failed to load transactions");
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [wallet]);

  if (!wallet) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1f1f1f] to-[#2a2a2a] text-white flex items-center justify-center">
        <Card className="w-full max-w-lg mx-4">
          <CardContent className="pt-6">
            <p className="text-center text-gray-300 mb-4">
              Please connect your wallet to view transactions
            </p>
            <Button onClick={() => navigate("/")} className="w-full">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredTransactions = transactions.filter((tx) =>
    filter === "all" ? true : tx.type === filter,
  );

  const downloadCSV = () => {
    const headers = [
      "ID",
      "Type",
      "From Currency",
      "From Amount",
      "To Currency",
      "To Amount",
      "Timestamp",
      "Status",
    ];
    const rows = filteredTransactions.map((tx) => [
      tx.id,
      tx.type,
      tx.fromCurrency,
      tx.fromAmount,
      tx.toCurrency,
      tx.toAmount,
      new Date(tx.timestamp).toLocaleString(),
      tx.status,
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1f1f1f] to-[#2a2a2a] text-white">
      <div className="w-full max-w-2xl mx-auto px-4 py-4 relative z-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            onClick={() => navigate("/fiat")}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            BACK
          </Button>
          <h1 className="text-2xl font-bold text-white uppercase">
            Transaction History
          </h1>
          <Button
            onClick={downloadCSV}
            variant="outline"
            size="sm"
            className="border-gray-700 text-gray-300 hover:text-white"
          >
            <Download className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {(["all", "deposit", "withdraw", "exchange"] as const).map((type) => (
            <Button
              key={type}
              onClick={() => setFilter(type)}
              variant={filter === type ? "default" : "outline"}
              className={`whitespace-nowrap capitalize ${
                filter === type
                  ? "bg-gradient-to-r from-purple-600 to-blue-600"
                  : "border-gray-700 text-gray-300 hover:text-white"
              }`}
            >
              {type}
            </Button>
          ))}
        </div>

        {/* Transactions List */}
        {loading ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-400">Loading transactions...</p>
            </CardContent>
          </Card>
        ) : filteredTransactions.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-400">No transactions found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredTransactions.map((tx) => (
              <TransactionCard key={tx.id} transaction={tx} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TransactionCard({ transaction }: { transaction: Transaction }) {
  const getIcon = (type: string) => {
    switch (type) {
      case "deposit":
        return "📥";
      case "withdraw":
        return "📤";
      case "exchange":
        return "🔄";
      default:
        return "💱";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-400";
      case "pending":
        return "text-yellow-400";
      case "failed":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  return (
    <Card className="bg-gray-800/50 border-gray-700 hover:border-gray-600 transition-all">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="text-3xl">{getIcon(transaction.type)}</div>
            <div className="flex-1">
              <p className="font-semibold capitalize mb-1">
                {transaction.type}
              </p>
              <p className="text-sm text-gray-400">
                {new Date(transaction.timestamp).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="flex items-center gap-2 mb-1 justify-end">
              <span className="text-sm font-medium">
                {transaction.fromAmount.toFixed(2)} {transaction.fromCurrency}
              </span>
              {transaction.type === "exchange" && (
                <>
                  <span className="text-gray-500">→</span>
                  <span className="text-sm font-medium text-purple-400">
                    {transaction.toAmount.toFixed(2)} {transaction.toCurrency}
                  </span>
                </>
              )}
            </div>
            <p className={`text-xs font-semibold capitalize ${getStatusColor(transaction.status)}`}>
              {transaction.status}
            </p>
          </div>
        </div>

        {transaction.paymentMethod && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <p className="text-xs text-gray-500">
              Payment Method: {transaction.paymentMethod.replace(/_/g, " ")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

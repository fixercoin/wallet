import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useWallet } from "@/contexts/WalletContext";
import { shortenAddress, copyToClipboard } from "@/lib/wallet";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, Plus } from "lucide-react";

const ADMIN_WALLET = "Ec72XPYcxYgpRFaNb9b6BHe1XdxtqFjzz2wLRTnx1owA";
const POSTS_STORAGE_KEY = "express_p2p_posts";

type ExpressP2PPost = {
  id: string;
  title: string;
  description: string;
  createdAt: number;
};

type ExpressP2PProps = {
  onBack: () => void;
};

export function ExpressP2P({ onBack }: ExpressP2PProps) {
  const { wallet } = useWallet();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [posts, setPosts] = useState<ExpressP2PPost[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const raw = window.localStorage.getItem(POSTS_STORAGE_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw) as ExpressP2PPost[];
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter(
          (post): post is ExpressP2PPost =>
            Boolean(post?.id && post.title && post.description && post.createdAt),
        )
        .sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.warn("Failed to parse stored Express P2P posts", error);
      return [];
    }
  });
  const [lastUpdated, setLastUpdated] = useState(() => new Date());

  const isAdmin = wallet?.publicKey === ADMIN_WALLET;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(POSTS_STORAGE_KEY, JSON.stringify(posts));
    } catch (error) {
      console.warn("Failed to persist Express P2P posts", error);
    }
  }, [posts]);

  useEffect(() => {
    setLastUpdated(new Date());
  }, [posts]);

  const handleCopyAddress = async () => {
    if (!wallet) {
      return;
    }

    const success = await copyToClipboard(wallet.publicKey);
    toast({
      title: success ? "Address copied" : "Copy failed",
      description: success
        ? "Wallet address copied to clipboard"
        : "Please copy the address manually.",
      variant: success ? "default" : "destructive",
    });
  };

  const handleDialogChange = (open: boolean) => {
    if (open && !isAdmin) {
      toast({
        title: "Access denied",
        description: "Only the admin wallet can add new posts.",
        variant: "destructive",
      });
      return;
    }

    setIsDialogOpen(open);
  };

  const handleCreatePost = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!wallet || !isAdmin) {
      toast({
        title: "Access denied",
        description: "Only the admin wallet can add new posts.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();

    if (!title) {
      toast({
        title: "Title required",
        description: "Enter a title for the post.",
        variant: "destructive",
      });
      return;
    }

    if (!description) {
      toast({
        title: "Details required",
        description: "Provide details for the post.",
        variant: "destructive",
      });
      return;
    }

    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const newPost: ExpressP2PPost = {
      id,
      title,
      description,
      createdAt: Date.now(),
    };

    event.currentTarget.reset();
    setPosts((previous) => [newPost, ...previous]);
    setIsDialogOpen(false);

    toast({
      title: "Post added",
      description: "Your Express P2P post is now visible.",
    });
  };

  const headerPlaceholder = useMemo(() => <div className="h-9 w-9" />, []);

  return (
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))]">
      <div className="bg-white/95 backdrop-blur-sm sticky top-0 z-10 border-b border-white/60">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-9 w-9 rounded-full dash-btn-circle"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="flex flex-col items-center flex-1">
            <span className="text-xs font-semibold tracking-widest text-[hsl(var(--muted-foreground))]">
              EXPRESS P2P SERVICE
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-sm">
                {wallet ? shortenAddress(wallet.publicKey, 6) : "No wallet"}
              </span>
              {wallet ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyAddress}
                  className="h-8 w-8 rounded-full dash-btn-circle"
                  aria-label="Copy wallet address"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>

          {isAdmin ? (
            <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
              <DialogTrigger asChild>
                <Button
                  size="icon"
                  className="h-9 w-9 rounded-full dash-btn-circle"
                  aria-label="Add new post"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Express P2P post</DialogTitle>
                  <DialogDescription>
                    Share a new offer or announcement with your community.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreatePost} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input id="title" name="title" placeholder="Offer title" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Details</Label>
                    <Textarea
                      id="description"
                      name="description"
                      placeholder="Provide details, rates, or instructions"
                      rows={4}
                    />
                  </div>
                  <DialogFooter className="gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="dash-btn">
                      Publish Post
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : (
            headerPlaceholder
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-8 space-y-6">
        <div className="wallet-card rounded-2xl p-6 flex flex-col items-center gap-6">
          <div
            className="express-p2p-loader"
            role="status"
            aria-label="Scanning for express P2P orders"
          />
          <p className="text-base font-semibold text-center express-detecting-text">
            detecting orders
          </p>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-wide">Recent posts</h2>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          </div>

          {posts.length === 0 ? (
            <div className="wallet-card rounded-xl p-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
              No posts yet. Admin can add new announcements with the plus icon.
            </div>
          ) : (
            posts.map((post) => (
              <article
                key={post.id}
                className="wallet-card rounded-xl p-4 space-y-2 animate-fade-in"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-base font-semibold">{post.title}</h3>
                  <span className="text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                    {new Date(post.createdAt).toLocaleDateString()} {" "}
                    {new Date(post.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-[hsl(var(--foreground))]">
                  {post.description}
                </p>
              </article>
            ))
          )}
        </section>
      </div>
    </div>
  );
}

export default ExpressP2P;

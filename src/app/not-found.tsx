import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="text-center">
        <div className="font-display text-8xl tracking-tight text-muted-foreground/30">404</div>
        <h1 className="mt-4 font-display text-3xl">This stage is empty.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you asked for doesn&apos;t exist — or the project was deleted.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to productions
          </Link>
        </Button>
      </div>
    </div>
  );
}

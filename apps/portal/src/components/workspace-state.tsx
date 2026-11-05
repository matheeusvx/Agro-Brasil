"use client";
import { AlertCircle, RefreshCw } from "lucide-react";
import { usePortal } from "./portal-provider";
import { Skeleton } from "./ui/skeleton";
import { Button } from "./ui/button";
export function WorkspaceState() {
  const { loading, error, refresh } = usePortal();
  if (loading)
    return (
      <div
        role="status"
        aria-label="Carregando espaço de trabalho"
        className="space-y-6"
      >
        <Skeleton className="h-12 w-72" />
        <div className="grid grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  return (
    <section className="state-panel" role="alert">
      <AlertCircle size={26} />
      <h2>Não foi possível carregar seu espaço.</h2>
      <p>{error || "A consulta está indisponível no momento."}</p>
      <Button variant="outline" onClick={refresh}>
        <RefreshCw size={16} />
        Tentar novamente
      </Button>
    </section>
  );
}

"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Copy,
  Check,
  MapPin,
  ShieldCheck,
  LoaderCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import { Button } from "./ui/button";
import { agro, allRows } from "@/lib/client-api";
import {
  date,
  number,
  eventName,
  type Production,
  type TraceEvent,
} from "@/lib/types";
import { usePortal } from "./portal-provider";
export function ProductionDetails({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const { session, workspace } = usePortal();
  const [data, setData] = useState<{
      production: Production;
      events: TraceEvent[];
    } | null>(null),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  useEffect(() => {
    setData(null);
    setError("");
    if (!id) return;
    const abort = new AbortController();
    async function load() {
      try {
        const result = await agro<{ data: Production }>(
          "/productions/" + id,
          abort.signal,
        );
        if (result.data.propertyId !== workspace?.property.id)
          throw new Error("Registro indisponível no contexto selecionado.");
        const events = await allRows<TraceEvent>(
          "/lots/" + result.data.lot.id + "/events",
          abort.signal,
        );
        if (!abort.signal.aborted) setData({ production: result.data, events });
      } catch (error) {
        if (!abort.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "Não foi possível consultar os detalhes.",
          );
      }
    }
    void load();
    return () => abort.abort();
  }, [id, session.organizationId, workspace?.property.id, version]);
  return (
    <Sheet
      open={!!id}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="sm:max-w-[560px] w-full p-0 gap-0">
        <SheetHeader className="drawer-header">
          <p className="eyebrow">ORIGEM E RASTREABILIDADE</p>
          <SheetTitle>Detalhes da produção</SheetTitle>
          <SheetDescription>
            Informações e movimentações confirmadas do lote.
          </SheetDescription>
        </SheetHeader>
        <div className="drawer-body">
          {error ? (
            <div role="alert" className="state-panel compact">
              <AlertCircle size={24} />
              <p>{error}</p>
              <Button
                variant="outline"
                onClick={() => setVersion((v) => v + 1)}
              >
                <RefreshCw size={16} />
                Tentar novamente
              </Button>
            </div>
          ) : !data ? (
            <div
              className="flex items-center gap-2 text-[#69766d]"
              role="status"
            >
              <LoaderCircle className="animate-spin" size={18} />
              Consultando produção e eventos…
            </div>
          ) : (
            <>
              <div className="detail-crop">
                <div>
                  <span className="status-badge">
                    <Check size={11} />
                    Origem registrada
                  </span>
                  <h2>{data.production.cropName}</h2>
                  <p>Safra {data.production.seasonLabel}</p>
                </div>
                <div>
                  <strong>{number(data.production.quantityKg)}</strong>
                  <span>kg registrados</span>
                </div>
              </div>
              <dl className="detail-list">
                <div>
                  <dt>Data da colheita</dt>
                  <dd>{date(data.production.harvestedOn)}</dd>
                </div>
                <div>
                  <dt>Origem</dt>
                  <dd>
                    <MapPin size={13} />
                    {data.production.location.municipality} /{" "}
                    {data.production.location.uf}
                  </dd>
                </div>
                <div>
                  <dt>Lote</dt>
                  <dd className="lot-identifier">
                    <code>{data.production.lot.id}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Copiar identificação do lote"
                      onClick={() =>
                        navigator.clipboard
                          .writeText(data.production.lot.id)
                          .then(() =>
                            toast.success("Identificação do lote copiada."),
                          )
                          .catch(() =>
                            toast.error(
                              "Selecione e copie o identificador manualmente.",
                            ),
                          )
                      }
                    >
                      <Copy size={14} />
                    </Button>
                  </dd>
                </div>
                <div>
                  <dt>Registrado em</dt>
                  <dd>{date(data.production.createdAt)}</dd>
                </div>
              </dl>
              <Link
                className="text-link mt-5"
                href={"/rastreabilidade?lote=" + data.production.lot.id}
              >
                Rastrear pedidos deste lote
              </Link>
              <div className="mt-8 mb-5">
                <h3 className="font-semibold text-base">Caminho do lote</h3>
                <p className="text-xs text-[#69766d] mt-1">
                  Eventos confirmados, em ordem de registro.
                </p>
              </div>
              <ol className="trace-timeline">
                {data.events.map((event, index) => (
                  <li key={event.id ?? index}>
                    <span className="trace-check">
                      <Check size={10} />
                    </span>
                    <div>
                      <h4>{eventName(event.type)}</h4>
                      <p>
                        {event.location?.municipality}{" "}
                        {event.location?.uf && "/ " + event.location.uf}
                      </p>
                      <time>
                        {new Date(event.recordedAt).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="info-note flex gap-2 mt-6">
                <ShieldCheck size={16} className="shrink-0" />A rastreabilidade
                representa eventos confirmados. Não é localização GPS em tempo
                real.
              </p>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

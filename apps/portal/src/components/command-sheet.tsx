"use client";
import { useRef, useState } from "react";
import { AlertCircle, LoaderCircle, MapPin } from "lucide-react";
import { toast } from "sonner";
import { request } from "@/lib/client-api";
import {
  commandMessage,
  IdempotencyKeeper,
  isTransient,
  locationProblem,
  parseKg,
  quantityProblem,
  UFS,
  type ActionKind,
} from "@/lib/commands";
import { number } from "@/lib/types";
import { usePortal } from "./portal-provider";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";

export type CommandRequest = {
  kind: ActionKind;
  endpoint: string;
  title: string;
  /** O que a pessoa está confirmando, com dados vindos da API. */
  summary: string;
  confirmLabel: string;
  /** Corpo além do local (ex.: quantityAcceptedKg integral, offerId). */
  extra?: Record<string, unknown>;
  /** Pedido de oferta: saldo apresentado limita a quantidade. */
  availableKg?: number;
  successMessage: string;
};

/**
 * Formulário único das operações: local + confirmação explícita, envio com
 * Idempotency-Key estável entre tentativas e sucesso só após a resposta da API.
 */
export function CommandSheet({
  command,
  onClose,
  onDone,
}: {
  command: CommandRequest | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { handleAccessError } = usePortal();
  const keeper = useRef(new IdempotencyKeeper());
  const [municipality, setMunicipality] = useState("");
  const [uf, setUf] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const open = command !== null;
  const asks = command?.kind === "request";

  function close() {
    if (busy) return;
    setConfirmed(false);
    setQuantity("");
    setError("");
    onClose();
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!command || busy) return;
    const problem =
      (asks ? quantityProblem(quantity, command.availableKg ?? 0) : "") ||
      locationProblem({ municipality, uf, confirmed });
    if (problem) return setError(problem);
    const body = {
      ...command.extra,
      ...(asks ? { quantityKg: parseKg(quantity.trim()) } : {}),
      location: { municipality: municipality.trim(), uf },
      locationConfirmed: true,
    };
    const payload = JSON.stringify(body);
    const key = keeper.current.keyFor(command.endpoint + payload);
    setBusy(true);
    setError("");
    try {
      await request("/api/agro" + command.endpoint, {
        method: "POST",
        body: payload,
        headers: { "Idempotency-Key": key },
      });
      keeper.current.settle();
      toast.success(command.successMessage);
      setBusy(false);
      setConfirmed(false);
      setQuantity("");
      onClose();
      onDone();
    } catch (failure) {
      keeper.current.settle(failure);
      setBusy(false);
      setError(commandMessage(failure));
      if (handleAccessError(failure)) return onClose();
      // 404/409: estado mudou; recarrega para mostrar o estado atual.
      if (!isTransient(failure) && [404, 409].includes((failure as { status: number }).status)) onDone();
    }
  }
  return (
    <Sheet open={open} onOpenChange={(next) => !next && close()}>
      <SheetContent
        className="sm:max-w-[480px] w-full gap-0 p-0"
        onInteractOutside={(e) => busy && e.preventDefault()}
        onEscapeKeyDown={(e) => busy && e.preventDefault()}
      >
        {command && (
          <form className="cmd-sheet" onSubmit={submit} noValidate>
            <SheetHeader className="cmd-head">
              <SheetTitle>{command.title}</SheetTitle>
              <SheetDescription>{command.summary}</SheetDescription>
            </SheetHeader>
            <div className="cmd-body">
              {asks && (
                <div className="field-label">
                  <label htmlFor="cmd-qty">Quantidade (kg)</label>
                  <input
                    id="cmd-qty"
                    className="cmd-input"
                    inputMode="decimal"
                    autoComplete="off"
                    value={quantity}
                    onChange={(e) => { setQuantity(e.target.value); setError(""); }}
                    aria-describedby="cmd-saldo"
                    disabled={busy}
                    required
                  />
                  <small id="cmd-saldo">
                    Saldo apresentado: {number(command.availableKg ?? 0)} kg. A API confirma o saldo no envio.
                  </small>
                </div>
              )}
              <fieldset className="cmd-location" disabled={busy}>
                <legend>
                  <MapPin size={14} aria-hidden="true" /> Local desta operação
                </legend>
                <div className="field-label">
                  <label htmlFor="cmd-city">Município</label>
                  <input
                    id="cmd-city"
                    className="cmd-input"
                    autoComplete="address-level2"
                    maxLength={120}
                    value={municipality}
                    onChange={(e) => { setMunicipality(e.target.value); setError(""); }}
                    required
                  />
                </div>
                <div className="field-label">
                  <label htmlFor="cmd-uf">UF</label>
                  <select id="cmd-uf" className="cmd-input" value={uf} onChange={(e) => { setUf(e.target.value); setError(""); }} required>
                    <option value="">Selecione</option>
                    {UFS.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <label className="cmd-confirm">
                  <input type="checkbox" checked={confirmed} onChange={(e) => { setConfirmed(e.target.checked); setError(""); }} />
                  <span>Confirmo que o município e a UF informados estão corretos.</span>
                </label>
              </fieldset>
              <p className="cmd-note">
                Registro declarado por sua organização, sem rastreamento por GPS. O horário é definido pelo servidor.
              </p>
              {error && (
                <p role="alert" className="error-inline">
                  <AlertCircle size={16} />
                  {error}
                </p>
              )}
            </div>
            <div className="cmd-actions">
              <button type="button" className="ag-btn cmd-secondary" onClick={close} disabled={busy}>
                Voltar
              </button>
              <button
                type="submit"
                className={"ag-btn " + (command.kind === "cancel" ? "cmd-danger" : "ag-btn-dark")}
                disabled={busy}
                aria-busy={busy}
              >
                {busy ? (
                  <>
                    <LoaderCircle size={16} className="animate-spin" /> Enviando…
                  </>
                ) : (
                  command.confirmLabel
                )}
              </button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

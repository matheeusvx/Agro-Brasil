"use client";
import { useEffect, useRef, useState } from "react";
import {
  Sprout,
  MapPin,
  LoaderCircle,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { usePortal } from "./portal-provider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "./ui/sheet";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { request, RequestError } from "@/lib/client-api";
import type { Production } from "@/lib/types";
export function ProductionCreate({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const { workspace, refresh } = usePortal();
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [uncertain, setUncertain] = useState(false);
  const submitting = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const writable = workspace?.home.canWrite === true;
  useEffect(() => {
    if (!open) {
      setError("");
      setUncertain(false);
      formRef.current?.reset();
    }
  }, [open]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace || !writable || submitting.current || uncertain) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const body = {
      propertyId: workspace.property.id,
      cropId: data.get("cropId"),
      seasonLabel: String(data.get("seasonLabel")).trim(),
      quantityKg: Number(String(data.get("quantityKg")).replace(",", ".")),
      harvestedOn: data.get("harvestedOn"),
      location: {
        municipality: String(data.get("municipality")).trim(),
        uf: String(data.get("uf")).toUpperCase(),
      },
      locationConfirmed: data.get("confirmed") === "on",
    };
    try {
      await request<{ data: Production }>("/api/agro/productions", {
        method: "POST",
        body: JSON.stringify(body),
      });
      onOpenChange(false);
      formRef.current?.reset();
      router.push("/producao");
      refresh();
      toast.success("Produção registrada. Lote e origem criados juntos.");
    } catch (error) {
      if (!(error instanceof RequestError) || error.status >= 500) {
        setUncertain(true);
        setError(
          "Não foi possível confirmar o envio. Consulte a listagem antes de registrar novamente, para evitar duplicidade.",
        );
      } else setError(error.message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        if (!busy) {
          onOpenChange(value);
          if (!value) {
            setError("");
            setUncertain(false);
          }
        }
      }}
    >
      <SheetContent
        className="sm:max-w-[580px] w-full gap-0 p-0"
        onInteractOutside={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <SheetHeader className="drawer-header">
          <p className="eyebrow">NOVA PRODUÇÃO</p>
          <SheetTitle>Da colheita ao primeiro registro.</SheetTitle>
          <SheetDescription>
            Registre sua produção. O lote e a origem são criados na mesma
            operação.
          </SheetDescription>
        </SheetHeader>
        <form
          ref={formRef}
          id="production-form"
          className="drawer-body"
          onSubmit={save}
        >
          {workspace ? (
            <>
              <div className="property-context">
                <MapPin size={17} />
                <div>
                  <span>PROPRIEDADE DE ORIGEM</span>
                  <strong>{workspace.property.name}</strong>
                </div>
              </div>
              {!writable && (
                <p className="info-note">
                  Seu vínculo permite apenas consulta. Nenhum registro será
                  enviado.
                </p>
              )}
              <div className="form-section">
                <span>
                  <Sprout size={17} />
                </span>
                <div>
                  <h3>Sua colheita</h3>
                  <p>O que foi produzido e em qual safra.</p>
                </div>
              </div>
              <div className="form-grid">
                <label className="col-span-2 field-label">
                  Cultura
                  <select
                    name="cropId"
                    required
                    defaultValue=""
                    disabled={!writable}
                  >
                    <option value="" disabled>
                      Selecione uma cultura
                    </option>
                    {workspace.catalog.crops.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-label">
                  Quantidade colhida (kg)
                  <Input
                    name="quantityKg"
                    type="number"
                    inputMode="decimal"
                    min="0.001"
                    max="1000000000"
                    step="0.001"
                    required
                    placeholder="Ex.: 120,5"
                    disabled={!writable}
                  />
                  <small>Até três casas decimais.</small>
                </label>
                <label className="field-label">
                  Safra
                  <Input
                    name="seasonLabel"
                    required
                    maxLength={60}
                    placeholder="Ex.: Primavera 2026"
                    disabled={!writable}
                  />
                </label>
                <label className="col-span-2 field-label">
                  Data da colheita
                  <Input
                    name="harvestedOn"
                    type="date"
                    required
                    max={new Date().toISOString().slice(0, 10)}
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    disabled={!writable}
                  />
                </label>
              </div>
              <div className="form-section mt-7">
                <span>
                  <MapPin size={17} />
                </span>
                <div>
                  <h3>Origem confirmada</h3>
                  <p>A localização será vinculada ao registro de origem.</p>
                </div>
              </div>
              <div className="form-grid origin-fields">
                <label className="field-label">
                  Município
                  <Input
                    name="municipality"
                    required
                    maxLength={120}
                    defaultValue={workspace.property.municipality}
                    disabled={!writable}
                  />
                </label>
                <label className="field-label">
                  UF
                  <select
                    name="uf"
                    required
                    defaultValue={workspace.property.uf ?? ""}
                    disabled={!writable}
                  >
                    <option value="">UF</option>
                    {"AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO"
                      .split(" ")
                      .map((uf) => (
                        <option key={uf}>{uf}</option>
                      ))}
                  </select>
                </label>
              </div>
              <label className="confirmation">
                <input
                  type="checkbox"
                  name="confirmed"
                  required
                  disabled={!writable}
                />
                <span>
                  Confirmo que a localização informada corresponde à origem
                  desta produção.
                </span>
              </label>
              <div className="form-assurance">
                <ShieldCheck size={17} />
                <span>
                  A produção, o lote e o primeiro evento de origem serão
                  registrados juntos.
                </span>
              </div>
            </>
          ) : (
            <p className="info-note">
              Aguarde o carregamento de uma propriedade autorizada para
              cadastrar.
            </p>
          )}
          {error && (
            <p role="alert" className="error-inline mt-5">
              {error}
            </p>
          )}
        </form>
        <SheetFooter className="drawer-footer">
          <Button
            variant="outline"
            type="button"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Voltar
          </Button>
          {uncertain ? (
            <Button
              onClick={() => {
                onOpenChange(false);
                refresh();
                router.push("/producao");
              }}
            >
              Consultar registros
              <ArrowRight size={16} />
            </Button>
          ) : (
            <Button
              type="submit"
              form="production-form"
              disabled={busy || !writable || !workspace?.catalog.crops.length}
            >
              {busy ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <Sprout size={16} />
              )}
              Registrar produção
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

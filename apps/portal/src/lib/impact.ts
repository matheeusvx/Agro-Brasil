import { RequestError } from "./client-api";
import type { ExcessImpact } from "./types";

// Apresentação do indicador de impacto. Nenhuma regra de cálculo: só rótulos
// e validação do formato recebido da API (schemaVersion 1).
export const impactPath = (propertyId: string) =>
  "/properties/" + encodeURIComponent(propertyId) + "/excess-impact";

const kg = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;
export function isImpact(value: unknown, propertyId: string): value is ExcessImpact {
  const v = value as ExcessImpact;
  return (
    !!v &&
    v.schemaVersion === 1 &&
    v.propertyId === propertyId &&
    typeof v.isDemonstration === "boolean" &&
    !Number.isNaN(Date.parse(v.asOf)) &&
    ["registered", "published", "acceptedNet", "pickedUp", "received"].every((k) =>
      kg(v.funnelKg?.[k as keyof ExcessImpact["funnelKg"]]),
    ) &&
    ["availableActive", "reservedNow", "inTransitNow", "expiredAvailable"].every((k) =>
      kg(v.balancesKg?.[k as keyof ExcessImpact["balancesKg"]]),
    ) &&
    (["VENDA", "DOACAO"] as const).every(
      (m) => kg(v.byModeKg?.[m]?.published) && kg(v.byModeKg?.[m]?.received),
    )
  );
}

export const funnelSteps = (i: ExcessImpact) => [
  { label: "Produção registrada", value: i.funnelKg.registered },
  { label: "Ofertado", value: i.funnelKg.published },
  { label: "Aceito em pedidos", value: i.funnelKg.acceptedNet },
  { label: "Retirado", value: i.funnelKg.pickedUp },
  { label: "Recebido (confirmado)", value: i.funnelKg.received },
];
export const balanceSteps = (i: ExcessImpact) => [
  { label: "Disponível no prazo", value: i.balancesKg.availableActive },
  { label: "Reservado agora", value: i.balancesKg.reservedNow },
  { label: "Em trânsito agora", value: i.balancesKg.inTransitNow },
  { label: "Vencido sem destinação", value: i.balancesKg.expiredAvailable },
];
// Mostra a divisão venda × doação apenas quando há alguma oferta publicada.
export const hasModeData = (i: ExcessImpact) =>
  i.byModeKg.VENDA.published > 0 || i.byModeKg.DOACAO.published > 0;
export const isEmptyImpact = (i: ExcessImpact) => i.funnelKg.published === 0;

export function impactErrorMessage(error: unknown) {
  if (error instanceof RequestError) {
    if (error.status === 401) return "Sua sessão expirou. Entre novamente para consultar.";
    if (error.status === 403) return "Seu perfil não pode consultar este indicador.";
    if (error.status === 404) return "Propriedade não encontrada nesta organização.";
  }
  return "Indicador indisponível no momento. Nenhum valor foi estimado.";
}

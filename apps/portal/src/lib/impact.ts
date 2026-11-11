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

// ---------- Página Destino: apresentação derivada só dos valores da API ----------
// Percentual para leitura (não altera nenhum valor da API).
export const share = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
export const percent = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value) + "%";

export type Slice = { key: string; label: string; value: number; tone: string; hint: string; href: string };
// Partes disjuntas cuja soma é o ofertado (reconciliação garantida pela API).
export const composition = (i: ExcessImpact): Slice[] => [
  { key: "received", label: "Recebido", value: i.funnelKg.received, tone: "received", hint: "confirmado pelo destinatário", href: "/pedidos?situacao=RECEBIDO" },
  { key: "transit", label: "Em trânsito", value: i.balancesKg.inTransitNow, tone: "transit", hint: "retirado, aguardando confirmação", href: "/pedidos?situacao=RETIRADO" },
  { key: "reserved", label: "Reservado", value: i.balancesKg.reservedNow, tone: "reserved", hint: "pedido aceito, aguardando retirada", href: "/pedidos?situacao=ACEITO" },
  { key: "available", label: "Disponível", value: i.balancesKg.availableActive, tone: "available", hint: "oferta ainda no prazo", href: "/ofertas?prazo=no-prazo" },
  { key: "expired", label: "Vencido sem destinação", value: i.balancesKg.expiredAvailable, tone: "expired", hint: "prazo encerrado com saldo", href: "/ofertas?prazo=vencidas" },
];

export const journey = (i: ExcessImpact) => {
  const steps = funnelSteps(i);
  return steps.map((s, n) => ({
    ...s,
    width: share(s.value, steps[0].value || steps[1].value),
    fromPrevious: n === 0 ? null : share(s.value, steps[n - 1].value),
  }));
};

export const modes = (i: ExcessImpact) =>
  (["VENDA", "DOACAO"] as const).map((m) => ({
    key: m,
    label: m === "VENDA" ? "Venda" : "Doação",
    published: i.byModeKg[m].published,
    received: i.byModeKg[m].received,
    rate: share(i.byModeKg[m].received, i.byModeKg[m].published),
  }));

export type Insight = { tone: "attention" | "info" | "good"; text: string; href?: string; action?: string };
// Sugestões de ação a partir dos saldos atuais; nunca afirmam perda ou desperdício.
export function insights(i: ExcessImpact): Insight[] {
  const out: Insight[] = [];
  const kg = (v: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(v) + " kg";
  if (i.balancesKg.expiredAvailable > 0)
    out.push({ tone: "attention", text: `${kg(i.balancesKg.expiredAvailable)} ficaram sem destinação quando o prazo da oferta acabou.`, href: "/ofertas?prazo=vencidas", action: "Ver ofertas vencidas" });
  if (i.balancesKg.reservedNow > 0)
    out.push({ tone: "info", text: `${kg(i.balancesKg.reservedNow)} reservados aguardam retirada.`, href: "/pedidos?situacao=ACEITO", action: "Ver pedidos a retirar" });
  if (i.balancesKg.inTransitNow > 0)
    out.push({ tone: "info", text: `${kg(i.balancesKg.inTransitNow)} já saíram e aguardam a confirmação de quem recebe.`, href: "/pedidos?situacao=RETIRADO", action: "Ver pedidos em trânsito" });
  if (i.balancesKg.availableActive > 0)
    out.push({ tone: "good", text: `${kg(i.balancesKg.availableActive)} seguem disponíveis para venda ou doação.`, href: "/ofertas?prazo=no-prazo", action: "Ver ofertas disponíveis" });
  return out;
}

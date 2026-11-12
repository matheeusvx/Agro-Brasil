// Comandos comerciais de cooperativa e instituição. A API é a autoridade:
// aqui só decidimos quais ações oferecer e como enviar/interpretar.
import type { Audience } from "./audience";
import { RequestError } from "./client-api";
import type { HomeOperation } from "./organization-home";

export type ActionKind = "pickup" | "receipt" | "cancel" | "request";
export type OperationAction = {
  kind: ActionKind;
  label: string;
  endpoint: string;
  tone: "primary" | "secondary";
};

/** Ações possíveis pelo estado informado pela API (sem papel: ver canShowWriteActions). */
export function operationActions(
  audience: Exclude<Audience, "producer">,
  op: Pick<HomeOperation, "id" | "status" | "shipment">,
): OperationAction[] {
  if (audience === "cooperative")
    return op.status === "ACEITO" && op.shipment?.status === "PLANEJADA"
      ? [{ kind: "pickup", label: "Registrar retirada", endpoint: `/shipments/${op.shipment.id}/pickup`, tone: "primary" }]
      : [];
  const actions: OperationAction[] = [];
  if (op.status === "RETIRADO" && op.shipment?.status === "RETIRADA")
    actions.push({ kind: "receipt", label: "Confirmar recebimento", endpoint: `/shipments/${op.shipment.id}/receipts`, tone: "primary" });
  // Backend permite cancelamento somente antes da retirada.
  if (op.status === "SOLICITADO" || op.status === "ACEITO")
    actions.push({ kind: "cancel", label: "Cancelar solicitação", endpoint: `/orders/${op.id}/cancel`, tone: "secondary" });
  return actions;
}

export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

export type LocationInput = { municipality: string; uf: string; confirmed: boolean };
/** Validação de interface; a API revalida tudo. */
export function locationProblem(l: LocationInput) {
  const m = l.municipality.trim();
  if (!m || m.length > 120) return "Informe o município (até 120 caracteres).";
  if (!UFS.includes(l.uf)) return "Selecione a UF.";
  if (!l.confirmed) return "Confirme que o local informado está correto.";
  return "";
}
export function quantityProblem(raw: string, availableKg: number) {
  if (!/^\d+([.,]\d{1,3})?$/.test(raw.trim()))
    return "Informe a quantidade em kg, com até três casas decimais.";
  const value = parseKg(raw.trim());
  if (value <= 0) return "Informe uma quantidade maior que zero.";
  if (value > availableKg) return "A quantidade não pode ultrapassar o saldo disponível.";
  return "";
}
export const parseKg = (raw: string) => Math.round(Number(raw.replace(",", ".")) * 1000) / 1000;

/**
 * Mantém a mesma Idempotency-Key enquanto a mesma tentativa (mesmo corpo e
 * destino) é repetida após falha transitória. Sucesso ou recusa definitiva
 * encerram a tentativa; mudar os dados inicia outra.
 */
export class IdempotencyKeeper {
  private current: { signature: string; key: string } | null = null;
  constructor(private generate: () => string = () => crypto.randomUUID()) {}
  keyFor(signature: string) {
    if (this.current?.signature !== signature)
      this.current = { signature, key: this.generate() };
    return this.current.key;
  }
  settle(error?: unknown) {
    if (!error || !isTransient(error)) this.current = null;
  }
}
/** Rede, timeout e 5xx podem ter sido aplicados ou não: repetir com a mesma chave. */
export const isTransient = (error: unknown) =>
  !(error instanceof RequestError) || error.status >= 500;

export function commandMessage(error: unknown) {
  if (!(error instanceof RequestError))
    return "Sem conexão com o serviço. Tente novamente: a mesma tentativa será reenviada sem duplicar a operação.";
  switch (error.status) {
    case 400:
      return "Confira os dados informados. " + error.message;
    case 401:
      return "Sua sessão expirou. Entre novamente.";
    case 403:
      return "Seu perfil não pode executar esta ação nesta organização.";
    case 404:
      return "Registro não encontrado ou indisponível para esta organização. Os dados serão atualizados.";
    case 409:
      return error.message + " Os dados serão atualizados.";
    default:
      return "O serviço não confirmou a operação. Tente novamente: a mesma tentativa será reenviada sem duplicar.";
  }
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { request, RequestError } from "@/lib/client-api";
import { parseChat } from "@/lib/chat";
import { usePortal } from "./portal-provider";
import { chatHints } from "./messages";

type Participant = { organizationId: string; role: "PRODUTOR" | "SOLICITANTE" | "COOPERATIVA" };
const roleLabel: Record<Participant["role"], string> = {
  PRODUTOR: "Produtor do pedido",
  SOLICITANTE: "Organização solicitante",
  COOPERATIVA: "Cooperativa designada",
};
const roleType: Record<Participant["role"], string> = {
  PRODUTOR: "PEQUENO_PRODUTOR_RURAL",
  SOLICITANTE: "INSTITUICAO",
  COOPERATIVA: "COOPERATIVA",
};

/**
 * "Enviar mensagem" a partir de um pedido: descobre (no servidor) a outra
 * organização do pedido e abre a conversa única do par — criada só se a API
 * autorizar. LEITOR não recebe o botão (não pode abrir conversas).
 */
export function MessageButton({ orderId, compact = false }: { orderId: string; compact?: boolean }) {
  const { member, session, handleAccessError } = usePortal();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [choices, setChoices] = useState<Participant[] | null>(null);
  if (member.role !== "ADMIN" && member.role !== "EDITOR") return null;

  async function open(p: Participant) {
    setBusy(true);
    setChoices(null);
    try {
      const body = await request<unknown>("/api/agro/chats/open", { method: "POST", body: JSON.stringify({ organizationId: p.organizationId }) });
      const chat = parseChat(body, session.organizationId);
      // Solicitante pode ser instituição ou comprador local: só registramos o tipo certo.
      if (p.role !== "SOLICITANTE") chatHints.set(chat.id, roleType[p.role]);
      router.push("/mensagens?conversa=" + chat.id);
    } catch (e) {
      if (handleAccessError(e) && !(e instanceof RequestError && e.status === 403)) return;
      toast.error(
        e instanceof RequestError && e.status === 404
          ? "A conversa não está disponível: o pedido precisa estar ativo entre as duas organizações."
          : e instanceof RequestError && e.status === 403
            ? "Seu perfil não pode abrir conversas."
            : "Não foi possível abrir a conversa. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function start() {
    setBusy(true);
    try {
      const body = await request<{ data: { participants: Participant[]; cancelled: boolean } }>(
        "/api/chat-target?orderId=" + encodeURIComponent(orderId),
      );
      const list = body.data.participants;
      if (body.data.cancelled) return toast.error("Pedido cancelado não abre novas conversas.");
      if (!list.length) return toast.error("Este pedido ainda não tem outra organização designada.");
      if (list.length === 1) return void (await open(list[0]));
      setChoices(list);
    } catch (e) {
      if (!handleAccessError(e)) toast.error("Não foi possível consultar as organizações do pedido.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="msg-button-wrap">
      <button
        type="button"
        className={"msg-button" + (compact ? " is-compact" : "")}
        onClick={() => void start()}
        disabled={busy}
        aria-haspopup={choices ? "menu" : undefined}
        aria-expanded={choices ? true : undefined}
        aria-label={compact ? "Enviar mensagem sobre este pedido" : undefined}
      >
        {busy ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <MessageCircle size={14} aria-hidden="true" />}
        {!compact && "Enviar mensagem"}
      </button>
      {choices && (
        <span className="msg-choices" role="menu" aria-label="Com quem conversar">
          {choices.map((c) => (
            <button key={c.organizationId} type="button" role="menuitem" onClick={() => void open(c)}>
              {roleLabel[c.role]}
            </button>
          ))}
          <button type="button" role="menuitem" className="msg-cancel" onClick={() => setChoices(null)}>
            Cancelar
          </button>
        </span>
      )}
    </span>
  );
}

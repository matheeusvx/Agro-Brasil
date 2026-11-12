// Públicos atendidos pelo portal e regras de interface por perfil.
// A API continua sendo a autoridade de autorização; aqui só decidimos o que
// mostrar e o que nem chega a ser consultado.
export type Audience = "producer" | "cooperative" | "institution";
export type OrganizationType =
  | "PEQUENO_PRODUTOR_RURAL"
  | "COOPERATIVA"
  | "INSTITUICAO";

const byType: Record<string, Audience> = {
  PEQUENO_PRODUTOR_RURAL: "producer",
  COOPERATIVA: "cooperative",
  INSTITUICAO: "institution",
};
export const audienceOf = (type: string | undefined): Audience | null =>
  (type && byType[type]) || null;

type MembershipLike = { organizationId: string; type: string; role: string };
/** Somente vínculos com público atendido pelo portal. */
export const portalMemberships = <T extends MembershipLike>(memberships: T[]) =>
  memberships.filter((m) => audienceOf(m.type) !== null);
/** Primeiro vínculo atendido; produtor tem precedência para preservar o fluxo original. */
export function defaultMembership<T extends MembershipLike>(memberships: T[]) {
  const supported = portalMemberships(memberships);
  return (
    supported.find((m) => m.type === "PEQUENO_PRODUTOR_RURAL") ??
    supported.find((m) => m.type === "COOPERATIVA") ??
    supported[0]
  );
}

export const audienceLabel: Record<Audience, string> = {
  producer: "Pequeno produtor rural",
  cooperative: "Cooperativa",
  institution: "Instituição",
};
export const roleLabel = (role: string) =>
  role === "LEITOR" ? "Consulta" : role === "EDITOR" ? "Edição" : "Administração";

/** Páginas por público. /visao-geral e /perfil existem para todos. */
const pages: Record<Audience, RegExp[]> = {
  producer: [
    /^\/$/,
    /^\/visao-geral$/,
    /^\/perfil$/,
    /^\/minha-fazenda$/,
    /^\/producao$/,
    /^\/ofertas$/,
    /^\/pedidos$/,
    /^\/destino$/,
    /^\/rastreabilidade(?:\/[^/]+)?$/,
  ],
  cooperative: [/^\/$/, /^\/visao-geral$/, /^\/perfil$/, /^\/remessas(?:\/[^/]+)?$/],
  institution: [
    /^\/$/,
    /^\/visao-geral$/,
    /^\/perfil$/,
    /^\/solicitacoes(?:\/[^/]+)?$/,
    /^\/ofertas-disponiveis$/,
  ],
};
export const pageAllowed = (path: string, audience: Audience) =>
  // Mensagens é compartilhada pelos três públicos; a API comprova cada relação.
  path === "/mensagens" || pages[audience].some((pattern) => pattern.test(path));

/** Somente quem pode escrever e não é LEITOR vê ações de escrita como possíveis. */
export const canShowWriteActions = (canWrite: boolean, role: string) =>
  canWrite === true && (role === "ADMIN" || role === "EDITOR");

/**
 * Próximo passo de uma operação, por público. `write` indica que a ação é do
 * próprio perfil (ainda não habilitada neste incremento); `follow` é apenas
 * acompanhamento de etapa de outro participante.
 */
export function nextStep(audience: Audience, status: string) {
  if (audience === "cooperative") {
    if (status === "ACEITO")
      return { label: "Registrar retirada", kind: "write" as const };
    if (status === "RETIRADO")
      return { label: "Aguardando confirmação do destinatário", kind: "follow" as const };
  }
  if (audience === "institution") {
    if (status === "RETIRADO")
      return { label: "Confirmar recebimento", kind: "write" as const };
    if (status === "ACEITO")
      return { label: "Aguardando retirada pela cooperativa", kind: "follow" as const };
    if (status === "SOLICITADO")
      return { label: "Aguardando aceite do produtor", kind: "follow" as const };
  }
  return null;
}

/** Nome do estado do pedido na perspectiva de cada público. */
export function statusFor(audience: Audience, status: string) {
  const common: Record<string, string> = {
    RECEBIDO: "Recebimento confirmado",
    CANCELADO: "Cancelado",
  };
  const specific: Record<Audience, Record<string, string>> = {
    cooperative: {
      SOLICITADO: "Solicitado",
      ACEITO: "Retirada pendente",
      RETIRADO: "Retirado · aguardando destinatário",
    },
    institution: {
      SOLICITADO: "Aguardando aceite",
      ACEITO: "Aceito · aguardando retirada",
      RETIRADO: "Aguardando sua confirmação",
    },
    producer: {},
  };
  return specific[audience][status] ?? common[status] ?? status;
}

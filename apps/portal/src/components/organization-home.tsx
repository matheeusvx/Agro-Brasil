"use client";
import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Info,
  LockKeyhole,
  RefreshCw,
} from "lucide-react";
import { request } from "@/lib/client-api";
import {
  canShowWriteActions,
  nextStep,
  roleLabel,
  statusFor,
  type Audience,
} from "@/lib/audience";
import {
  parseOrganizationHome,
  type HomeOperation,
  type OrganizationHome,
  type OrganizationHomePage,
} from "@/lib/organization-home";
import { number, date } from "@/lib/types";
import { usePortal } from "./portal-provider";
import { Skeleton } from "./ui/skeleton";

type OrgAudience = Exclude<Audience, "producer">;
const endpoint: Record<OrgAudience, string> = {
  cooperative: "/cooperative-home",
  institution: "/institution-home",
};
const orgType = {
  cooperative: "COOPERATIVA",
  institution: "INSTITUICAO",
} as const;

type LoadState =
  | { status: "loading" }
  | { status: "ready"; page: OrganizationHomePage }
  | { status: "error"; message: string };

/**
 * Carrega a home da organização ativa. Toda resposta é validada contra a
 * organização ativa; a requisição é abortada na troca de vínculo e o
 * componente é remontado por organização (key), sem dados residuais.
 */
export function useOrganizationHome(limit: number, offset: number) {
  const { session, audience, handleAccessError, revision } = usePortal();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [retry, setRetry] = useState(0);
  const organizationId = session.organizationId;
  useEffect(() => {
    if (audience === "producer") return;
    const abort = new AbortController();
    setState({ status: "loading" });
    request<unknown>(
      `/api/agro${endpoint[audience]}?limit=${limit}&offset=${offset}`,
      {},
      abort.signal,
    )
      .then((body) => {
        if (abort.signal.aborted) return;
        setState({
          status: "ready",
          page: parseOrganizationHome(body, {
            organizationId,
            organizationType: orgType[audience],
          }),
        });
      })
      .catch((error) => {
        if (abort.signal.aborted) return;
        // Em 401/403 os dados atuais são descartados antes de revalidar.
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Não foi possível carregar as informações.",
        });
        handleAccessError(error);
      });
    return () => abort.abort();
  }, [audience, organizationId, limit, offset, revision, retry, handleAccessError]);
  return { state, retry: () => setRetry((r) => r + 1) };
}

export function HomeSkeleton() {
  return (
    <div role="status" aria-label="Carregando informações da organização" className="space-y-5">
      <Skeleton className="h-44 w-full rounded-[26px]" />
      <Skeleton className="h-28 w-full rounded-[24px]" />
      <Skeleton className="h-64 w-full rounded-[22px]" />
    </div>
  );
}
export function HomeError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="state-panel" role="alert">
      <AlertCircle size={26} />
      <h2>Não foi possível carregar as informações.</h2>
      <p>{message}</p>
      <p className="text-xs">Nenhum indicador foi exibido para não mostrar números incorretos.</p>
      <button type="button" className="ag-btn ag-btn-dark" onClick={onRetry}>
        <RefreshCw size={16} /> Tentar novamente
      </button>
    </section>
  );
}
export function DemoNotice({ home }: { home: OrganizationHome }) {
  if (!home.isDemonstration) return null;
  return (
    <p className="pb-demo" role="note">
      <Info size={13} aria-hidden="true" /> Dados demonstrativos de participantes fictícios.
    </p>
  );
}
const shortId = (id: string) => "#" + id.replace(/-/g, "").slice(0, 8).toUpperCase();
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/**
 * Espaço reservado para ações de escrita do próximo incremento. LEITOR (ou
 * canWrite=false) não recebe nenhum controle de escrita.
 */
export function ActionSlot({
  audience,
  operation,
  home,
  role,
}: {
  audience: OrgAudience;
  operation: HomeOperation;
  home: OrganizationHome;
  role: string;
}) {
  const step = nextStep(audience, operation.status);
  if (!step) return null;
  if (step.kind === "follow")
    return (
      <span className="pb-step" data-kind="follow">
        <Clock3 size={13} aria-hidden="true" /> {step.label}
      </span>
    );
  if (!canShowWriteActions(home.canWrite, role))
    return (
      <span className="pb-step" data-kind="readonly">
        <Eye size={13} aria-hidden="true" /> Somente consulta
      </span>
    );
  return (
    <button
      type="button"
      className="pb-action"
      disabled
      aria-disabled="true"
      data-write-action={step.label}
      title="Esta ação será habilitada no próximo incremento."
    >
      <LockKeyhole size={13} aria-hidden="true" /> {step.label}
      <small>em breve</small>
    </button>
  );
}

function PriorityList({
  audience,
  home,
  role,
  emptyText,
}: {
  audience: OrgAudience;
  home: OrganizationHome;
  role: string;
  emptyText: string;
}) {
  return (
    <section className="panel pb-panel ag-rise" style={{ "--i": 2 } as CSSProperties} aria-labelledby="pb-priorities">
      <div className="panel-heading">
        <div>
          <h2 id="pb-priorities">O que fazer agora</h2>
          <p>Até três prioridades, das mais antigas para as mais recentes</p>
        </div>
      </div>
      {home.pending.length ? (
        <ol className="pb-priorities">
          {home.pending.map((op, i) => (
            <li key={op.id} data-status={op.status}>
              <span className="pb-rank" aria-hidden="true">{i + 1}</span>
              <div className="pb-priority-body">
                <strong>{statusFor(audience, op.status)}</strong>
                <p>
                  {number(op.quantityKg)} kg · pedido {shortId(op.id)} · desde {date(op.createdAt)}
                </p>
              </div>
              <ActionSlot audience={audience} operation={op} home={home} role={role} />
            </li>
          ))}
        </ol>
      ) : (
        <div className="empty-inline">{emptyText}</div>
      )}
    </section>
  );
}

export function OperationsTable({
  audience,
  page,
  role,
}: {
  audience: OrgAudience;
  page: OrganizationHomePage;
  role: string;
}) {
  const { home } = page;
  if (!home.operations.length)
    return (
      <div className="empty-inline">
        {page.pagination.total
          ? "Nenhum registro nesta página."
          : audience === "cooperative"
            ? "Nenhuma remessa foi designada para esta cooperativa até agora."
            : "Esta instituição ainda não enviou solicitações."}
      </div>
    );
  return (
    <ul className="pb-ops" aria-label={audience === "cooperative" ? "Remessas" : "Solicitações"}>
      {home.operations.map((op) => (
        <li key={op.id} data-status={op.status}>
          <span className="pb-dot" aria-hidden="true" />
          <div className="pb-op-main">
            <strong>{statusFor(audience, op.status)}</strong>
            <p>
              Pedido {shortId(op.id)} · lote {shortId(op.lotId)}
            </p>
          </div>
          <span className="pb-op-kg">{number(op.quantityKg)} kg</span>
          <time dateTime={op.createdAt}>{date(op.createdAt)}</time>
          <ActionSlot audience={audience} operation={op} home={home} role={role} />
        </li>
      ))}
    </ul>
  );
}

export function Pager({
  pagination,
  onChange,
  label,
}: {
  pagination: { limit: number; offset: number; total: number };
  onChange: (offset: number) => void;
  label: string;
}) {
  const { limit, offset, total } = pagination;
  if (total <= limit && offset === 0) return null;
  const end = Math.min(offset + limit, total);
  return (
    <nav className="pb-pager" aria-label={"Paginação de " + label}>
      <span aria-live="polite">
        {total ? `${offset + 1}–${end} de ${total}` : "Sem registros"}
      </span>
      <button type="button" onClick={() => onChange(Math.max(0, offset - limit))} disabled={offset === 0} aria-label="Página anterior">
        <ChevronLeft size={16} />
      </button>
      <button type="button" onClick={() => onChange(offset + limit)} disabled={end >= total} aria-label="Próxima página">
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}

type Stat = { label: string; count: number; kg?: number; tone?: "attention" | "done" };
function Stats({ items, label }: { items: Stat[]; label: string }) {
  return (
    <section className="pb-stats ag-rise" style={{ "--i": 1 } as CSSProperties} aria-label={label}>
      {items.map((s) => (
        <div key={s.label} data-tone={s.tone}>
          <span>{s.label}</span>
          <strong>
            {number(s.count)}
            <small>{s.count === 1 ? "pedido" : "pedidos"}</small>
          </strong>
          {s.kg !== undefined && <em>{number(s.kg)} kg</em>}
        </div>
      ))}
    </section>
  );
}

const RECENT = 5;
export function OrganizationHomeView() {
  const { audience, member } = usePortal();
  const { state, retry } = useOrganizationHome(RECENT, 0);
  if (audience === "producer") return null;
  if (state.status === "loading") return <HomeSkeleton />;
  if (state.status === "error") return <HomeError message={state.message} onRetry={retry} />;
  const { home } = state.page;
  const s = home.byStatus;
  const cooperative = audience === "cooperative";
  const writer = canShowWriteActions(home.canWrite, member.role);
  const headline = cooperative
    ? s.ACEITO.count
      ? `${s.ACEITO.count} ${s.ACEITO.count === 1 ? "retirada pendente" : "retiradas pendentes"} · ${number(s.ACEITO.quantityKg)} kg`
      : home.total
        ? "Nenhuma retirada pendente agora."
        : "Nenhuma remessa designada até agora."
    : s.RETIRADO.count
      ? `${s.RETIRADO.count} ${s.RETIRADO.count === 1 ? "entrega aguarda" : "entregas aguardam"} sua confirmação de recebimento`
      : s.SOLICITADO.count
        ? `${s.SOLICITADO.count} ${s.SOLICITADO.count === 1 ? "solicitação aguarda" : "solicitações aguardam"} aceite do produtor`
        : home.total
          ? "Nada aguardando sua ação agora."
          : "Nenhuma solicitação enviada até agora.";
  const stats: Stat[] = cooperative
    ? [
        { label: "Remessas designadas", count: home.total },
        { label: "Retiradas pendentes", count: s.ACEITO.count, kg: s.ACEITO.quantityKg, tone: "attention" },
        { label: "Aguardando destinatário", count: s.RETIRADO.count, kg: s.RETIRADO.quantityKg },
        { label: "Recebimentos confirmados", count: s.RECEBIDO.count, kg: s.RECEBIDO.quantityKg, tone: "done" },
      ]
    : [
        { label: "Solicitações enviadas", count: home.total },
        { label: "Aguardando aceite", count: s.SOLICITADO.count, kg: s.SOLICITADO.quantityKg },
        { label: "Aguardando retirada", count: s.ACEITO.count, kg: s.ACEITO.quantityKg },
        { label: "Aguardando sua confirmação", count: s.RETIRADO.count, kg: s.RETIRADO.quantityKg, tone: "attention" },
        { label: "Recebimentos concluídos", count: s.RECEBIDO.count, kg: s.RECEBIDO.quantityKg, tone: "done" },
      ];
  return (
    <div className="pb-home" data-audience={audience}>
      <section className="pb-hero ag-rise" style={{ "--i": 0 } as CSSProperties}>
        <p className="eyebrow">{cooperative ? "COOPERATIVA · RETIRADAS E REMESSAS" : "INSTITUIÇÃO · SOLICITAÇÕES E RECEBIMENTOS"}</p>
        <h1>{member.name}</h1>
        <p className="pb-hero-meta">
          {roleLabel(member.role)} · atualizado às {time(home.fetchedAt)}
          {!writer && <span className="pb-readonly"><Eye size={12} aria-hidden="true" /> Somente consulta</span>}
        </p>
        <p className="pb-headline" data-attention={(cooperative ? s.ACEITO.count : s.RETIRADO.count) ? true : undefined}>
          {headline}
        </p>
        {!cooperative && (
          <div className="ov-hero-actions">
            <Link href="/ofertas-disponiveis" className="ag-btn ag-btn-lime">
              Ver ofertas disponíveis <ArrowUpRight size={15} />
            </Link>
          </div>
        )}
      </section>
      <Stats items={stats} label={cooperative ? "Resumo das remessas" : "Resumo das solicitações"} />
      <PriorityList
        audience={audience}
        home={home}
        role={member.role}
        emptyText={
          cooperative
            ? "Nenhuma retirada ou entrega em andamento para acompanhar."
            : "Nenhuma solicitação em andamento para acompanhar."
        }
      />
      <section className="panel pb-panel ag-rise" style={{ "--i": 3 } as CSSProperties}>
        <div className="panel-heading">
          <div>
            <h2>{cooperative ? "Remessas recentes" : "Histórico recente"}</h2>
            <p>As {RECENT} operações mais novas desta organização</p>
          </div>
          <Link href={cooperative ? "/remessas" : "/solicitacoes"} className="text-link">
            Ver todas <ArrowUpRight size={14} />
          </Link>
        </div>
        <OperationsTable audience={audience} page={state.page} role={member.role} />
      </section>
      <p className="data-note">
        Quantidades por estado atual do pedido, informadas pela API. Cancelados ({s.CANCELADO.count}) não contam como recebimento.
      </p>
      <DemoNotice home={home} />
    </div>
  );
}

const PAGE = 20;
export function OperationsPage() {
  const { audience, member } = usePortal();
  const [offset, setOffset] = useState(0);
  const { state, retry } = useOrganizationHome(PAGE, offset);
  if (audience === "producer") return null;
  const cooperative = audience === "cooperative";
  const title = cooperative ? "Remessas" : "Solicitações";
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{cooperative ? "COOPERATIVA" : "INSTITUIÇÃO"}</p>
          <h1>{title}</h1>
          <p>
            {cooperative
              ? "Pedidos com remessa designada para esta cooperativa, dos mais novos para os mais antigos."
              : "Pedidos enviados por esta instituição, dos mais novos para os mais antigos."}
          </p>
        </div>
      </div>
      {state.status === "loading" ? (
        <HomeSkeleton />
      ) : state.status === "error" ? (
        <HomeError message={state.message} onRetry={retry} />
      ) : (
        <section className="panel pb-panel">
          <OperationsTable audience={audience} page={state.page} role={member.role} />
          <Pager pagination={state.page.pagination} onChange={setOffset} label={title.toLowerCase()} />
          <DemoNotice home={state.page.home} />
        </section>
      )}
    </>
  );
}

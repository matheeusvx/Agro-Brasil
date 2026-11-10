"use client";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  AlertCircle,
  Compass,
  Eye,
  Hammer,
  LoaderCircle,
  Lock,
  RefreshCw,
  Save,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import {
  ELEMENT_TYPES,
  MAX_ELEMENTS,
  TYPE_INFO,
  canEdit as canEditState,
  defaultName,
  diffCount,
  diffElements,
  farmReducer,
  fetchLayout,
  freeSpot,
  initialFarmState,
  isDirty,
  loadFarm,
  newId,
  reconcile,
  saveFarm,
  sectorLinks,
  validateDraft,
  type FarmAction,
  type FarmElement,
  type FarmLayout,
  type FarmState,
  type SaveOutcome,
} from "@/lib/farm";
import { demoFarm, overviewFor } from "@/lib/farm-demo";
import { RequestError } from "@/lib/client-api";
import type { Crop, Production } from "@/lib/types";
import { usePortal } from "../portal-provider";
import { WorkspaceState } from "../workspace-state";
import { Button } from "../ui/button";
import { FarmScene } from "./farm-scene";
import { SpriteThumb } from "./farm-art";
import { PropertyRecords, SectorDetails, SectorEditor } from "./farm-panels";
import { SectorMenu } from "./farm-hud";

export function FarmPage() {
  const { session, workspace, loading } = usePortal();
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("exemplo") === "1") setDemo(true);
  }, []);
  if (demo) return <DemoFarm onExit={() => setDemo(false)} />;
  if (loading || !workspace) return <WorkspaceState />;
  const key = session.organizationId + ":" + workspace.property.id;
  // Remonta ao trocar organização/propriedade: nenhum estado atravessa contextos.
  return <FarmWorkspace key={key} stateKey={key} onDemo={() => setDemo(true)} />;
}

function FarmWorkspace({ stateKey, onDemo }: { stateKey: string; onDemo: () => void }) {
  const { workspace, refresh } = usePortal();
  const property = workspace!.property;
  const [state, dispatch] = useReducer(farmReducer, stateKey, initialFarmState);
  const [tick, setTick] = useState(0);
  const [offset, setOffset] = useState(0);
  const [pageBusy, setPageBusy] = useState(false);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const abort = new AbortController();
    dispatch({ type: "load", key: stateKey });
    setPageBusy(true);
    loadFarm(property.id, abort.signal, undefined, offset)
      .then(({ layout, overview }) => {
        if (!abort.signal.aborted) dispatch({ type: "loaded", key: stateKey, layout, overview });
      })
      .catch((error) => {
        if (abort.signal.aborted) return;
        if (error instanceof RequestError && error.status === 401) return refresh();
        dispatch({
          type: "failed",
          key: stateKey,
          message:
            error instanceof RequestError && error.status === 404
              ? "Propriedade não encontrada nesta organização."
              : error instanceof Error
                ? error.message
                : "Não foi possível carregar a fazenda.",
        });
      })
      .finally(() => !abort.signal.aborted && setPageBusy(false));
    return () => abort.abort();
  }, [property.id, stateKey, tick, offset, refresh]);

  useUnsavedGuard(isDirty(state));

  const crops = workspace!.catalog.crops;
  const productions = workspace!.productions;
  const cropName = useCropNames(crops, productions, state);

  if (state.status === "loading" && !state.layout) return <FarmLoading />;
  if (state.status === "error" || !state.layout)
    return (
      <section className="state-panel" role="alert">
        <AlertCircle size={26} />
        <h2>Não foi possível abrir sua fazenda.</h2>
        <p>{state.error || "A consulta está indisponível no momento."}</p>
        <Button variant="outline" onClick={reload}>
          <RefreshCw size={16} /> Tentar novamente
        </Button>
      </section>
    );
  return (
    <FarmView
      state={state}
      dispatch={dispatch}
      stateKey={stateKey}
      propertyName={property.name}
      place={[property.municipality, property.uf].filter(Boolean).join(" · ")}
      cropName={cropName}
      crops={crops}
      productions={productions}
      reload={reload}
      onPage={(o) => setOffset(o)}
      pageBusy={pageBusy}
      onDemo={onDemo}
      persist={(version, draft, onChecking) => saveFarm(property.id, version, draft, undefined, onChecking)}
      remote={() => fetchLayout(property.id)}
    />
  );
}

// Fazenda de exemplo: dados simulados, editável localmente, nada vai à API.
function DemoFarm({ onExit }: { onExit: () => void }) {
  const data = useMemo(() => demoFarm(), []);
  const [state, dispatch] = useReducer(farmReducer, "demo", (key) =>
    farmReducer(initialFarmState(key), { type: "loaded", key, layout: data.layout, overview: data.overview }),
  );
  const cropName = useCropNames(data.crops, data.editorProductions, state);
  useUnsavedGuard(isDirty(state));
  return (
    <FarmView
      demo
      state={state}
      dispatch={dispatch}
      stateKey="demo"
      propertyName={data.overview.property.name}
      place="Dados simulados para demonstração"
      cropName={cropName}
      crops={data.crops}
      productions={data.editorProductions}
      reload={() => {}}
      onPage={() => {}}
      pageBusy={false}
      onDemo={onExit}
      persist={async (version, draft) => {
        const layout: FarmLayout = {
          ...data.layout,
          version: version + 1,
          state: draft.length ? "CONFIGURED" : "EMPTY",
          elements: draft.map((e) => ({ ...e, name: e.name.trim() })),
          updatedAt: new Date().toISOString(),
        };
        // Recalcula os estados do exemplo localmente para a nova versão.
        setTimeout(() =>
          dispatch({ type: "overview", key: "demo", overview: overviewFor(layout.elements, layout.version, data.productions) }),
        );
        return { kind: "saved", layout } satisfies SaveOutcome;
      }}
      remote={async () => state.layout!}
    />
  );
}

function useUnsavedGuard(dirty: boolean) {
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      if (dirtyRef.current) toast.info("As alterações não salvas da fazenda foram descartadas.");
    };
  }, []);
}
function useCropNames(crops: Crop[], productions: Production[], state: FarmState) {
  const names = useMemo(() => {
    const map = new Map(crops.map((c) => [c.id, c.name]));
    for (const p of productions) if (!map.has(p.cropId)) map.set(p.cropId, p.cropName);
    for (const c of state.overview?.summary.crops ?? []) if (!map.has(c.cropId)) map.set(c.cropId, c.name);
    return map;
  }, [crops, productions, state.overview]);
  return useCallback((id: string) => names.get(id), [names]);
}

function FarmLoading() {
  return (
    <div className="fz-page" role="status" aria-label="Carregando sua fazenda">
      <div className="fz-world">
        <div className="fz-stage fz-stage-loading">
          <LoaderCircle className="animate-spin" size={28} aria-hidden="true" />
          <p>Preparando sua fazenda…</p>
        </div>
      </div>
    </div>
  );
}

type ViewProps = {
  state: FarmState;
  dispatch: React.Dispatch<FarmAction>;
  stateKey: string;
  propertyName: string;
  place: string;
  cropName: (id: string) => string | undefined;
  crops: Crop[];
  productions: Production[];
  reload: () => void;
  onPage: (offset: number) => void;
  pageBusy: boolean;
  onDemo: () => void;
  demo?: boolean;
  persist: (version: number, draft: FarmElement[], onChecking: () => void) => Promise<SaveOutcome>;
  remote: () => Promise<FarmLayout>;
};

function FarmView(props: ViewProps) {
  const { state, dispatch, stateKey, cropName, crops, productions, reload, demo = false } = props;
  const layout = state.layout!;
  const editable = canEditState(state);
  const editing = state.mode === "edit" && !!state.draft;
  const elements = editing ? state.draft! : layout.elements;
  const sectors = useMemo(
    () => reconcile(elements, layout.version, state.overviewStale ? null : state.overview),
    [elements, layout.version, state.overview, state.overviewStale],
  );
  const links = useMemo(() => sectorLinks(elements), [elements]);
  const selected = sectors.find((s) => s.id === state.selectedId) ?? null;
  const catalog = useMemo(
    () => ({ crops, productions: productions.map((p) => ({ id: p.id, cropId: p.cropId })) }),
    [crops, productions],
  );
  const issues = useMemo(
    () => (editing ? validateDraft(state.draft!, state.draftBase!.version, catalog) : []),
    [editing, state.draft, state.draftBase, catalog],
  );
  const changes = editing ? diffElements(state.draftBase!.elements, state.draft!) : null;
  const saving = state.save.kind === "saving" || state.save.kind === "checking";
  const select = (id: string | null) => dispatch({ type: "select", id });

  async function save() {
    if (!state.draft || !state.draftBase || issues.length || saving) return;
    dispatch({ type: "saving", key: stateKey });
    const result = await props.persist(state.draftBase.version, state.draft, () =>
      dispatch({ type: "checking", key: stateKey }),
    );
    if (result.kind === "saved") {
      dispatch({ type: "saved", key: stateKey, layout: result.layout });
      toast.success(demo ? "Exemplo atualizado (somente nesta tela)." : "Fazenda salva.");
      reload();
    } else if (result.kind === "conflict")
      dispatch({ type: "conflict", key: stateKey, remote: result.remote, message: result.message });
    else dispatch({ type: "save_failed", key: stateKey, message: result.message });
  }
  async function refreshRemote() {
    try {
      const remote = await props.remote();
      dispatch({ type: "conflict", key: stateKey, remote, message: "Versão mais recente carregada." });
    } catch {
      toast.error("Não foi possível consultar a versão mais recente.");
    }
  }
  function add(type: (typeof ELEMENT_TYPES)[number]) {
    if (!state.draft) return;
    dispatch({
      type: "add",
      element: {
        id: newId(),
        name: defaultName(type, state.draft),
        type,
        position: freeSpot(state.draft),
        productionIds: [],
        cropIds: [],
      },
    });
  }
  function leaveEdit() {
    if (isDirty(state)) {
      toast.warning("Salve ou descarte suas alterações antes de voltar a explorar.");
      return;
    }
    dispatch({ type: "discard" });
  }

  const overview = !state.overviewStale ? state.overview : null;
  const firstVisit = layout.state === "UNCONFIGURED" && !editing;
  const emptyVisit = layout.state === "EMPTY" && !editing;
  const overlay =
    firstVisit || emptyVisit ? (
      <div className="fz-welcome" role="region" aria-labelledby="fz-welcome-title">
        <h2 id="fz-welcome-title">{firstVisit ? "Vamos montar sua fazenda?" : "Sua fazenda está sem setores"}</h2>
        <p>
          {firstVisit
            ? "Coloque hortas, plantios, pomares, armazém e área de coleta do jeito que você organiza sua propriedade. Nada é criado sem você."
            : "Os registros de produção, lotes e pedidos continuam guardados. Organize os setores de novo quando quiser."}
        </p>
        {productions.length > 0 && (
          <p className="fz-welcome-note">
            Você tem {productions.length} {productions.length === 1 ? "produção registrada" : "produções registradas"} para
            vincular aos setores.
          </p>
        )}
        <div className="fz-welcome-actions">
          {editable ? (
            <button type="button" className="ag-btn ag-btn-dark" onClick={() => dispatch({ type: "edit" })}>
              <Hammer size={16} /> {firstVisit ? "Começar a montar" : "Organizar setores"}
            </button>
          ) : (
            <p className="fz-welcome-note">
              <Lock size={13} aria-hidden="true" /> Somente quem administra ou edita a propriedade pode montar a fazenda.
            </p>
          )}
          <button type="button" className="ag-btn fz-btn-soft" onClick={props.onDemo}>
            <Eye size={16} /> Ver fazenda de exemplo
          </button>
        </div>
      </div>
    ) : editing && state.draft!.length === 0 ? (
      <div className="fz-hint" aria-hidden="true">
        Escolha um tipo de setor na barra abaixo
      </div>
    ) : null;

  return (
    <div className={"fz-page" + (demo ? " is-demo" : "")}>
      <header className="fz-head">
        <div>
          <p className="eyebrow">{demo ? "MINHA FAZENDA · EXEMPLO" : "MINHA FAZENDA"}</p>
          <h1>{editing ? "Construir minha fazenda" : props.propertyName}</h1>
          <p className="fz-sub">
            {editing
              ? "Adicione setores, arraste para organizar e vincule suas produções."
              : [props.place, "Toque em um setor para ver produções, lotes e pedidos."].filter(Boolean).join(" — ")}
          </p>
        </div>
        <div className="fz-head-actions">
          {!editing && (
            <button type="button" className="ag-btn fz-btn-soft" onClick={props.onDemo}>
              {demo ? <Undo2 size={15} /> : <Eye size={15} />}
              {demo ? "Voltar à minha fazenda" : "Ver exemplo"}
            </button>
          )}
          <div className="fz-modes" role="group" aria-label="Modo da fazenda">
            <button type="button" aria-pressed={!editing} onClick={() => editing && leaveEdit()}>
              <Compass size={16} /> Explorar
            </button>
            {editable ? (
              <button type="button" aria-pressed={editing} onClick={() => !editing && dispatch({ type: "edit" })}>
                <Hammer size={16} /> Construir
              </button>
            ) : (
              <span className="fz-readonly">
                <Lock size={14} aria-hidden="true" /> Somente consulta
              </span>
            )}
          </div>
        </div>
      </header>

      {demo && (
        <p className="fz-banner fz-banner-demo" role="note">
          Fazenda de exemplo com <strong>dados simulados</strong>. Nada aqui é registro real e nada é salvo no servidor.
        </p>
      )}
      {state.overviewStale && state.status === "ready" && !demo && (
        <p className="fz-banner" role="status">
          {state.error
            ? "Não foi possível atualizar as informações operacionais. "
            : "Atualizando as informações operacionais dos setores… "}
          <button type="button" onClick={reload}>
            Atualizar agora
          </button>
        </p>
      )}

      <div className={"fz-world" + (editing ? " is-editing" : "") + (selected ? " has-selection" : "")}>
        <FarmScene
          sectors={sectors}
          mode={editing ? "edit" : "explore"}
          selectedId={state.selectedId}
          cropName={cropName}
          onSelect={select}
          onMove={editing ? (id, position) => dispatch({ type: "move", id, position }) : undefined}
          overlay={overlay}
          links={links}
          focusOnSelect={!editing}
        />
        <div className="fz-overlay">
          <div className="fz-ov-left">
            {sectors.length > 0 && <SectorMenu sectors={sectors} selectedId={state.selectedId} onSelect={select} />}
          </div>
          <aside className="fz-ov-right" aria-label="Detalhes do setor">
            {selected && editing ? (
              <SectorEditor
                key={selected.id}
                element={selected}
                operations={selected.operations}
                all={state.draft!}
                crops={crops}
                productions={productions}
                issues={issues}
                onChange={(patch) => dispatch({ type: "update", id: selected.id, patch })}
                onRemove={() => dispatch({ type: "remove", id: selected.id })}
                onBack={() => select(null)}
              />
            ) : selected ? (
              <SectorDetails
                key={selected.id}
                sector={selected}
                cropName={cropName}
                canEdit={editable}
                demo={demo}
                onBack={() => select(null)}
                onEdit={() => dispatch({ type: "edit" })}
              />
            ) : null}
          </aside>
          {editing && (
            <div className="fz-ov-bottom">
              <section className="fz-hotbar" aria-label="Adicionar setor">
                {ELEMENT_TYPES.map((t, i) => (
                  <button
                    key={t}
                    type="button"
                    className="fz-hotbar-item"
                    style={{ "--i": i } as React.CSSProperties}
                    disabled={state.draft!.length >= MAX_ELEMENTS}
                    onClick={() => add(t)}
                    title={TYPE_INFO[t].hint}
                  >
                    <SpriteThumb type={t} size={50} />
                    <span>{TYPE_INFO[t].plural}</span>
                  </button>
                ))}
                <span className="fz-hotbar-count">
                  {state.draft!.length}/{MAX_ELEMENTS}
                </span>
              </section>
              <SaveBar
                state={state}
                demo={demo}
                changes={changes ? diffCount(changes) : 0}
                issues={issues.filter((i) => !i.elementId).map((i) => i.message)}
                invalid={issues.length > 0}
                saving={saving}
                onSave={save}
                onDiscard={() => dispatch({ type: "discard" })}
                onRebase={(remote) => {
                  dispatch({ type: "rebase", key: stateKey, remote });
                  reload();
                }}
                onDiscardForRemote={() => {
                  dispatch({ type: "discard" });
                  reload();
                }}
                onRefreshRemote={refreshRemote}
              />
            </div>
          )}
        </div>
      </div>
      {overview && !demo && (
        <PropertyRecords overview={overview} elements={elements} onPage={props.onPage} busy={props.pageBusy} />
      )}
    </div>
  );
}

function SaveBar({
  state,
  demo,
  changes,
  issues,
  invalid,
  saving,
  onSave,
  onDiscard,
  onRebase,
  onDiscardForRemote,
  onRefreshRemote,
}: {
  state: FarmState;
  demo: boolean;
  changes: number;
  issues: string[];
  invalid: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onRebase: (remote: NonNullable<FarmState["layout"]>) => void;
  onDiscardForRemote: () => void;
  onRefreshRemote: () => void;
}) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const save = state.save;
  if (save.kind === "conflict") {
    const theirs =
      save.remote && state.draftBase ? diffElements(state.draftBase.elements, save.remote.elements) : null;
    return (
      <section className="fz-savebar fz-conflict" role="alert" aria-labelledby="fz-conflict-title">
        <div>
          <strong id="fz-conflict-title">{save.message}</strong>
          <p>
            Suas alterações continuam aqui e nada foi sobrescrito.
            {theirs &&
              (diffCount(theirs)
                ? ` Na outra sessão: ${[
                    theirs.added.length && `${theirs.added.length} adicionado(s)`,
                    theirs.removed.length && `${theirs.removed.length} removido(s)`,
                    theirs.changed.length && `${theirs.changed.length} alterado(s)`,
                  ]
                    .filter(Boolean)
                    .join(", ")}.`
                : " A outra sessão salvou sem mudar os setores.")}
          </p>
        </div>
        <div className="fz-savebar-actions">
          {save.remote ? (
            <Button size="sm" onClick={() => onRebase(save.remote!)}>
              Juntar com a versão nova
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={onRefreshRemote}>
              <RefreshCw size={14} /> Recarregar versão salva
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onDiscardForRemote}>
            Descartar as minhas
          </Button>
        </div>
      </section>
    );
  }
  return (
    <section className="fz-savebar" aria-live="polite">
      <div>
        <strong>
          {saving
            ? save.kind === "checking"
              ? "Confirmando se a fazenda foi salva…"
              : "Salvando…"
            : changes
              ? `${changes} ${changes === 1 ? "alteração não salva" : "alterações não salvas"}`
              : "Nenhuma alteração ainda"}
        </strong>
        {demo && <p>Exemplo: as alterações ficam só nesta tela.</p>}
        {save.kind === "error" && <p className="fz-error">{save.message}</p>}
        {issues.map((m) => (
          <p key={m} className="fz-error">
            {m}
          </p>
        ))}
        {invalid && !issues.length && <p className="fz-error">Revise os setores marcados antes de salvar.</p>}
      </div>
      <div className="fz-savebar-actions">
        {confirmDiscard ? (
          <>
            <span>Descartar {changes} alteração(ões)?</span>
            <Button size="sm" variant="destructive" onClick={onDiscard}>
              Descartar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDiscard(false)}>
              Voltar
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant="ghost"
              disabled={saving}
              onClick={() => (changes ? setConfirmDiscard(true) : onDiscard())}
            >
              <Undo2 size={14} /> {changes ? "Descartar" : "Sair da edição"}
            </Button>
            <Button size="sm" disabled={saving || invalid || !changes} onClick={onSave}>
              {saving ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}
              {demo ? "Aplicar no exemplo" : "Salvar fazenda"}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}

import { BookOpenIcon, FolderSearchIcon, RefreshCwIcon } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import * as Schema from "effect/Schema";
import { useQuery } from "@tanstack/react-query";
import type { NilusDomain, NilusTaskRecord } from "@t3tools/contracts";

import { SidebarInset, SidebarTrigger } from "../components/ui/sidebar";
import { Button } from "../components/ui/button";
import { useLocalStorage } from "../hooks/useLocalStorage";
import {
  nilusDocumentQueryOptions,
  nilusDomainEntriesQueryOptions,
  nilusStartupSnapshotQueryOptions,
  nilusTasksQueryOptions,
} from "../lib/nilusReactQuery";
import { isElectron } from "../env";

const NILUS_REPO_STORAGE_KEY = "t3code:nilus:repo-root:v1";
const NilusRepoRootSchema = Schema.NullOr(Schema.String);
const MEMORY_VIEWS: readonly NilusDomain[] = ["talk", "partners", "issues", "knowledge"];
type NilusView = "overview" | "tasks" | NilusDomain;

function NilusRouteView() {
  const [repoRoot, setRepoRoot] = useLocalStorage<string | null, string | null>(
    NILUS_REPO_STORAGE_KEY,
    null,
    NilusRepoRootSchema,
  );
  const [draftRepoRoot, setDraftRepoRoot] = useState(repoRoot ?? "");
  const [view, setView] = useState<NilusView>("overview");
  const [selectedDocumentPath, setSelectedDocumentPath] = useState<string | null>(null);

  const startupQuery = useQuery(
    nilusStartupSnapshotQueryOptions({
      repoRoot,
    }),
  );
  const tasksQuery = useQuery(
    nilusTasksQueryOptions({
      repoRoot,
      status: "open",
      enabled: repoRoot !== null && (view === "overview" || view === "tasks"),
      limit: view === "overview" ? 12 : 80,
    }),
  );

  const activeDomain = view !== "overview" && view !== "tasks" ? view : null;
  const domainEntriesQuery = useQuery(
    nilusDomainEntriesQueryOptions({
      repoRoot,
      domain: activeDomain,
      enabled: repoRoot !== null && activeDomain !== null,
      limit: 120,
    }),
  );
  const documentQuery = useQuery(
    nilusDocumentQueryOptions({
      repoRoot,
      path: selectedDocumentPath,
      enabled: repoRoot !== null && selectedDocumentPath !== null,
    }),
  );

  useEffect(() => {
    setDraftRepoRoot(repoRoot ?? "");
  }, [repoRoot]);

  useEffect(() => {
    setSelectedDocumentPath(null);
  }, [repoRoot, view]);

  useEffect(() => {
    if (activeDomain === null) return;
    const firstEntry = domainEntriesQuery.data?.entries.at(0)?.path ?? null;
    if (!selectedDocumentPath && firstEntry) {
      setSelectedDocumentPath(firstEntry);
    }
  }, [activeDomain, domainEntriesQuery.data?.entries, selectedDocumentPath]);

  const summaryCards = useMemo(() => {
    if (!startupQuery.data) return [];
    return [
      {
        label: "Open tasks",
        value: String(startupQuery.data.openTaskCount),
      },
      {
        label: "Talk log",
        value: String(startupQuery.data.domainCounts.talk),
      },
      {
        label: "Partners",
        value: String(startupQuery.data.domainCounts.partners),
      },
      {
        label: "Issues",
        value: String(startupQuery.data.domainCounts.issues),
      },
      {
        label: "Knowledge",
        value: String(startupQuery.data.domainCounts.knowledge),
      },
    ];
  }, [startupQuery.data]);

  const refreshAll = () => {
    void startupQuery.refetch();
    void tasksQuery.refetch();
    void domainEntriesQuery.refetch();
    void documentQuery.refetch();
  };

  const pickFolder = async () => {
    const folder = await window.nativeApi?.dialogs.pickFolder?.();
    if (folder) {
      setRepoRoot(folder);
    }
  };

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
        {!isElectron && (
          <header className="border-b border-border px-3 py-2 sm:px-5">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="size-7 shrink-0 md:hidden" />
              <span className="text-sm font-medium text-foreground">Nilus</span>
              <div className="ms-auto flex items-center gap-2">
                <Button size="xs" variant="outline" onClick={refreshAll} disabled={!repoRoot}>
                  <RefreshCwIcon className="size-3.5" />
                  Refresh
                </Button>
              </div>
            </div>
          </header>
        )}

        {isElectron && (
          <div className="drag-region flex h-[52px] shrink-0 items-center border-b border-border px-5">
            <span className="text-xs font-medium tracking-wide text-muted-foreground/70">
              Nilus prototype
            </span>
            <div className="ms-auto flex items-center gap-2">
              <Button size="xs" variant="outline" onClick={refreshAll} disabled={!repoRoot}>
                <RefreshCwIcon className="size-3.5" />
                Refresh
              </Button>
            </div>
          </div>
        )}

        <div className="min-h-0 flex flex-1 flex-col overflow-auto p-4 sm:p-5">
          <section className="rounded-2xl border border-border bg-card/70 p-4 shadow-xs">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Read-only Nilus browsing
                </p>
                <h1 className="mt-2 text-xl font-semibold tracking-tight">Browse Nilus repo memory</h1>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  This prototype reads tasks, talk-log notes, partner files, issues, and knowledge
                  docs from a selected Nilus repo without editing anything.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className="min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
                  placeholder="/path/to/Nilus"
                  value={draftRepoRoot}
                  onChange={(event) => setDraftRepoRoot(event.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    const trimmed = draftRepoRoot.trim();
                    setRepoRoot(trimmed.length > 0 ? trimmed : null);
                  }}
                >
                  <FolderSearchIcon className="size-4" />
                  Open repo
                </Button>
                <Button variant="ghost" onClick={() => void pickFolder()}>
                  Browse
                </Button>
              </div>
            </div>
            {repoRoot ? (
              <div className="mt-3 rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                Active repo: <span className="font-mono text-foreground">{repoRoot}</span>
              </div>
            ) : null}
            {startupQuery.error ? (
              <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/6 px-3 py-2 text-sm text-destructive">
                {startupQuery.error instanceof Error
                  ? startupQuery.error.message
                  : "Could not load Nilus repo."}
              </div>
            ) : null}
          </section>

          {repoRoot ? (
            <>
              <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {summaryCards.map((card) => (
                  <article
                    key={card.label}
                    className="rounded-2xl border border-border bg-card/60 px-4 py-3 shadow-xs"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {card.label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight">{card.value}</p>
                  </article>
                ))}
              </section>

              <section className="mt-4 flex flex-wrap gap-2">
                <NilusViewButton
                  active={view === "overview"}
                  label="Overview"
                  onClick={() => setView("overview")}
                />
                <NilusViewButton
                  active={view === "tasks"}
                  label="Tasks"
                  onClick={() => setView("tasks")}
                />
                {MEMORY_VIEWS.map((memoryView) => (
                  <NilusViewButton
                    key={memoryView}
                    active={view === memoryView}
                    label={memoryView}
                    onClick={() => setView(memoryView)}
                  />
                ))}
              </section>

              {view === "overview" ? (
                <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                  <section className="rounded-2xl border border-border bg-card/60 p-4 shadow-xs">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold">Open tasks</h2>
                        <p className="text-xs text-muted-foreground">
                          Current queue from <span className="font-mono">todo.txt</span>
                        </p>
                      </div>
                      <Button size="xs" variant="outline" onClick={() => setView("tasks")}>
                        View all
                      </Button>
                    </div>
                    <TaskList tasks={tasksQuery.data ?? []} />
                  </section>

                  <section className="rounded-2xl border border-border bg-card/60 p-4 shadow-xs">
                    <div className="flex items-center gap-2">
                      <BookOpenIcon className="size-4 text-muted-foreground" />
                      <div>
                        <h2 className="text-sm font-semibold">Memory domains</h2>
                        <p className="text-xs text-muted-foreground">
                          Jump into read-only Nilus repo areas
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {MEMORY_VIEWS.map((memoryView) => {
                        const count =
                          memoryView === "talk"
                            ? startupQuery.data?.domainCounts.talk
                            : memoryView === "partners"
                              ? startupQuery.data?.domainCounts.partners
                              : memoryView === "issues"
                                ? startupQuery.data?.domainCounts.issues
                                : startupQuery.data?.domainCounts.knowledge;
                        return (
                          <button
                            key={memoryView}
                            type="button"
                            className="rounded-2xl border border-border bg-background/70 p-4 text-left transition-colors hover:bg-accent/40"
                            onClick={() => setView(memoryView)}
                          >
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              {memoryView}
                            </p>
                            <p className="mt-2 text-lg font-semibold capitalize">{memoryView}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {typeof count === "number" ? `${count} documents` : "Loading..."}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                </div>
              ) : null}

              {view === "tasks" ? (
                <section className="mt-4 rounded-2xl border border-border bg-card/60 p-4 shadow-xs">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold">Tasks</h2>
                      <p className="text-xs text-muted-foreground">
                        Read-only task queue with Nilus metadata.
                      </p>
                    </div>
                  </div>
                  <TaskList tasks={tasksQuery.data ?? []} dense={false} />
                </section>
              ) : null}

              {activeDomain ? (
                <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.15fr)]">
                  <section className="min-h-0 rounded-2xl border border-border bg-card/60 p-4 shadow-xs">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold capitalize">{activeDomain}</h2>
                        <p className="text-xs text-muted-foreground">
                          Repo-relative documents for the selected Nilus domain.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      {domainEntriesQuery.data?.entries.map((entry) => {
                        const isSelected = entry.path === selectedDocumentPath;
                        return (
                          <button
                            key={entry.path}
                            type="button"
                            className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                              isSelected
                                ? "border-primary/60 bg-primary/6"
                                : "border-border bg-background/70 hover:bg-accent/30"
                            }`}
                            onClick={() => setSelectedDocumentPath(entry.path)}
                          >
                            <p className="truncate text-sm font-medium">{entry.title}</p>
                            <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                              {entry.path}
                            </p>
                            {entry.preview ? (
                              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                                {entry.preview}
                              </p>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="min-h-0 rounded-2xl border border-border bg-card/60 p-4 shadow-xs">
                    {documentQuery.data ? (
                      <>
                        <div className="border-b border-border pb-3">
                          <h2 className="text-sm font-semibold">{documentQuery.data.title}</h2>
                          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                            {documentQuery.data.path}
                          </p>
                        </div>
                        <pre className="mt-4 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-xl bg-background/80 p-4 text-xs leading-6 text-foreground/92">
                          {documentQuery.data.contents}
                        </pre>
                      </>
                    ) : (
                      <div className="flex h-full min-h-[16rem] items-center justify-center text-sm text-muted-foreground">
                        Select a document to preview it.
                      </div>
                    )}
                  </section>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </SidebarInset>
  );
}

function NilusViewButton(props: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`rounded-full border px-3 py-1.5 text-sm capitalize transition-colors ${
        props.active
          ? "border-primary/60 bg-primary/8 text-foreground"
          : "border-border bg-card/60 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
      }`}
      onClick={props.onClick}
    >
      {props.label}
    </button>
  );
}

function TaskList(props: { tasks: readonly NilusTaskRecord[]; dense?: boolean }) {
  if (props.tasks.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        No tasks to show.
      </div>
    );
  }

  return (
    <div className={props.dense === false ? "mt-4 space-y-3" : "mt-4 space-y-2"}>
      {props.tasks.map((task) => (
        <article
          key={`${task.number}-${task.description}`}
          className="rounded-xl border border-border bg-background/70 px-3 py-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium leading-6">{task.description}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <span>#{task.number}</span>
                {task.owner ? <span>@{task.owner}</span> : null}
                {task.project ? <span>+{task.project}</span> : null}
                {task.thread ? <span>thread:{task.thread}</span> : null}
                {task.after ? <span>after:{task.after}</span> : null}
                {task.recur ? <span>recur:{task.recur}</span> : null}
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export const Route = createFileRoute("/nilus")({
  component: NilusRouteView,
});

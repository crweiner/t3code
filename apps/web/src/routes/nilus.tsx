import {
  BookOpenIcon,
  CheckCircle2Icon,
  CloudUploadIcon,
  FolderSearchIcon,
  GitCommitHorizontalIcon,
  RefreshCwIcon,
} from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import * as Schema from "effect/Schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  PROVIDER_DISPLAY_NAMES,
  type GitStatusResult,
  type NilusCommitSafety,
  type NilusDomain,
  type NilusTaskRecord,
  type ServerProvider,
} from "@t3tools/contracts";

import { SidebarInset, SidebarTrigger } from "../components/ui/sidebar";
import { Button } from "../components/ui/button";
import { toastManager } from "../components/ui/toast";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { gitRunStackedActionMutationOptions } from "../lib/gitReactQuery";
import { refreshGitStatus, useGitStatus } from "../lib/gitStatusState";
import {
  nilusCreateTalkNoteMutationOptions,
  nilusCreateTaskMutationOptions,
  nilusCompleteTaskMutationOptions,
  nilusDocumentQueryOptions,
  nilusDomainEntriesQueryOptions,
  nilusStartupSnapshotQueryOptions,
  nilusTaskDraftPreviewQueryOptions,
  nilusTaskCompletionPreviewQueryOptions,
  nilusTaskContextQueryOptions,
  nilusTalkNotePreviewQueryOptions,
  nilusTasksQueryOptions,
} from "../lib/nilusReactQuery";
import { randomUUID } from "../lib/utils";
import { useServerConfig } from "../rpc/serverState";
import { isElectron } from "../env";
import { readNativeApi } from "../nativeApi";

const NILUS_REPO_STORAGE_KEY = "t3code:nilus:repo-root:v1";
const NilusRepoRootSchema = Schema.NullOr(Schema.String);
const MEMORY_VIEWS: readonly NilusDomain[] = ["talk", "partners", "issues", "knowledge"];
type NilusView = "overview" | "tasks" | NilusDomain;

function NilusRouteView() {
  const queryClient = useQueryClient();
  const serverConfig = useServerConfig();
  const [repoRoot, setRepoRoot] = useLocalStorage<string | null, string | null>(
    NILUS_REPO_STORAGE_KEY,
    null,
    NilusRepoRootSchema,
  );
  const [draftRepoRoot, setDraftRepoRoot] = useState(repoRoot ?? "");
  const [view, setView] = useState<NilusView>("overview");
  const [selectedTaskNumber, setSelectedTaskNumber] = useState<number | null>(null);
  const [selectedDocumentPath, setSelectedDocumentPath] = useState<string | null>(null);
  const [taskDescription, setTaskDescription] = useState("");
  const [taskPriority, setTaskPriority] = useState("C");
  const [taskProject, setTaskProject] = useState("NilusBrowser");
  const [taskOwner, setTaskOwner] = useState("nilus");
  const [taskThread, setTaskThread] = useState("nilus-browser");
  const [taskRecur, setTaskRecur] = useState("");
  const [taskAfter, setTaskAfter] = useState("");
  const [taskWaiting, setTaskWaiting] = useState("");
  const [taskAdvancedOpen, setTaskAdvancedOpen] = useState(false);
  const [talkDraftId, setTalkDraftId] = useState(() => new Date().toISOString());
  const [talkTopic, setTalkTopic] = useState("");
  const [talkBody, setTalkBody] = useState("");
  const [talkProject, setTalkProject] = useState("NilusBrowser");
  const [talkThread, setTalkThread] = useState("nilus-browser");
  const [talkRefsInput, setTalkRefsInput] = useState("");

  const deferredTalkTopic = useDeferredValue(talkTopic);
  const deferredTalkBody = useDeferredValue(talkBody);
  const deferredTalkProject = useDeferredValue(talkProject);
  const deferredTalkThread = useDeferredValue(talkThread);
  const deferredTalkRefsInput = useDeferredValue(talkRefsInput);
  const deferredTaskDescription = useDeferredValue(taskDescription);
  const deferredTaskPriority = useDeferredValue(taskPriority);
  const deferredTaskProject = useDeferredValue(taskProject);
  const deferredTaskOwner = useDeferredValue(taskOwner);
  const deferredTaskThread = useDeferredValue(taskThread);
  const deferredTaskRecur = useDeferredValue(taskRecur);
  const deferredTaskAfter = useDeferredValue(taskAfter);
  const deferredTaskWaiting = useDeferredValue(taskWaiting);
  const gitStatus = useGitStatus(repoRoot);

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
      ...(view === "overview" ? { limit: 12 } : {}),
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
  const taskContextQuery = useQuery(
    nilusTaskContextQueryOptions({
      repoRoot,
      taskNumber: selectedTaskNumber,
      enabled: repoRoot !== null && selectedTaskNumber !== null && view === "tasks",
    }),
  );
  const taskCompletionPreviewQuery = useQuery(
    nilusTaskCompletionPreviewQueryOptions({
      repoRoot,
      taskNumber: selectedTaskNumber,
      enabled: repoRoot !== null && selectedTaskNumber !== null && view === "tasks",
    }),
  );
  const completeTaskMutation = useMutation(
    nilusCompleteTaskMutationOptions({
      repoRoot,
      queryClient,
    }),
  );
  const taskDraft = useMemo(() => {
    if (!repoRoot) {
      return null;
    }

    const description = deferredTaskDescription.trim();
    if (description.length === 0) {
      return null;
    }

    return {
      repoRoot,
      draftKey: JSON.stringify([
        description,
        deferredTaskPriority.trim().toUpperCase(),
        deferredTaskProject.trim(),
        deferredTaskOwner.trim(),
        deferredTaskThread.trim(),
        deferredTaskRecur.trim(),
        deferredTaskAfter.trim(),
        deferredTaskWaiting.trim(),
      ]),
      description,
      ...(deferredTaskPriority.trim().length > 0
        ? { priority: deferredTaskPriority.trim().toUpperCase() }
        : {}),
      ...(deferredTaskProject.trim().length > 0 ? { project: deferredTaskProject.trim() } : {}),
      ...(deferredTaskOwner.trim().length > 0 ? { owner: deferredTaskOwner.trim() } : {}),
      ...(deferredTaskThread.trim().length > 0 ? { thread: deferredTaskThread.trim() } : {}),
      ...(deferredTaskRecur.trim().length > 0 ? { recur: deferredTaskRecur.trim() } : {}),
      ...(deferredTaskAfter.trim().length > 0 ? { after: deferredTaskAfter.trim() } : {}),
      ...(deferredTaskWaiting.trim().length > 0 ? { waiting: deferredTaskWaiting.trim() } : {}),
    };
  }, [
    deferredTaskAfter,
    deferredTaskDescription,
    deferredTaskOwner,
    deferredTaskPriority,
    deferredTaskProject,
    deferredTaskRecur,
    deferredTaskThread,
    deferredTaskWaiting,
    repoRoot,
  ]);
  const taskDraftPreviewQuery = useQuery(
    nilusTaskDraftPreviewQueryOptions({
      draft: taskDraft,
      enabled: repoRoot !== null && taskDraft !== null && view === "tasks",
    }),
  );
  const createTaskMutation = useMutation(
    nilusCreateTaskMutationOptions({
      repoRoot,
      queryClient,
    }),
  );
  const talkNoteDraft = useMemo(() => {
    if (!repoRoot) {
      return null;
    }

    const topic = deferredTalkTopic.trim();
    const body = deferredTalkBody.trim();
    if (topic.length === 0 || body.length === 0) {
      return null;
    }

    const refs = parseRefsInput(deferredTalkRefsInput);

    return {
      repoRoot,
      draftId: talkDraftId,
      draftKey: JSON.stringify([
        talkDraftId,
        topic,
        body,
        deferredTalkProject.trim(),
        deferredTalkThread.trim(),
        refs,
      ]),
      topic,
      body,
      ...(deferredTalkProject.trim().length > 0 ? { project: deferredTalkProject.trim() } : {}),
      ...(deferredTalkThread.trim().length > 0 ? { thread: deferredTalkThread.trim() } : {}),
      ...(refs.length > 0 ? { refs } : {}),
    };
  }, [
    deferredTalkBody,
    deferredTalkProject,
    deferredTalkRefsInput,
    deferredTalkThread,
    deferredTalkTopic,
    repoRoot,
    talkDraftId,
  ]);
  const talkNotePreviewQuery = useQuery(
    nilusTalkNotePreviewQueryOptions({
      draft: talkNoteDraft,
      enabled: repoRoot !== null && talkNoteDraft !== null,
    }),
  );
  const createTalkNoteMutation = useMutation(
    nilusCreateTalkNoteMutationOptions({
      repoRoot,
      queryClient,
    }),
  );
  const saveRepoMutation = useMutation(
    gitRunStackedActionMutationOptions({
      cwd: repoRoot,
      queryClient,
    }),
  );

  useEffect(() => {
    setDraftRepoRoot(repoRoot ?? "");
  }, [repoRoot]);

  useEffect(() => {
    const openTasks = tasksQuery.data ?? [];
    if (openTasks.length === 0) {
      setSelectedTaskNumber(null);
      return;
    }

    if (selectedTaskNumber === null) {
      setSelectedTaskNumber(openTasks[0]?.number ?? null);
      return;
    }

    if (!openTasks.some((task) => task.number === selectedTaskNumber)) {
      setSelectedTaskNumber(openTasks[0]?.number ?? null);
    }
  }, [selectedTaskNumber, tasksQuery.data]);

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

  useEffect(() => {
    if (repoRoot === null) {
      return;
    }

    void refreshGitStatus(repoRoot);
  }, [repoRoot]);

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
    void taskContextQuery.refetch();
    void taskCompletionPreviewQuery.refetch();
    void talkNotePreviewQuery.refetch();
    void domainEntriesQuery.refetch();
    void documentQuery.refetch();
    void refreshGitStatus(repoRoot);
  };

  const selectedTask =
    (tasksQuery.data ?? []).find((task) => task.number === selectedTaskNumber) ?? null;
  const saveState = useMemo(
    () =>
      resolveNilusSaveState({
        status: gitStatus.data,
        error: gitStatus.error?.message ?? null,
        isPending: gitStatus.isPending,
      }),
    [gitStatus.data, gitStatus.error, gitStatus.isPending],
  );

  const pickFolder = async () => {
    const folder = await window.nativeApi?.dialogs.pickFolder?.();
    if (folder) {
      setRepoRoot(folder);
    }
  };

  const handleCompleteTask = async () => {
    if (!selectedTask || !repoRoot) {
      return;
    }

    const api = readNativeApi();
    if (api) {
      const confirmed = await api.dialogs.confirm(
        [
          `Complete task #${selectedTask.number}?`,
          "This updates todo.txt and done.txt in the selected Nilus repo.",
        ].join("\n"),
      );
      if (!confirmed) {
        return;
      }
    }

    try {
      const result = await completeTaskMutation.mutateAsync({
        taskNumber: selectedTask.number,
      });
      await refreshGitStatus(repoRoot);
      toastManager.add({
        type: "success",
        title: `Completed task #${selectedTask.number}`,
        description: result.nextTaskLine
          ? "The next recurring task instance was also created."
          : "todo.txt and done.txt were updated.",
      });
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Failed to complete task",
        description: error instanceof Error ? error.message : "Unknown Nilus task error.",
      });
    }
  };

  const handleCreateTalkNote = async () => {
    if (!repoRoot || !talkNoteDraft) {
      return;
    }

    const api = readNativeApi();
    if (api) {
      const confirmed = await api.dialogs.confirm(
        [
          `Create talk-log note "${talkNoteDraft.topic}"?`,
          "This writes a new markdown note into talk-log/ in the selected Nilus repo.",
        ].join("\n"),
      );
      if (!confirmed) {
        return;
      }
    }

    try {
      const { draftKey: _draftKey, ...payload } = talkNoteDraft;
      const result = await createTalkNoteMutation.mutateAsync(payload);
      await refreshGitStatus(repoRoot);
      toastManager.add({
        type: "success",
        title: "Created talk-log note",
        description: result.path,
      });
      setView("talk");
      setSelectedDocumentPath(result.path);
      setTalkDraftId(new Date().toISOString());
      setTalkTopic("");
      setTalkBody("");
      setTalkRefsInput("");
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Failed to create talk-log note",
        description: error instanceof Error ? error.message : "Unknown Nilus talk note error.",
      });
    }
  };

  const handleCreateTask = async () => {
    if (!repoRoot || !taskDraft) {
      return;
    }

    const api = readNativeApi();
    if (api) {
      const confirmed = await api.dialogs.confirm(
        [
          `Create Nilus task "${taskDraft.description}"?`,
          "This appends a new open task to todo.txt in the selected Nilus repo.",
        ].join("\n"),
      );
      if (!confirmed) {
        return;
      }
    }

    try {
      const { draftKey: _draftKey, ...payload } = taskDraft;
      const result = await createTaskMutation.mutateAsync(payload);
      await refreshGitStatus(repoRoot);
      toastManager.add({
        type: "success",
        title: `Created task #${result.taskNumber}`,
        description: result.line,
      });
      setSelectedTaskNumber(result.taskNumber);
      setTaskDescription("");
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Failed to create task",
        description: error instanceof Error ? error.message : "Unknown Nilus task error.",
      });
    }
  };

  const handleSaveRepo = async () => {
    if (!repoRoot || saveState.action === null) {
      return;
    }

    const api = readNativeApi();
    if (api) {
      const confirmed = await api.dialogs.confirm(
        [
          saveState.action === "commit_push"
            ? `Save ${saveState.unsavedFileCount} changed file${saveState.unsavedFileCount === 1 ? "" : "s"} to trunk?`
            : `Push ${saveState.unpublishedCommitCount} local commit${saveState.unpublishedCommitCount === 1 ? "" : "s"} to trunk?`,
          "This Nilus browser flow only publishes directly to trunk. No feature branch will be created.",
        ].join("\n"),
      );
      if (!confirmed) {
        return;
      }
    }

    try {
      const result = await saveRepoMutation.mutateAsync({
        actionId: randomUUID(),
        action: saveState.action,
        ...(saveState.action === "commit_push" ? { commitMessage: resolveNilusSaveCommitMessage(gitStatus.data) } : {}),
      });
      await refreshGitStatus(repoRoot);
      toastManager.add({
        type: "success",
        title: saveState.action === "commit_push" ? "Saved to trunk" : "Pushed to trunk",
        description: result.toast.description ?? result.toast.title,
      });
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unknown Nilus save error.",
      });
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
                <Button
                  size="xs"
                  onClick={() => void handleSaveRepo()}
                  disabled={!repoRoot || saveRepoMutation.isPending || !saveState.canSave}
                >
                  <CloudUploadIcon className="size-3.5" />
                  {saveRepoMutation.isPending ? "Saving..." : "Save"}
                </Button>
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
              <Button
                size="xs"
                onClick={() => void handleSaveRepo()}
                disabled={!repoRoot || saveRepoMutation.isPending || !saveState.canSave}
              >
                <CloudUploadIcon className="size-3.5" />
                {saveRepoMutation.isPending ? "Saving..." : "Save"}
              </Button>
              <Button size="xs" variant="outline" onClick={refreshAll} disabled={!repoRoot}>
                <RefreshCwIcon className="size-3.5" />
                Refresh
              </Button>
            </div>
          </div>
        )}

        <div className="min-h-0 flex flex-1 flex-col overflow-auto p-4 sm:p-5">
          {repoRoot ? <NilusSaveBanner saveState={saveState} isSaving={saveRepoMutation.isPending} /> : null}

          <section className="rounded-2xl border border-border bg-card/70 p-4 shadow-xs">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Nilus workflow prototype
                </p>
                <h1 className="mt-2 text-xl font-semibold tracking-tight">Browse Nilus repo memory</h1>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  This prototype now combines read-only Nilus memory browsing with task context and
                  completion flows for the selected repo.
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
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          setView("tasks");
                          setSelectedTaskNumber((tasksQuery.data ?? [])[0]?.number ?? null);
                        }}
                      >
                        View all
                      </Button>
                    </div>
                    <TaskList
                      tasks={tasksQuery.data ?? []}
                      onSelect={(task) => {
                        setSelectedTaskNumber(task.number);
                        setView("tasks");
                      }}
                    />
                  </section>

                  <div className="space-y-4">
                    <BackendSyncPanel
                      serverConfig={serverConfig}
                      gitStatus={gitStatus}
                      onRefreshStatus={() => void refreshGitStatus(repoRoot)}
                    />

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
                </div>
              ) : null}

              {view === "tasks" ? (
                <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(19rem,0.78fr)_minmax(0,1.22fr)]">
                  <section className="rounded-2xl border border-border bg-card/60 p-4 shadow-xs">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold">Tasks</h2>
                        <p className="text-xs text-muted-foreground">
                          Showing all {startupQuery.data?.openTaskCount ?? tasksQuery.data?.length ?? 0} open tasks from <span className="font-mono">todo.txt</span>.
                        </p>
                      </div>
                    </div>
                    <TaskList
                      tasks={tasksQuery.data ?? []}
                      dense={false}
                      selectedTaskNumber={selectedTaskNumber}
                      onSelect={(task) => setSelectedTaskNumber(task.number)}
                    />
                  </section>

                  <div className="space-y-4">
                    <TaskComposer
                      description={taskDescription}
                      priority={taskPriority}
                      project={taskProject}
                      owner={taskOwner}
                      thread={taskThread}
                      recur={taskRecur}
                      after={taskAfter}
                      waiting={taskWaiting}
                      advancedOpen={taskAdvancedOpen}
                      preview={taskDraftPreviewQuery.data ?? null}
                      previewError={
                        taskDraftPreviewQuery.error instanceof Error
                          ? taskDraftPreviewQuery.error.message
                          : null
                      }
                      isLoadingPreview={
                        taskDraftPreviewQuery.isPending || taskDraftPreviewQuery.isFetching
                      }
                      isCreating={createTaskMutation.isPending}
                      onDescriptionChange={setTaskDescription}
                      onPriorityChange={setTaskPriority}
                      onProjectChange={setTaskProject}
                      onOwnerChange={setTaskOwner}
                      onThreadChange={setTaskThread}
                      onRecurChange={setTaskRecur}
                      onAfterChange={setTaskAfter}
                      onWaitingChange={setTaskWaiting}
                      onAdvancedOpenChange={setTaskAdvancedOpen}
                      onCreate={() => void handleCreateTask()}
                    />

                    <section className="rounded-2xl border border-border bg-card/60 p-4 shadow-xs">
                      {selectedTask ? (
                        <TaskWorkflowPanel
                          task={selectedTask}
                          context={taskContextQuery.data ?? null}
                          preview={taskCompletionPreviewQuery.data ?? null}
                          contextError={
                            taskContextQuery.error instanceof Error
                              ? taskContextQuery.error.message
                              : null
                          }
                          previewError={
                            taskCompletionPreviewQuery.error instanceof Error
                              ? taskCompletionPreviewQuery.error.message
                              : null
                          }
                          isLoadingContext={taskContextQuery.isPending || taskContextQuery.isFetching}
                          isLoadingPreview={
                            taskCompletionPreviewQuery.isPending ||
                            taskCompletionPreviewQuery.isFetching
                          }
                          isCompleting={completeTaskMutation.isPending}
                          onComplete={() => void handleCompleteTask()}
                          onOpenDocument={(documentPath) => {
                            const domain = taskContextQuery.data?.relatedDocuments.find(
                              (entry) => entry.path === documentPath,
                            )?.domain;
                            if (domain) {
                              setView(domain);
                              setSelectedDocumentPath(documentPath);
                            }
                          }}
                        />
                      ) : (
                        <div className="flex min-h-[18rem] items-center justify-center text-sm text-muted-foreground">
                          Select a task to inspect its continuity context.
                        </div>
                      )}
                    </section>
                  </div>
                </div>
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

                  <div className="space-y-4">
                    {activeDomain === "talk" ? (
                      <TalkNoteComposer
                        topic={talkTopic}
                        body={talkBody}
                        project={talkProject}
                        thread={talkThread}
                        refsInput={talkRefsInput}
                        preview={talkNotePreviewQuery.data ?? null}
                        previewError={
                          talkNotePreviewQuery.error instanceof Error
                            ? talkNotePreviewQuery.error.message
                            : null
                        }
                        isLoadingPreview={
                          talkNotePreviewQuery.isPending || talkNotePreviewQuery.isFetching
                        }
                        isCreating={createTalkNoteMutation.isPending}
                        onTopicChange={setTalkTopic}
                        onBodyChange={setTalkBody}
                        onProjectChange={setTalkProject}
                        onThreadChange={setTalkThread}
                        onRefsChange={setTalkRefsInput}
                        onCreate={() => void handleCreateTalkNote()}
                      />
                    ) : null}

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
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </SidebarInset>
  );
}

function BackendSyncPanel(props: {
  serverConfig: ReturnType<typeof useServerConfig>;
  gitStatus: ReturnType<typeof useGitStatus>;
  onRefreshStatus: () => void;
}) {
  const providers = props.serverConfig?.providers ?? [];
  const selectedModel = props.serverConfig?.settings.textGenerationModelSelection ?? null;
  const syncSummary = resolveNilusSyncSummary({
    status: props.gitStatus.data,
    error: props.gitStatus.error?.message ?? null,
    isPending: props.gitStatus.isPending,
  });

  return (
    <section className="rounded-2xl border border-border bg-card/60 p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Backend and sync</h2>
          <p className="text-xs text-muted-foreground">
            Shows which assistant backend Nilus will prefer and how ready this repo is for
            save, sync, and publish actions.
          </p>
        </div>
        <Button size="xs" variant="outline" onClick={props.onRefreshStatus}>
          <RefreshCwIcon className="size-3.5" />
          Refresh sync
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ContextStat
          label="Nilus backend"
          value={
            selectedModel
              ? `${PROVIDER_DISPLAY_NAMES[selectedModel.provider]} · ${selectedModel.model}`
              : "No backend selected"
          }
        />
        <ContextStat label="Repo sync" value={syncSummary.title} />
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-background/70 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Nilus recommendation
        </p>
        <p className="mt-2 text-sm font-medium">{syncSummary.detail}</p>
        <p className="mt-1 text-xs text-muted-foreground">{syncSummary.nextAction}</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {providers.length > 0 ? (
          providers.map((provider) => (
            <ProviderStatusCard
              key={provider.provider}
              provider={provider}
              isSelected={provider.provider === selectedModel?.provider}
              isFallback={provider.provider !== selectedModel?.provider && provider.status === "ready"}
            />
          ))
        ) : (
          <EmptyContext label="Provider readiness has not loaded yet." />
        )}
      </div>

      {props.gitStatus.error ? (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/6 px-3 py-2 text-sm text-destructive">
          {syncSummary.detail}
        </div>
      ) : props.gitStatus.data ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ContextStat
            label="Branch"
            value={props.gitStatus.data.branch ?? "Detached HEAD"}
          />
          <ContextStat
            label="Working tree"
            value={
              props.gitStatus.data.hasWorkingTreeChanges
                ? `${props.gitStatus.data.workingTree.files.length} changed files`
                : "Clean"
            }
          />
          <ContextStat
            label="Remote"
            value={
              props.gitStatus.data.hasUpstream
                ? `${props.gitStatus.data.aheadCount} ahead / ${props.gitStatus.data.behindCount} behind`
                : props.gitStatus.data.hasOriginRemote
                  ? "No upstream tracked"
                  : "No origin remote"
            }
          />
          <ContextStat
            label="Pull request"
            value={
              props.gitStatus.data.pr
                ? `#${props.gitStatus.data.pr.number} ${props.gitStatus.data.pr.state}`
                : "No open PR"
            }
          />
        </div>
      ) : (
        <div className="mt-4 text-sm text-muted-foreground">
          {props.gitStatus.isPending ? "Loading git status..." : "Git status is not available yet."}
        </div>
      )}
    </section>
  );
}

function NilusSaveBanner(props: {
  saveState: ReturnType<typeof resolveNilusSaveState>;
  isSaving: boolean;
}) {
  const toneClass =
    props.saveState.tone === "error"
      ? "border-destructive/40 bg-destructive/8 text-destructive"
      : props.saveState.tone === "warning"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
        : props.saveState.tone === "success"
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
          : "border-border bg-card/60 text-foreground";

  return (
    <section className={`mb-4 rounded-2xl border px-4 py-3 shadow-xs ${toneClass}`}>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold">{props.saveState.bannerTitle}</p>
          <p className="mt-1 text-xs opacity-90">{props.saveState.bannerDetail}</p>
        </div>
        <div className="text-xs font-medium opacity-90">
          {props.isSaving ? "Saving to trunk now..." : props.saveState.statusLabel}
        </div>
      </div>
    </section>
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

function TaskList(props: {
  tasks: readonly NilusTaskRecord[];
  dense?: boolean;
  selectedTaskNumber?: number | null;
  onSelect?: (task: NilusTaskRecord) => void;
}) {
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
        <button
          key={`${task.number}-${task.description}`}
          type="button"
          className={`block w-full rounded-xl border px-3 py-3 text-left ${
            props.selectedTaskNumber === task.number
              ? "border-primary/60 bg-primary/6"
              : "border-border bg-background/70 hover:bg-accent/30"
          }`}
          onClick={() => props.onSelect?.(task)}
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
        </button>
      ))}
    </div>
  );
}

function TaskComposer(props: {
  description: string;
  priority: string;
  project: string;
  owner: string;
  thread: string;
  recur: string;
  after: string;
  waiting: string;
  advancedOpen: boolean;
  preview: {
    line: string;
    affectedFiles: readonly string[];
  } | null;
  previewError: string | null;
  isLoadingPreview: boolean;
  isCreating: boolean;
  onDescriptionChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
  onProjectChange: (value: string) => void;
  onOwnerChange: (value: string) => void;
  onThreadChange: (value: string) => void;
  onRecurChange: (value: string) => void;
  onAfterChange: (value: string) => void;
  onWaitingChange: (value: string) => void;
  onAdvancedOpenChange: (value: boolean) => void;
  onCreate: () => void;
}) {
  const hasDraft = props.description.trim().length > 0;

  return (
    <section className="rounded-2xl border border-border bg-card/60 p-4 shadow-xs">
      <div>
        <h2 className="text-sm font-semibold">New task</h2>
        <p className="text-xs text-muted-foreground">
          Draft a new open task and preview the exact <span className="font-mono">todo.txt</span>{" "}
          line before it is appended.
        </p>
      </div>

      <label className="mt-4 block">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Description
        </span>
        <textarea
          className="mt-2 min-h-24 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm leading-6 text-foreground outline-none focus:border-ring"
          placeholder="Describe the next Nilus task."
          value={props.description}
          onChange={(event) => props.onDescriptionChange(event.target.value)}
        />
      </label>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Priority
          </span>
          <input
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            maxLength={1}
            placeholder="C"
            value={props.priority}
            onChange={(event) => props.onPriorityChange(event.target.value.toUpperCase())}
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Project
          </span>
          <input
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            placeholder="NilusBrowser"
            value={props.project}
            onChange={(event) => props.onProjectChange(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Owner
          </span>
          <input
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            placeholder="nilus"
            value={props.owner}
            onChange={(event) => props.onOwnerChange(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Thread
          </span>
          <input
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            placeholder="nilus-browser"
            value={props.thread}
            onChange={(event) => props.onThreadChange(event.target.value)}
          />
        </label>
      </div>

      <details
        className="mt-3 rounded-2xl border border-border bg-background/50 px-4 py-3"
        open={props.advancedOpen}
        onToggle={(event) => props.onAdvancedOpenChange((event.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          Advanced
        </summary>
        <p className="mt-2 text-xs text-muted-foreground">
          Use these fields when you need recurrence, gating, or waiting-state metadata.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Recur
            </span>
            <input
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
              placeholder="daily"
              value={props.recur}
              onChange={(event) => props.onRecurChange(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              After
            </span>
            <input
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
              placeholder="2026-04-10T13:30Z"
              value={props.after}
              onChange={(event) => props.onAfterChange(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Waiting
            </span>
            <input
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
              placeholder="person"
              value={props.waiting}
              onChange={(event) => props.onWaitingChange(event.target.value)}
            />
          </label>
        </div>
      </details>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {hasDraft
            ? "Preview updates as you type. Create appends a new open task to todo.txt and keeps your current task context for the next entry."
            : "Enter a description to prepare a new task preview."}
        </p>
        <Button
          size="sm"
          onClick={props.onCreate}
          disabled={props.isCreating || props.preview === null}
        >
          {props.isCreating ? "Creating..." : "Create task"}
        </Button>
      </div>

      {props.previewError ? (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/6 px-3 py-2 text-sm text-destructive">
          {props.previewError}
        </div>
      ) : props.isLoadingPreview && props.preview === null ? (
        <div className="mt-4 text-sm text-muted-foreground">Preparing task preview...</div>
      ) : props.preview ? (
        <div className="mt-4 space-y-3">
          <PreviewBlock label="todo.txt append" contents={props.preview.line} />
          <div className="rounded-xl border border-border bg-background/70 px-3 py-3 text-xs text-muted-foreground">
            <p>Affected files: {props.preview.affectedFiles.join(", ")}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TaskWorkflowPanel(props: {
  task: NilusTaskRecord;
  context: {
    continuityThread: string | null;
    projects: readonly string[];
    relatedOpenTasks: readonly NilusTaskRecord[];
    recentDoneTasks: readonly NilusTaskRecord[];
    relatedDocuments: readonly { path: string; title: string; domain: NilusDomain }[];
    recentCommits: readonly { hash: string; subject: string }[];
  } | null;
  preview: {
    completedLine: string;
    nextTaskLine: string | null;
    affectedFiles: readonly string[];
  } | null;
  contextError: string | null;
  previewError: string | null;
  isLoadingContext: boolean;
  isLoadingPreview: boolean;
  isCompleting: boolean;
  onComplete: () => void;
  onOpenDocument: (documentPath: string) => void;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-background/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Task #{props.task.number}
            </p>
            <h2 className="mt-2 text-lg font-semibold leading-7">{props.task.description}</h2>
          </div>
          <Button size="sm" onClick={props.onComplete} disabled={props.isCompleting}>
            <CheckCircle2Icon className="size-4" />
            {props.isCompleting ? "Completing..." : "Complete task"}
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          <MetadataPill label={`created:${props.task.createdAt}`} />
          {props.task.priority ? <MetadataPill label={`priority:${props.task.priority}`} /> : null}
          {props.task.owner ? <MetadataPill label={`@${props.task.owner}`} /> : null}
          {props.task.project ? <MetadataPill label={`+${props.task.project}`} /> : null}
          {props.task.thread ? <MetadataPill label={`thread:${props.task.thread}`} /> : null}
          {props.task.after ? <MetadataPill label={`after:${props.task.after}`} /> : null}
          {props.task.recur ? <MetadataPill label={`recur:${props.task.recur}`} /> : null}
          {props.task.waiting ? <MetadataPill label={`waiting:${props.task.waiting}`} /> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-background/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Task context</h3>
            <p className="text-xs text-muted-foreground">
              Mirrors the continuity model behind <span className="font-mono">nilus task context</span>.
            </p>
          </div>
        </div>

        {props.contextError ? (
          <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/6 px-3 py-2 text-sm text-destructive">
            {props.contextError}
          </div>
        ) : props.isLoadingContext && props.context === null ? (
          <div className="mt-4 text-sm text-muted-foreground">Loading task context...</div>
        ) : (
          <>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <ContextStat
                label="Continuity thread"
                value={props.context?.continuityThread ?? "none"}
              />
              <ContextStat
                label="Projects"
                value={props.context && props.context.projects.length > 0
                  ? props.context.projects.join(", ")
                  : "none"}
              />
              <ContextStat
                label="Related open tasks"
                value={String(props.context?.relatedOpenTasks.length ?? 0)}
              />
              <ContextStat
                label="Recent done tasks"
                value={String(props.context?.recentDoneTasks.length ?? 0)}
              />
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <ContextListCard title="Related open tasks">
                {(props.context?.relatedOpenTasks.length ?? 0) > 0 ? (
                  props.context?.relatedOpenTasks.map((task) => (
                    <div key={`open-${task.number}`} className="rounded-xl border border-border bg-card/50 px-3 py-2">
                      <p className="text-sm font-medium">{task.description}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        #{task.number}
                        {task.thread ? ` · thread:${task.thread}` : ""}
                        {task.project ? ` · +${task.project}` : ""}
                      </p>
                    </div>
                  ))
                ) : (
                  <EmptyContext label="No related open tasks found." />
                )}
              </ContextListCard>

              <ContextListCard title="Recent completed tasks">
                {(props.context?.recentDoneTasks.length ?? 0) > 0 ? (
                  props.context?.recentDoneTasks.map((task) => (
                    <div key={`done-${task.number}-${task.raw}`} className="rounded-xl border border-border bg-card/50 px-3 py-2">
                      <p className="text-sm font-medium">{task.description}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {task.completedAt ? `completed:${task.completedAt}` : "completed"}
                        {task.recur ? ` · recur:${task.recur}` : ""}
                      </p>
                    </div>
                  ))
                ) : (
                  <EmptyContext label="No recent completed tasks found." />
                )}
              </ContextListCard>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <ContextListCard title="Related documents">
                {(props.context?.relatedDocuments.length ?? 0) > 0 ? (
                  props.context?.relatedDocuments.map((document) => (
                    <button
                      key={document.path}
                      type="button"
                      className="block w-full rounded-xl border border-border bg-card/50 px-3 py-2 text-left hover:bg-accent/30"
                      onClick={() => props.onOpenDocument(document.path)}
                    >
                      <p className="text-sm font-medium">{document.title}</p>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                        {document.path}
                      </p>
                    </button>
                  ))
                ) : (
                  <EmptyContext label="No related documents found." />
                )}
              </ContextListCard>

              <ContextListCard title="Recent commits">
                {(props.context?.recentCommits.length ?? 0) > 0 ? (
                  props.context?.recentCommits.map((commit) => (
                    <div key={commit.hash} className="rounded-xl border border-border bg-card/50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <GitCommitHorizontalIcon className="size-3.5 text-muted-foreground" />
                        <p className="font-mono text-[11px] text-muted-foreground">{commit.hash}</p>
                      </div>
                      <p className="mt-1 text-sm">{commit.subject}</p>
                    </div>
                  ))
                ) : (
                  <EmptyContext label="No recent commits found." />
                )}
              </ContextListCard>
            </div>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-background/60 p-4">
        <div>
          <h3 className="text-sm font-semibold">Completion preview</h3>
          <p className="text-xs text-muted-foreground">
            Shows the Nilus-managed change before writing to <span className="font-mono">todo.txt</span> and <span className="font-mono">done.txt</span>.
          </p>
        </div>
        {props.previewError ? (
          <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/6 px-3 py-2 text-sm text-destructive">
            {props.previewError}
          </div>
        ) : props.isLoadingPreview && props.preview === null ? (
          <div className="mt-4 text-sm text-muted-foreground">Preparing completion preview...</div>
        ) : props.preview ? (
          <div className="mt-4 space-y-3">
            <PreviewBlock
              label="done.txt append"
              contents={props.preview.completedLine}
            />
            {props.preview.nextTaskLine ? (
              <PreviewBlock
                label="todo.txt recurring next instance"
                contents={props.preview.nextTaskLine}
              />
            ) : (
              <PreviewBlock
                label="todo.txt recurring next instance"
                contents="No recurring follow-up will be created."
                muted
              />
            )}
            <div className="text-[11px] text-muted-foreground">
              Affected files: {props.preview.affectedFiles.join(", ")}
            </div>
          </div>
        ) : (
          <div className="mt-4 text-sm text-muted-foreground">No completion preview available.</div>
        )}
      </section>
    </div>
  );
}

function TalkNoteComposer(props: {
  topic: string;
  body: string;
  project: string;
  thread: string;
  refsInput: string;
  preview: {
    path: string;
    contents: string;
    affectedFiles: readonly string[];
    warnings: readonly string[];
    commitSafety: NilusCommitSafety;
  } | null;
  previewError: string | null;
  isLoadingPreview: boolean;
  isCreating: boolean;
  onTopicChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onProjectChange: (value: string) => void;
  onThreadChange: (value: string) => void;
  onRefsChange: (value: string) => void;
  onCreate: () => void;
}) {
  const hasDraft = props.topic.trim().length > 0 || props.body.trim().length > 0;

  return (
    <section className="rounded-2xl border border-border bg-card/60 p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Talk-log draft</h2>
          <p className="text-xs text-muted-foreground">
            Prototype a durable Nilus note with preview before writing to the repo.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Topic
          </span>
          <input
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            placeholder="What changed or was learned?"
            value={props.topic}
            onChange={(event) => props.onTopicChange(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Project
          </span>
          <input
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            placeholder="NilusBrowser"
            value={props.project}
            onChange={(event) => props.onProjectChange(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Thread
          </span>
          <input
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            placeholder="nilus-browser"
            value={props.thread}
            onChange={(event) => props.onThreadChange(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Refs
          </span>
          <input
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            placeholder="docs/example.md, talk-log/example.md"
            value={props.refsInput}
            onChange={(event) => props.onRefsChange(event.target.value)}
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Body
        </span>
        <textarea
          className="mt-2 min-h-36 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm leading-6 text-foreground outline-none focus:border-ring"
          placeholder="Short durable note here."
          value={props.body}
          onChange={(event) => props.onBodyChange(event.target.value)}
        />
      </label>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {hasDraft
            ? "Preview updates as you type. Create writes a new file in talk-log/."
            : "Enter a topic and body to prepare a talk-log preview."}
        </p>
        <Button
          size="sm"
          onClick={props.onCreate}
          disabled={props.isCreating || props.preview === null}
        >
          {props.isCreating ? "Creating..." : "Create talk note"}
        </Button>
      </div>

      {props.previewError ? (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/6 px-3 py-2 text-sm text-destructive">
          {props.previewError}
        </div>
      ) : props.isLoadingPreview && props.preview === null ? (
        <div className="mt-4 text-sm text-muted-foreground">Preparing talk-note preview...</div>
      ) : props.preview ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-border bg-background/70 px-3 py-3 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Target file
            </p>
            <p className="mt-2 font-mono text-[12px]">{props.preview.path}</p>
          </div>
          <PreviewBlock label="talk-log note contents" contents={props.preview.contents} />
          <div className="rounded-xl border border-border bg-background/70 px-3 py-3 text-xs text-muted-foreground">
            <p>Affected files: {props.preview.affectedFiles.join(", ")}</p>
          </div>
          {props.preview.warnings.length > 0 ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/8 px-3 py-3 text-sm text-amber-200">
              {props.preview.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function MetadataPill(props: { label: string }) {
  return (
    <span className="rounded-full border border-border bg-card/70 px-2 py-1">{props.label}</span>
  );
}

function ProviderStatusCard(props: {
  provider: ServerProvider;
  isSelected: boolean;
  isFallback: boolean;
}) {
  const toneClass =
    props.provider.status === "ready"
      ? "border-emerald-500/30 bg-emerald-500/8"
      : props.provider.status === "warning"
        ? "border-amber-500/30 bg-amber-500/8"
        : props.provider.status === "error"
          ? "border-destructive/40 bg-destructive/6"
          : "border-border bg-background/70";
  const label = PROVIDER_DISPLAY_NAMES[props.provider.provider] ?? props.provider.provider;
  const authLabel =
    props.provider.auth.status === "authenticated"
      ? props.provider.auth.label ?? "Authenticated"
      : props.provider.auth.status === "unauthenticated"
        ? "Needs sign-in"
        : "Auth unknown";

  return (
    <article className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {props.isSelected
              ? "Current Nilus backend"
              : props.isFallback
                ? "Ready fallback backend"
                : "Available backend"}
          </p>
        </div>
        <span className="rounded-full border border-border/80 bg-background/70 px-2 py-1 text-[11px] font-semibold capitalize">
          {props.provider.status}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
        <p>Auth: {authLabel}</p>
        <p>
          Models: {props.provider.models.length > 0 ? props.provider.models.length : "none detected"}
        </p>
        <p>Version: {props.provider.version ?? "unknown"}</p>
      </div>

      <p className="mt-3 text-sm">
        {props.provider.message ??
          (props.provider.status === "ready"
            ? `${label} is available for Nilus-backed actions.`
            : `${label} is not fully ready yet.`)}
      </p>
    </article>
  );
}

function ContextStat(props: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-border bg-card/50 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {props.label}
      </p>
      <p className="mt-2 text-sm font-medium leading-6">{props.value}</p>
    </article>
  );
}

function ContextListCard(props: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card/50 p-3">
      <h4 className="text-sm font-semibold">{props.title}</h4>
      <div className="mt-3 space-y-2">{props.children}</div>
    </section>
  );
}

function EmptyContext(props: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
      {props.label}
    </div>
  );
}

function PreviewBlock(props: { label: string; contents: string; muted?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {props.label}
      </p>
      <pre
        className={`mt-2 overflow-auto whitespace-pre-wrap rounded-xl p-3 text-xs leading-6 ${
          props.muted ? "bg-card/50 text-muted-foreground" : "bg-card text-foreground"
        }`}
      >
        {props.contents}
      </pre>
    </div>
  );
}

function resolveNilusSyncSummary(props: {
  status: GitStatusResult | null;
  error: string | null;
  isPending: boolean;
}) {
  if (props.error) {
    return {
      title: "Git state unavailable",
      detail: props.error,
      nextAction: "Check the repo path and refresh sync status before trying save or publish actions.",
    };
  }

  if (props.isPending && props.status === null) {
    return {
      title: "Checking repo state",
      detail: "Nilus is loading branch, working tree, and upstream status for this repo.",
      nextAction: "Wait for git status to load, then use the save and sync controls below.",
    };
  }

  if (props.status === null) {
    return {
      title: "Git state not loaded",
      detail: "No git snapshot is available for this repo yet.",
      nextAction: "Refresh sync status to load the current repo state.",
    };
  }

  if (!props.status.isRepo) {
    return {
      title: "Not a git repo",
      detail: "The selected folder is not a git repository, so Nilus cannot save or sync changes here.",
      nextAction: "Open a Nilus repo checkout before using browser save or publish actions.",
    };
  }

  if (props.status.branch === null) {
    return {
      title: "Detached HEAD",
      detail: "This repo is not on a named branch, so Nilus should not publish changes until branch state is fixed.",
      nextAction: "Switch to a branch before using commit or push flows in the browser.",
    };
  }

  if (props.status.behindCount > 0 && props.status.hasWorkingTreeChanges) {
    return {
      title: "Local work plus upstream drift",
      detail: `This repo has local edits and is ${props.status.behindCount} commit${props.status.behindCount === 1 ? "" : "s"} behind upstream.`,
      nextAction: "Review local edits, then use pull or rebase-safe sync handling before publishing.",
    };
  }

  if (props.status.behindCount > 0) {
    return {
      title: "Needs sync from remote",
      detail: `This branch is ${props.status.behindCount} commit${props.status.behindCount === 1 ? "" : "s"} behind upstream.`,
      nextAction: "Use the pull flow below before starting new Nilus write work.",
    };
  }

  if (props.status.hasWorkingTreeChanges) {
    return {
      title: "Local changes pending save",
      detail: `There are ${props.status.workingTree.files.length} changed file${props.status.workingTree.files.length === 1 ? "" : "s"} in the worktree.`,
      nextAction: "Use Commit to save browser-written changes, then Push when you are ready to publish them.",
    };
  }

  if (props.status.aheadCount > 0) {
    return {
      title: "Ready to publish",
      detail: `This branch is ${props.status.aheadCount} commit${props.status.aheadCount === 1 ? "" : "s"} ahead of upstream with a clean worktree.`,
      nextAction: props.status.pr
        ? "Use Push to publish the latest local commits to the existing PR branch."
        : "Use Push to publish local commits, then open a PR if review is needed.",
    };
  }

  return {
    title: "Repo is in sync",
    detail: `Branch ${props.status.branch} is clean and aligned with its tracked upstream.`,
    nextAction: "You can keep working in the browser. Nilus will only need git actions after the next durable change.",
  };
}

function resolveNilusSaveState(props: {
  status: GitStatusResult | null;
  error: string | null;
  isPending: boolean;
}) {
  if (props.error) {
    return {
      tone: "error" as const,
      canSave: false,
      action: null,
      unsavedFileCount: 0,
      unpublishedCommitCount: 0,
      bannerTitle: "Save unavailable",
      bannerDetail: props.error,
      statusLabel: "Fix repo access before saving",
    };
  }

  if (props.isPending && props.status === null) {
    return {
      tone: "info" as const,
      canSave: false,
      action: null,
      unsavedFileCount: 0,
      unpublishedCommitCount: 0,
      bannerTitle: "Checking for unsaved changes",
      bannerDetail: "Nilus is loading the current repo state before deciding whether there is anything to save.",
      statusLabel: "Loading repo state",
    };
  }

  if (props.status === null) {
    return {
      tone: "warning" as const,
      canSave: false,
      action: null,
      unsavedFileCount: 0,
      unpublishedCommitCount: 0,
      bannerTitle: "Save unavailable",
      bannerDetail: "Git status has not loaded for this repo yet.",
      statusLabel: "Refresh repo state",
    };
  }

  if (!props.status.isRepo) {
    return {
      tone: "error" as const,
      canSave: false,
      action: null,
      unsavedFileCount: 0,
      unpublishedCommitCount: 0,
      bannerTitle: "Save unavailable",
      bannerDetail: "The selected folder is not a git repository, so Nilus cannot save browser changes here.",
      statusLabel: "Open a Nilus repo",
    };
  }

  if (props.status.branch === null) {
    return {
      tone: "error" as const,
      canSave: false,
      action: null,
      unsavedFileCount: props.status.workingTree.files.length,
      unpublishedCommitCount: props.status.aheadCount,
      bannerTitle: "Save blocked",
      bannerDetail: "Nilus web saves only work from trunk. This repo is currently in detached HEAD state.",
      statusLabel: "Switch back to trunk",
    };
  }

  if (props.status.branch !== "trunk") {
    return {
      tone: "error" as const,
      canSave: false,
      action: null,
      unsavedFileCount: props.status.workingTree.files.length,
      unpublishedCommitCount: props.status.aheadCount,
      bannerTitle: "Save blocked",
      bannerDetail: `Nilus web saves only publish directly to trunk. Current branch: ${props.status.branch}.`,
      statusLabel: "Branch must be trunk",
    };
  }

  if (props.status.behindCount > 0) {
    return {
      tone: "warning" as const,
      canSave: false,
      action: null,
      unsavedFileCount: props.status.workingTree.files.length,
      unpublishedCommitCount: props.status.aheadCount,
      bannerTitle: "Save paused until trunk is current",
      bannerDetail: `Trunk is ${props.status.behindCount} commit${props.status.behindCount === 1 ? "" : "s"} behind upstream. Nilus will not save on top of stale trunk state.`,
      statusLabel: "Update trunk before saving",
    };
  }

  if (props.status.hasWorkingTreeChanges) {
    return {
      tone: "warning" as const,
      canSave: true,
      action: "commit_push" as const,
      unsavedFileCount: props.status.workingTree.files.length,
      unpublishedCommitCount: props.status.aheadCount,
      bannerTitle: `${props.status.workingTree.files.length} unsaved file${props.status.workingTree.files.length === 1 ? "" : "s"} pending save`,
      bannerDetail: "Save will commit the current browser and local repo changes, then push them directly to origin/trunk.",
      statusLabel:
        props.status.aheadCount > 0
          ? `${props.status.workingTree.files.length} files changed and ${props.status.aheadCount} local commit${props.status.aheadCount === 1 ? "" : "s"} also pending push`
          : `${props.status.workingTree.files.length} changed file${props.status.workingTree.files.length === 1 ? "" : "s"} pending commit and push`,
    };
  }

  if (props.status.aheadCount > 0) {
    return {
      tone: "warning" as const,
      canSave: true,
      action: "push" as const,
      unsavedFileCount: 0,
      unpublishedCommitCount: props.status.aheadCount,
      bannerTitle: `${props.status.aheadCount} unpublished commit${props.status.aheadCount === 1 ? "" : "s"} pending save`,
      bannerDetail: "Save will push the already-committed local work directly to origin/trunk.",
      statusLabel: `${props.status.aheadCount} local commit${props.status.aheadCount === 1 ? "" : "s"} waiting to push`,
    };
  }

  return {
    tone: "success" as const,
    canSave: false,
    action: null,
    unsavedFileCount: 0,
    unpublishedCommitCount: 0,
    bannerTitle: "No unsaved changes",
    bannerDetail: "This Nilus repo is clean and already synced to origin/trunk.",
    statusLabel: "All browser changes are saved",
  };
}

function resolveNilusSaveCommitMessage(status: GitStatusResult | null) {
  const changedFiles = status?.workingTree.files.map((file) => file.path) ?? [];
  if (changedFiles.length === 0) {
    return "nilus: save browser updates";
  }
  if (changedFiles.every((path) => path === "todo.txt" || path === "done.txt")) {
    return "nilus: save task updates";
  }
  if (changedFiles.every((path) => path.startsWith("talk-log/"))) {
    return "nilus: save talk-log updates";
  }
  if (changedFiles.every((path) => path.startsWith("partners/"))) {
    return "nilus: save partner updates";
  }
  if (changedFiles.every((path) => path.startsWith("issues/"))) {
    return "nilus: save issue updates";
  }
  return "nilus: save browser updates";
}

function parseRefsInput(value: string) {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry, index, all) => entry.length > 0 && all.indexOf(entry) === index);
}

export const Route = createFileRoute("/nilus")({
  component: NilusRouteView,
});

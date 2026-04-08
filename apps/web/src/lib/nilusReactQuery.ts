import type {
  NilusCompleteTaskResult,
  NilusCreateTalkNoteResult,
  NilusDomain,
  NilusListDomainEntriesResult,
  NilusTaskRecord,
  NilusTalkNoteDraftInput,
} from "@t3tools/contracts";
import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";

import { ensureNativeApi } from "~/nativeApi";

const EMPTY_TASKS: readonly NilusTaskRecord[] = [];
const EMPTY_DOMAIN_ENTRIES: NilusListDomainEntriesResult = {
  domain: "talk",
  entries: [],
};
const STARTUP_STALE_TIME = 15_000;

export const nilusQueryKeys = {
  all: ["nilus"] as const,
  startup: (repoRoot: string | null) => ["nilus", "startup", repoRoot] as const,
  tasks: (repoRoot: string | null, status: "open" | "done" | null) =>
    ["nilus", "tasks", repoRoot, status] as const,
  taskContext: (repoRoot: string | null, taskNumber: number | null) =>
    ["nilus", "taskContext", repoRoot, taskNumber] as const,
  domainEntries: (repoRoot: string | null, domain: NilusDomain | null) =>
    ["nilus", "domainEntries", repoRoot, domain] as const,
  document: (repoRoot: string | null, documentPath: string | null) =>
    ["nilus", "document", repoRoot, documentPath] as const,
  completionPreview: (repoRoot: string | null, taskNumber: number | null) =>
    ["nilus", "completionPreview", repoRoot, taskNumber] as const,
  talkNotePreview: (repoRoot: string | null, draftKey: string) =>
    ["nilus", "talkNotePreview", repoRoot, draftKey] as const,
};

export const nilusMutationKeys = {
  completeTask: (repoRoot: string | null) => ["nilus", "mutation", "completeTask", repoRoot] as const,
  createTalkNote: (repoRoot: string | null) => ["nilus", "mutation", "createTalkNote", repoRoot] as const,
};

export function invalidateNilusQueries(queryClient: QueryClient, repoRoot: string | null) {
  if (repoRoot === null) {
    return queryClient.invalidateQueries({ queryKey: nilusQueryKeys.all });
  }

  return Promise.all([
    queryClient.invalidateQueries({ queryKey: nilusQueryKeys.startup(repoRoot) }),
    queryClient.invalidateQueries({ queryKey: nilusQueryKeys.tasks(repoRoot, "open") }),
    queryClient.invalidateQueries({ queryKey: nilusQueryKeys.tasks(repoRoot, "done") }),
    queryClient.invalidateQueries({ queryKey: ["nilus", "taskContext", repoRoot] }),
    queryClient.invalidateQueries({ queryKey: ["nilus", "completionPreview", repoRoot] }),
    queryClient.invalidateQueries({ queryKey: ["nilus", "talkNotePreview", repoRoot] }),
    queryClient.invalidateQueries({ queryKey: ["nilus", "domainEntries", repoRoot] }),
    queryClient.invalidateQueries({ queryKey: ["nilus", "document", repoRoot] }),
  ]);
}

export function nilusStartupSnapshotQueryOptions(input: {
  repoRoot: string | null;
  enabled?: boolean;
}) {
  return queryOptions({
    queryKey: nilusQueryKeys.startup(input.repoRoot),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.repoRoot) {
        throw new Error("Nilus repo is not selected.");
      }
      return api.nilus.getStartupSnapshot({
        repoRoot: input.repoRoot,
      });
    },
    enabled: (input.enabled ?? true) && input.repoRoot !== null,
    staleTime: STARTUP_STALE_TIME,
  });
}

export function nilusTasksQueryOptions(input: {
  repoRoot: string | null;
  status: "open" | "done" | null;
  enabled?: boolean;
  limit?: number;
}) {
  return queryOptions({
    queryKey: nilusQueryKeys.tasks(input.repoRoot, input.status),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.repoRoot) {
        throw new Error("Nilus repo is not selected.");
      }
      return api.nilus.listTasks({
        repoRoot: input.repoRoot,
        ...(input.status ? { status: input.status } : {}),
        ...(input.limit ? { limit: input.limit } : {}),
      });
    },
    enabled: (input.enabled ?? true) && input.repoRoot !== null,
    staleTime: STARTUP_STALE_TIME,
    placeholderData: (previous) => previous ?? EMPTY_TASKS,
  });
}

export function nilusDomainEntriesQueryOptions(input: {
  repoRoot: string | null;
  domain: NilusDomain | null;
  enabled?: boolean;
  limit?: number;
}) {
  return queryOptions({
    queryKey: nilusQueryKeys.domainEntries(input.repoRoot, input.domain),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.repoRoot || !input.domain) {
        throw new Error("Nilus domain browsing is unavailable.");
      }
      return api.nilus.listDomainEntries({
        repoRoot: input.repoRoot,
        domain: input.domain,
        ...(input.limit ? { limit: input.limit } : {}),
      });
    },
    enabled: (input.enabled ?? true) && input.repoRoot !== null && input.domain !== null,
    staleTime: STARTUP_STALE_TIME,
    placeholderData: (previous) =>
      previous ?? { ...EMPTY_DOMAIN_ENTRIES, domain: input.domain ?? "talk" },
  });
}

export function nilusTaskContextQueryOptions(input: {
  repoRoot: string | null;
  taskNumber: number | null;
  enabled?: boolean;
}) {
  return queryOptions({
    queryKey: nilusQueryKeys.taskContext(input.repoRoot, input.taskNumber),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.repoRoot || input.taskNumber === null) {
        throw new Error("Nilus task context is unavailable.");
      }
      return api.nilus.getTaskContext({
        repoRoot: input.repoRoot,
        taskNumber: input.taskNumber,
      });
    },
    enabled: (input.enabled ?? true) && input.repoRoot !== null && input.taskNumber !== null,
    staleTime: STARTUP_STALE_TIME,
  });
}

export function nilusDocumentQueryOptions(input: {
  repoRoot: string | null;
  path: string | null;
  enabled?: boolean;
}) {
  return queryOptions({
    queryKey: nilusQueryKeys.document(input.repoRoot, input.path),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.repoRoot || !input.path) {
        throw new Error("Nilus document is not selected.");
      }
      return api.nilus.readDocument({
        repoRoot: input.repoRoot,
        path: input.path,
      });
    },
    enabled: (input.enabled ?? true) && input.repoRoot !== null && input.path !== null,
    staleTime: STARTUP_STALE_TIME,
  });
}

export function nilusTaskCompletionPreviewQueryOptions(input: {
  repoRoot: string | null;
  taskNumber: number | null;
  enabled?: boolean;
}) {
  return queryOptions({
    queryKey: nilusQueryKeys.completionPreview(input.repoRoot, input.taskNumber),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.repoRoot || input.taskNumber === null) {
        throw new Error("Nilus task completion preview is unavailable.");
      }
      return api.nilus.prepareTaskCompletion({
        repoRoot: input.repoRoot,
        taskNumber: input.taskNumber,
      });
    },
    enabled: (input.enabled ?? true) && input.repoRoot !== null && input.taskNumber !== null,
    staleTime: STARTUP_STALE_TIME,
  });
}

export function nilusTalkNotePreviewQueryOptions(input: {
  draft: (NilusTalkNoteDraftInput & { draftKey: string }) | null;
  enabled?: boolean;
}) {
  return queryOptions({
    queryKey: nilusQueryKeys.talkNotePreview(input.draft?.repoRoot ?? null, input.draft?.draftKey ?? "empty"),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.draft) {
        throw new Error("Nilus talk note preview is unavailable.");
      }
      const { draftKey: _draftKey, ...payload } = input.draft;
      return api.nilus.prepareTalkNote(payload);
    },
    enabled: (input.enabled ?? true) && input.draft !== null,
    staleTime: STARTUP_STALE_TIME,
  });
}

export function nilusCompleteTaskMutationOptions(input: {
  repoRoot: string | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: nilusMutationKeys.completeTask(input.repoRoot),
    mutationFn: async ({ taskNumber }: { taskNumber: number }) => {
      const api = ensureNativeApi();
      if (!input.repoRoot) {
        throw new Error("Nilus task completion is unavailable.");
      }
      return api.nilus.completeTask({
        repoRoot: input.repoRoot,
        taskNumber,
      });
    },
    onSuccess: async (_result: NilusCompleteTaskResult) => {
      await invalidateNilusQueries(input.queryClient, input.repoRoot);
    },
  });
}

export function nilusCreateTalkNoteMutationOptions(input: {
  repoRoot: string | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: nilusMutationKeys.createTalkNote(input.repoRoot),
    mutationFn: async (draft: NilusTalkNoteDraftInput) => {
      const api = ensureNativeApi();
      if (!input.repoRoot) {
        throw new Error("Nilus talk note creation is unavailable.");
      }
      return api.nilus.createTalkNote(draft);
    },
    onSuccess: async (_result: NilusCreateTalkNoteResult) => {
      await invalidateNilusQueries(input.queryClient, input.repoRoot);
    },
  });
}

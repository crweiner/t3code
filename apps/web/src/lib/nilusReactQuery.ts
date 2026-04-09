import type {
  NilusCompleteTaskResult,
  NilusIssueDraftInput,
  NilusIssueUpdateInput,
  NilusMemoryMutationResult,
  NilusPartnerDraftInput,
  NilusPartnerUpdateInput,
  NilusCreateTaskResult,
  NilusCreateTalkNoteResult,
  NilusDomain,
  NilusListDomainEntriesResult,
  NilusTaskDraftInput,
  NilusTaskRecord,
  NilusTalkNoteDraftInput,
} from "@t3tools/contracts";
import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";

import { createEnvironmentApi } from "~/environmentApi";
import { getPrimaryEnvironmentConnection } from "~/environments/runtime";

const EMPTY_TASKS: readonly NilusTaskRecord[] = [];
const EMPTY_DOMAIN_ENTRIES: NilusListDomainEntriesResult = {
  domain: "talk",
  entries: [],
};
const STARTUP_STALE_TIME = 15_000;

function readNilusApi() {
  return createEnvironmentApi(getPrimaryEnvironmentConnection().client).nilus;
}

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
  taskDraftPreview: (repoRoot: string | null, draftKey: string) =>
    ["nilus", "taskDraftPreview", repoRoot, draftKey] as const,
  talkNotePreview: (repoRoot: string | null, draftKey: string) =>
    ["nilus", "talkNotePreview", repoRoot, draftKey] as const,
  partnerDraftPreview: (repoRoot: string | null, draftKey: string) =>
    ["nilus", "partnerDraftPreview", repoRoot, draftKey] as const,
  partnerUpdatePreview: (repoRoot: string | null, draftKey: string) =>
    ["nilus", "partnerUpdatePreview", repoRoot, draftKey] as const,
  issueDraftPreview: (repoRoot: string | null, draftKey: string) =>
    ["nilus", "issueDraftPreview", repoRoot, draftKey] as const,
  issueUpdatePreview: (repoRoot: string | null, draftKey: string) =>
    ["nilus", "issueUpdatePreview", repoRoot, draftKey] as const,
};

export const nilusMutationKeys = {
  completeTask: (repoRoot: string | null) =>
    ["nilus", "mutation", "completeTask", repoRoot] as const,
  createTask: (repoRoot: string | null) => ["nilus", "mutation", "createTask", repoRoot] as const,
  createTalkNote: (repoRoot: string | null) =>
    ["nilus", "mutation", "createTalkNote", repoRoot] as const,
  createPartner: (repoRoot: string | null) => ["nilus", "mutation", "createPartner", repoRoot] as const,
  updatePartner: (repoRoot: string | null) => ["nilus", "mutation", "updatePartner", repoRoot] as const,
  createIssue: (repoRoot: string | null) => ["nilus", "mutation", "createIssue", repoRoot] as const,
  updateIssue: (repoRoot: string | null) => ["nilus", "mutation", "updateIssue", repoRoot] as const,
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
    queryClient.invalidateQueries({ queryKey: ["nilus", "taskDraftPreview", repoRoot] }),
    queryClient.invalidateQueries({ queryKey: ["nilus", "talkNotePreview", repoRoot] }),
    queryClient.invalidateQueries({ queryKey: ["nilus", "partnerDraftPreview", repoRoot] }),
    queryClient.invalidateQueries({ queryKey: ["nilus", "partnerUpdatePreview", repoRoot] }),
    queryClient.invalidateQueries({ queryKey: ["nilus", "issueDraftPreview", repoRoot] }),
    queryClient.invalidateQueries({ queryKey: ["nilus", "issueUpdatePreview", repoRoot] }),
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
      const api = readNilusApi();
      if (!input.repoRoot) {
        throw new Error("Nilus repo is not selected.");
      }
      return api.getStartupSnapshot({
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
      const api = readNilusApi();
      if (!input.repoRoot) {
        throw new Error("Nilus repo is not selected.");
      }
      return api.listTasks({
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
      const api = readNilusApi();
      if (!input.repoRoot || !input.domain) {
        throw new Error("Nilus domain browsing is unavailable.");
      }
      return api.listDomainEntries({
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
      const api = readNilusApi();
      if (!input.repoRoot || input.taskNumber === null) {
        throw new Error("Nilus task context is unavailable.");
      }
      return api.getTaskContext({
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
      const api = readNilusApi();
      if (!input.repoRoot || !input.path) {
        throw new Error("Nilus document is not selected.");
      }
      return api.readDocument({
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
      const api = readNilusApi();
      if (!input.repoRoot || input.taskNumber === null) {
        throw new Error("Nilus task completion preview is unavailable.");
      }
      return api.prepareTaskCompletion({
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
    queryKey: nilusQueryKeys.talkNotePreview(
      input.draft?.repoRoot ?? null,
      input.draft?.draftKey ?? "empty",
    ),
    queryFn: async () => {
      const api = readNilusApi();
      if (!input.draft) {
        throw new Error("Nilus talk note preview is unavailable.");
      }
      const { draftKey: _draftKey, ...payload } = input.draft;
      return api.prepareTalkNote(payload);
    },
    enabled: (input.enabled ?? true) && input.draft !== null,
    staleTime: STARTUP_STALE_TIME,
  });
}

export function nilusTaskDraftPreviewQueryOptions(input: {
  draft: (NilusTaskDraftInput & { draftKey: string }) | null;
  enabled?: boolean;
}) {
  return queryOptions({
    queryKey: nilusQueryKeys.taskDraftPreview(
      input.draft?.repoRoot ?? null,
      input.draft?.draftKey ?? "empty",
    ),
    queryFn: async () => {
      const api = readNilusApi();
      if (!input.draft) {
        throw new Error("Nilus task preview is unavailable.");
      }
      const { draftKey: _draftKey, ...payload } = input.draft;
      return api.prepareTaskDraft(payload);
    },
    enabled: (input.enabled ?? true) && input.draft !== null,
    staleTime: STARTUP_STALE_TIME,
  });
}

export function nilusPartnerDraftPreviewQueryOptions(input: {
  draft: (NilusPartnerDraftInput & { draftKey: string }) | null;
  enabled?: boolean;
}) {
  return queryOptions({
    queryKey: nilusQueryKeys.partnerDraftPreview(
      input.draft?.repoRoot ?? null,
      input.draft?.draftKey ?? "empty",
    ),
    queryFn: async () => {
      const api = readNilusApi();
      if (!input.draft) {
        throw new Error("Nilus partner draft preview is unavailable.");
      }
      const { draftKey: _draftKey, ...payload } = input.draft;
      return api.preparePartnerDraft(payload);
    },
    enabled: (input.enabled ?? true) && input.draft !== null,
    staleTime: STARTUP_STALE_TIME,
  });
}

export function nilusPartnerUpdatePreviewQueryOptions(input: {
  draft: (NilusPartnerUpdateInput & { draftKey: string }) | null;
  enabled?: boolean;
}) {
  return queryOptions({
    queryKey: nilusQueryKeys.partnerUpdatePreview(
      input.draft?.repoRoot ?? null,
      input.draft?.draftKey ?? "empty",
    ),
    queryFn: async () => {
      const api = readNilusApi();
      if (!input.draft) {
        throw new Error("Nilus partner update preview is unavailable.");
      }
      const { draftKey: _draftKey, ...payload } = input.draft;
      return api.preparePartnerUpdate(payload);
    },
    enabled: (input.enabled ?? true) && input.draft !== null,
    staleTime: STARTUP_STALE_TIME,
  });
}

export function nilusIssueDraftPreviewQueryOptions(input: {
  draft: (NilusIssueDraftInput & { draftKey: string }) | null;
  enabled?: boolean;
}) {
  return queryOptions({
    queryKey: nilusQueryKeys.issueDraftPreview(
      input.draft?.repoRoot ?? null,
      input.draft?.draftKey ?? "empty",
    ),
    queryFn: async () => {
      const api = readNilusApi();
      if (!input.draft) {
        throw new Error("Nilus issue draft preview is unavailable.");
      }
      const { draftKey: _draftKey, ...payload } = input.draft;
      return api.prepareIssueDraft(payload);
    },
    enabled: (input.enabled ?? true) && input.draft !== null,
    staleTime: STARTUP_STALE_TIME,
  });
}

export function nilusIssueUpdatePreviewQueryOptions(input: {
  draft: (NilusIssueUpdateInput & { draftKey: string }) | null;
  enabled?: boolean;
}) {
  return queryOptions({
    queryKey: nilusQueryKeys.issueUpdatePreview(
      input.draft?.repoRoot ?? null,
      input.draft?.draftKey ?? "empty",
    ),
    queryFn: async () => {
      const api = readNilusApi();
      if (!input.draft) {
        throw new Error("Nilus issue update preview is unavailable.");
      }
      const { draftKey: _draftKey, ...payload } = input.draft;
      return api.prepareIssueUpdate(payload);
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
      const api = readNilusApi();
      if (!input.repoRoot) {
        throw new Error("Nilus task completion is unavailable.");
      }
      return api.completeTask({
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
      const api = readNilusApi();
      if (!input.repoRoot) {
        throw new Error("Nilus talk note creation is unavailable.");
      }
      return api.createTalkNote(draft);
    },
    onSuccess: async (_result: NilusCreateTalkNoteResult) => {
      await invalidateNilusQueries(input.queryClient, input.repoRoot);
    },
  });
}

export function nilusCreateTaskMutationOptions(input: {
  repoRoot: string | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: nilusMutationKeys.createTask(input.repoRoot),
    mutationFn: async (draft: NilusTaskDraftInput) => {
      const api = readNilusApi();
      if (!input.repoRoot) {
        throw new Error("Nilus task creation is unavailable.");
      }
      return api.createTask(draft);
    },
    onSuccess: async (_result: NilusCreateTaskResult) => {
      await invalidateNilusQueries(input.queryClient, input.repoRoot);
    },
  });
}

export function nilusCreatePartnerMutationOptions(input: {
  repoRoot: string | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: nilusMutationKeys.createPartner(input.repoRoot),
    mutationFn: async (draft: NilusPartnerDraftInput) => {
      const api = readNilusApi();
      if (!input.repoRoot) {
        throw new Error("Nilus partner creation is unavailable.");
      }
      return api.createPartner(draft);
    },
    onSuccess: async (_result: NilusMemoryMutationResult) => {
      await invalidateNilusQueries(input.queryClient, input.repoRoot);
    },
  });
}

export function nilusUpdatePartnerMutationOptions(input: {
  repoRoot: string | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: nilusMutationKeys.updatePartner(input.repoRoot),
    mutationFn: async (draft: NilusPartnerUpdateInput) => {
      const api = readNilusApi();
      if (!input.repoRoot) {
        throw new Error("Nilus partner update is unavailable.");
      }
      return api.updatePartner(draft);
    },
    onSuccess: async (_result: NilusMemoryMutationResult) => {
      await invalidateNilusQueries(input.queryClient, input.repoRoot);
    },
  });
}

export function nilusCreateIssueMutationOptions(input: {
  repoRoot: string | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: nilusMutationKeys.createIssue(input.repoRoot),
    mutationFn: async (draft: NilusIssueDraftInput) => {
      const api = readNilusApi();
      if (!input.repoRoot) {
        throw new Error("Nilus issue creation is unavailable.");
      }
      return api.createIssue(draft);
    },
    onSuccess: async (_result: NilusMemoryMutationResult) => {
      await invalidateNilusQueries(input.queryClient, input.repoRoot);
    },
  });
}

export function nilusUpdateIssueMutationOptions(input: {
  repoRoot: string | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: nilusMutationKeys.updateIssue(input.repoRoot),
    mutationFn: async (draft: NilusIssueUpdateInput) => {
      const api = readNilusApi();
      if (!input.repoRoot) {
        throw new Error("Nilus issue update is unavailable.");
      }
      return api.updateIssue(draft);
    },
    onSuccess: async (_result: NilusMemoryMutationResult) => {
      await invalidateNilusQueries(input.queryClient, input.repoRoot);
    },
  });
}

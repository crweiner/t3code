import { Schema } from "effect";
import * as Rpc from "effect/unstable/rpc/Rpc";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";

import { OpenError, OpenInEditorInput } from "./editor.ts";
import { AuthAccessStreamEvent } from "./auth.ts";
import {
  FilesystemBrowseInput,
  FilesystemBrowseResult,
  FilesystemBrowseError,
} from "./filesystem.ts";
import {
  GitActionProgressEvent,
  GitCheckoutInput,
  GitCheckoutResult,
  GitCommandError,
  GitCreateBranchInput,
  GitCreateBranchResult,
  GitCreateWorktreeInput,
  GitCreateWorktreeResult,
  GitInitInput,
  GitListBranchesInput,
  GitListBranchesResult,
  GitManagerServiceError,
  GitPreparePullRequestThreadInput,
  GitPreparePullRequestThreadResult,
  GitPullInput,
  GitPullRequestRefInput,
  GitPullResult,
  GitRemoveWorktreeInput,
  GitResolvePullRequestResult,
  GitRunStackedActionInput,
  GitStatusInput,
  GitStatusResult,
  GitStatusStreamEvent,
} from "./git.ts";
import { KeybindingsConfigError } from "./keybindings.ts";
import {
  ClientOrchestrationCommand,
  ORCHESTRATION_WS_METHODS,
  OrchestrationDispatchCommandError,
  OrchestrationGetFullThreadDiffError,
  OrchestrationGetFullThreadDiffInput,
  OrchestrationGetSnapshotError,
  OrchestrationGetTurnDiffError,
  OrchestrationGetTurnDiffInput,
  OrchestrationReplayEventsError,
  OrchestrationReplayEventsInput,
  OrchestrationRpcSchemas,
} from "./orchestration.ts";
import {
  ProjectSearchEntriesError,
  ProjectSearchEntriesInput,
  ProjectSearchEntriesResult,
  ProjectWriteFileError,
  ProjectWriteFileInput,
  ProjectWriteFileResult,
} from "./project.ts";
import {
  NilusCreateTaskInput,
  NilusCreateTaskResult,
  NilusIssueDraftInput,
  NilusIssueUpdateInput,
  NilusMemoryMutationPreview,
  NilusMemoryMutationResult,
  NilusPartnerDraftInput,
  NilusPartnerUpdateInput,
  NilusCreateTalkNoteInput,
  NilusCreateTalkNoteResult,
  NilusCompleteTaskInput,
  NilusCompleteTaskResult,
  NilusDocument,
  NilusListDomainEntriesInput,
  NilusListDomainEntriesResult,
  NilusListTasksInput,
  NilusPrepareTaskCompletionInput,
  NilusReadDocumentInput,
  NilusReadError,
  NilusStartupSnapshot,
  NilusStartupSnapshotInput,
  NilusTaskDraftInput,
  NilusTaskDraftPreview,
  NilusTaskCompletionPreview,
  NilusTaskContext,
  NilusTaskContextInput,
  NilusTaskRecord,
  NilusTalkNoteDraftInput,
  NilusTalkNotePreview,
} from "./nilus.ts";
import {
  TerminalClearInput,
  TerminalCloseInput,
  TerminalError,
  TerminalEvent,
  TerminalOpenInput,
  TerminalResizeInput,
  TerminalRestartInput,
  TerminalSessionSnapshot,
  TerminalWriteInput,
} from "./terminal.ts";
import {
  ServerConfigStreamEvent,
  ServerConfig,
  ServerLifecycleStreamEvent,
  ServerProviderUpdatedPayload,
  ServerUpsertKeybindingInput,
  ServerUpsertKeybindingResult,
} from "./server.ts";
import { ServerSettings, ServerSettingsError, ServerSettingsPatch } from "./settings.ts";

export const WS_METHODS = {
  // Project registry methods
  projectsList: "projects.list",
  projectsAdd: "projects.add",
  projectsRemove: "projects.remove",
  projectsSearchEntries: "projects.searchEntries",
  projectsWriteFile: "projects.writeFile",
  nilusGetStartupSnapshot: "nilus.getStartupSnapshot",
  nilusListTasks: "nilus.listTasks",
  nilusGetTaskContext: "nilus.getTaskContext",
  nilusListDomainEntries: "nilus.listDomainEntries",
  nilusReadDocument: "nilus.readDocument",
  nilusPrepareTaskCompletion: "nilus.prepareTaskCompletion",
  nilusCompleteTask: "nilus.completeTask",
  nilusPrepareTaskDraft: "nilus.prepareTaskDraft",
  nilusCreateTask: "nilus.createTask",
  nilusPrepareTalkNote: "nilus.prepareTalkNote",
  nilusCreateTalkNote: "nilus.createTalkNote",
  nilusPreparePartnerDraft: "nilus.preparePartnerDraft",
  nilusCreatePartner: "nilus.createPartner",
  nilusPreparePartnerUpdate: "nilus.preparePartnerUpdate",
  nilusUpdatePartner: "nilus.updatePartner",
  nilusPrepareIssueDraft: "nilus.prepareIssueDraft",
  nilusCreateIssue: "nilus.createIssue",
  nilusPrepareIssueUpdate: "nilus.prepareIssueUpdate",
  nilusUpdateIssue: "nilus.updateIssue",

  // Shell methods
  shellOpenInEditor: "shell.openInEditor",

  // Filesystem methods
  filesystemBrowse: "filesystem.browse",

  // Git methods
  gitPull: "git.pull",
  gitRefreshStatus: "git.refreshStatus",
  gitRunStackedAction: "git.runStackedAction",
  gitListBranches: "git.listBranches",
  gitCreateWorktree: "git.createWorktree",
  gitRemoveWorktree: "git.removeWorktree",
  gitCreateBranch: "git.createBranch",
  gitCheckout: "git.checkout",
  gitInit: "git.init",
  gitResolvePullRequest: "git.resolvePullRequest",
  gitPreparePullRequestThread: "git.preparePullRequestThread",

  // Terminal methods
  terminalOpen: "terminal.open",
  terminalWrite: "terminal.write",
  terminalResize: "terminal.resize",
  terminalClear: "terminal.clear",
  terminalRestart: "terminal.restart",
  terminalClose: "terminal.close",

  // Server meta
  serverGetConfig: "server.getConfig",
  serverRefreshProviders: "server.refreshProviders",
  serverUpsertKeybinding: "server.upsertKeybinding",
  serverGetSettings: "server.getSettings",
  serverUpdateSettings: "server.updateSettings",

  // Streaming subscriptions
  subscribeGitStatus: "subscribeGitStatus",
  subscribeTerminalEvents: "subscribeTerminalEvents",
  subscribeServerConfig: "subscribeServerConfig",
  subscribeServerLifecycle: "subscribeServerLifecycle",
  subscribeAuthAccess: "subscribeAuthAccess",
} as const;

export const WsServerUpsertKeybindingRpc = Rpc.make(WS_METHODS.serverUpsertKeybinding, {
  payload: ServerUpsertKeybindingInput,
  success: ServerUpsertKeybindingResult,
  error: KeybindingsConfigError,
});

export const WsServerGetConfigRpc = Rpc.make(WS_METHODS.serverGetConfig, {
  payload: Schema.Struct({}),
  success: ServerConfig,
  error: Schema.Union([KeybindingsConfigError, ServerSettingsError]),
});

export const WsServerRefreshProvidersRpc = Rpc.make(WS_METHODS.serverRefreshProviders, {
  payload: Schema.Struct({}),
  success: ServerProviderUpdatedPayload,
});

export const WsServerGetSettingsRpc = Rpc.make(WS_METHODS.serverGetSettings, {
  payload: Schema.Struct({}),
  success: ServerSettings,
  error: ServerSettingsError,
});

export const WsServerUpdateSettingsRpc = Rpc.make(WS_METHODS.serverUpdateSettings, {
  payload: Schema.Struct({ patch: ServerSettingsPatch }),
  success: ServerSettings,
  error: ServerSettingsError,
});

export const WsProjectsSearchEntriesRpc = Rpc.make(WS_METHODS.projectsSearchEntries, {
  payload: ProjectSearchEntriesInput,
  success: ProjectSearchEntriesResult,
  error: ProjectSearchEntriesError,
});

export const WsProjectsWriteFileRpc = Rpc.make(WS_METHODS.projectsWriteFile, {
  payload: ProjectWriteFileInput,
  success: ProjectWriteFileResult,
  error: ProjectWriteFileError,
});

export const WsNilusGetStartupSnapshotRpc = Rpc.make(WS_METHODS.nilusGetStartupSnapshot, {
  payload: NilusStartupSnapshotInput,
  success: NilusStartupSnapshot,
  error: NilusReadError,
});

export const WsNilusListTasksRpc = Rpc.make(WS_METHODS.nilusListTasks, {
  payload: NilusListTasksInput,
  success: Schema.Array(NilusTaskRecord),
  error: NilusReadError,
});

export const WsNilusGetTaskContextRpc = Rpc.make(WS_METHODS.nilusGetTaskContext, {
  payload: NilusTaskContextInput,
  success: NilusTaskContext,
  error: NilusReadError,
});

export const WsNilusListDomainEntriesRpc = Rpc.make(WS_METHODS.nilusListDomainEntries, {
  payload: NilusListDomainEntriesInput,
  success: NilusListDomainEntriesResult,
  error: NilusReadError,
});

export const WsNilusReadDocumentRpc = Rpc.make(WS_METHODS.nilusReadDocument, {
  payload: NilusReadDocumentInput,
  success: NilusDocument,
  error: NilusReadError,
});

export const WsNilusPrepareTaskCompletionRpc = Rpc.make(WS_METHODS.nilusPrepareTaskCompletion, {
  payload: NilusPrepareTaskCompletionInput,
  success: NilusTaskCompletionPreview,
  error: NilusReadError,
});

export const WsNilusCompleteTaskRpc = Rpc.make(WS_METHODS.nilusCompleteTask, {
  payload: NilusCompleteTaskInput,
  success: NilusCompleteTaskResult,
  error: NilusReadError,
});

export const WsNilusPrepareTaskDraftRpc = Rpc.make(WS_METHODS.nilusPrepareTaskDraft, {
  payload: NilusTaskDraftInput,
  success: NilusTaskDraftPreview,
  error: NilusReadError,
});

export const WsNilusCreateTaskRpc = Rpc.make(WS_METHODS.nilusCreateTask, {
  payload: NilusCreateTaskInput,
  success: NilusCreateTaskResult,
  error: NilusReadError,
});

export const WsNilusPrepareTalkNoteRpc = Rpc.make(WS_METHODS.nilusPrepareTalkNote, {
  payload: NilusTalkNoteDraftInput,
  success: NilusTalkNotePreview,
  error: NilusReadError,
});

export const WsNilusCreateTalkNoteRpc = Rpc.make(WS_METHODS.nilusCreateTalkNote, {
  payload: NilusCreateTalkNoteInput,
  success: NilusCreateTalkNoteResult,
  error: NilusReadError,
});

export const WsNilusPreparePartnerDraftRpc = Rpc.make(WS_METHODS.nilusPreparePartnerDraft, {
  payload: NilusPartnerDraftInput,
  success: NilusMemoryMutationPreview,
  error: NilusReadError,
});

export const WsNilusCreatePartnerRpc = Rpc.make(WS_METHODS.nilusCreatePartner, {
  payload: NilusPartnerDraftInput,
  success: NilusMemoryMutationResult,
  error: NilusReadError,
});

export const WsNilusPreparePartnerUpdateRpc = Rpc.make(WS_METHODS.nilusPreparePartnerUpdate, {
  payload: NilusPartnerUpdateInput,
  success: NilusMemoryMutationPreview,
  error: NilusReadError,
});

export const WsNilusUpdatePartnerRpc = Rpc.make(WS_METHODS.nilusUpdatePartner, {
  payload: NilusPartnerUpdateInput,
  success: NilusMemoryMutationResult,
  error: NilusReadError,
});

export const WsNilusPrepareIssueDraftRpc = Rpc.make(WS_METHODS.nilusPrepareIssueDraft, {
  payload: NilusIssueDraftInput,
  success: NilusMemoryMutationPreview,
  error: NilusReadError,
});

export const WsNilusCreateIssueRpc = Rpc.make(WS_METHODS.nilusCreateIssue, {
  payload: NilusIssueDraftInput,
  success: NilusMemoryMutationResult,
  error: NilusReadError,
});

export const WsNilusPrepareIssueUpdateRpc = Rpc.make(WS_METHODS.nilusPrepareIssueUpdate, {
  payload: NilusIssueUpdateInput,
  success: NilusMemoryMutationPreview,
  error: NilusReadError,
});

export const WsNilusUpdateIssueRpc = Rpc.make(WS_METHODS.nilusUpdateIssue, {
  payload: NilusIssueUpdateInput,
  success: NilusMemoryMutationResult,
  error: NilusReadError,
});

export const WsShellOpenInEditorRpc = Rpc.make(WS_METHODS.shellOpenInEditor, {
  payload: OpenInEditorInput,
  error: OpenError,
});

export const WsFilesystemBrowseRpc = Rpc.make(WS_METHODS.filesystemBrowse, {
  payload: FilesystemBrowseInput,
  success: FilesystemBrowseResult,
  error: FilesystemBrowseError,
});

export const WsSubscribeGitStatusRpc = Rpc.make(WS_METHODS.subscribeGitStatus, {
  payload: GitStatusInput,
  success: GitStatusStreamEvent,
  error: GitManagerServiceError,
  stream: true,
});

export const WsGitPullRpc = Rpc.make(WS_METHODS.gitPull, {
  payload: GitPullInput,
  success: GitPullResult,
  error: GitCommandError,
});

export const WsGitRefreshStatusRpc = Rpc.make(WS_METHODS.gitRefreshStatus, {
  payload: GitStatusInput,
  success: GitStatusResult,
  error: GitManagerServiceError,
});

export const WsGitRunStackedActionRpc = Rpc.make(WS_METHODS.gitRunStackedAction, {
  payload: GitRunStackedActionInput,
  success: GitActionProgressEvent,
  error: GitManagerServiceError,
  stream: true,
});

export const WsGitResolvePullRequestRpc = Rpc.make(WS_METHODS.gitResolvePullRequest, {
  payload: GitPullRequestRefInput,
  success: GitResolvePullRequestResult,
  error: GitManagerServiceError,
});

export const WsGitPreparePullRequestThreadRpc = Rpc.make(WS_METHODS.gitPreparePullRequestThread, {
  payload: GitPreparePullRequestThreadInput,
  success: GitPreparePullRequestThreadResult,
  error: GitManagerServiceError,
});

export const WsGitListBranchesRpc = Rpc.make(WS_METHODS.gitListBranches, {
  payload: GitListBranchesInput,
  success: GitListBranchesResult,
  error: GitCommandError,
});

export const WsGitCreateWorktreeRpc = Rpc.make(WS_METHODS.gitCreateWorktree, {
  payload: GitCreateWorktreeInput,
  success: GitCreateWorktreeResult,
  error: GitCommandError,
});

export const WsGitRemoveWorktreeRpc = Rpc.make(WS_METHODS.gitRemoveWorktree, {
  payload: GitRemoveWorktreeInput,
  error: GitCommandError,
});

export const WsGitCreateBranchRpc = Rpc.make(WS_METHODS.gitCreateBranch, {
  payload: GitCreateBranchInput,
  success: GitCreateBranchResult,
  error: GitCommandError,
});

export const WsGitCheckoutRpc = Rpc.make(WS_METHODS.gitCheckout, {
  payload: GitCheckoutInput,
  success: GitCheckoutResult,
  error: GitCommandError,
});

export const WsGitInitRpc = Rpc.make(WS_METHODS.gitInit, {
  payload: GitInitInput,
  error: GitCommandError,
});

export const WsTerminalOpenRpc = Rpc.make(WS_METHODS.terminalOpen, {
  payload: TerminalOpenInput,
  success: TerminalSessionSnapshot,
  error: TerminalError,
});

export const WsTerminalWriteRpc = Rpc.make(WS_METHODS.terminalWrite, {
  payload: TerminalWriteInput,
  error: TerminalError,
});

export const WsTerminalResizeRpc = Rpc.make(WS_METHODS.terminalResize, {
  payload: TerminalResizeInput,
  error: TerminalError,
});

export const WsTerminalClearRpc = Rpc.make(WS_METHODS.terminalClear, {
  payload: TerminalClearInput,
  error: TerminalError,
});

export const WsTerminalRestartRpc = Rpc.make(WS_METHODS.terminalRestart, {
  payload: TerminalRestartInput,
  success: TerminalSessionSnapshot,
  error: TerminalError,
});

export const WsTerminalCloseRpc = Rpc.make(WS_METHODS.terminalClose, {
  payload: TerminalCloseInput,
  error: TerminalError,
});

export const WsOrchestrationDispatchCommandRpc = Rpc.make(
  ORCHESTRATION_WS_METHODS.dispatchCommand,
  {
    payload: ClientOrchestrationCommand,
    success: OrchestrationRpcSchemas.dispatchCommand.output,
    error: OrchestrationDispatchCommandError,
  },
);

export const WsOrchestrationGetTurnDiffRpc = Rpc.make(ORCHESTRATION_WS_METHODS.getTurnDiff, {
  payload: OrchestrationGetTurnDiffInput,
  success: OrchestrationRpcSchemas.getTurnDiff.output,
  error: OrchestrationGetTurnDiffError,
});

export const WsOrchestrationGetFullThreadDiffRpc = Rpc.make(
  ORCHESTRATION_WS_METHODS.getFullThreadDiff,
  {
    payload: OrchestrationGetFullThreadDiffInput,
    success: OrchestrationRpcSchemas.getFullThreadDiff.output,
    error: OrchestrationGetFullThreadDiffError,
  },
);

export const WsOrchestrationReplayEventsRpc = Rpc.make(ORCHESTRATION_WS_METHODS.replayEvents, {
  payload: OrchestrationReplayEventsInput,
  success: OrchestrationRpcSchemas.replayEvents.output,
  error: OrchestrationReplayEventsError,
});

export const WsOrchestrationSubscribeShellRpc = Rpc.make(ORCHESTRATION_WS_METHODS.subscribeShell, {
  payload: OrchestrationRpcSchemas.subscribeShell.input,
  success: OrchestrationRpcSchemas.subscribeShell.output,
  error: OrchestrationGetSnapshotError,
  stream: true,
});

export const WsOrchestrationSubscribeThreadRpc = Rpc.make(
  ORCHESTRATION_WS_METHODS.subscribeThread,
  {
    payload: OrchestrationRpcSchemas.subscribeThread.input,
    success: OrchestrationRpcSchemas.subscribeThread.output,
    error: OrchestrationGetSnapshotError,
    stream: true,
  },
);

export const WsSubscribeTerminalEventsRpc = Rpc.make(WS_METHODS.subscribeTerminalEvents, {
  payload: Schema.Struct({}),
  success: TerminalEvent,
  stream: true,
});

export const WsSubscribeServerConfigRpc = Rpc.make(WS_METHODS.subscribeServerConfig, {
  payload: Schema.Struct({}),
  success: ServerConfigStreamEvent,
  error: Schema.Union([KeybindingsConfigError, ServerSettingsError]),
  stream: true,
});

export const WsSubscribeServerLifecycleRpc = Rpc.make(WS_METHODS.subscribeServerLifecycle, {
  payload: Schema.Struct({}),
  success: ServerLifecycleStreamEvent,
  stream: true,
});

export const WsSubscribeAuthAccessRpc = Rpc.make(WS_METHODS.subscribeAuthAccess, {
  payload: Schema.Struct({}),
  success: AuthAccessStreamEvent,
  stream: true,
});

export const WsRpcGroup = RpcGroup.make(
  WsServerGetConfigRpc,
  WsServerRefreshProvidersRpc,
  WsServerUpsertKeybindingRpc,
  WsServerGetSettingsRpc,
  WsServerUpdateSettingsRpc,
  WsProjectsSearchEntriesRpc,
  WsProjectsWriteFileRpc,
  WsNilusGetStartupSnapshotRpc,
  WsNilusListTasksRpc,
  WsNilusGetTaskContextRpc,
  WsNilusListDomainEntriesRpc,
  WsNilusReadDocumentRpc,
  WsNilusPrepareTaskCompletionRpc,
  WsNilusCompleteTaskRpc,
  WsNilusPrepareTaskDraftRpc,
  WsNilusCreateTaskRpc,
  WsNilusPrepareTalkNoteRpc,
  WsNilusCreateTalkNoteRpc,
  WsNilusPreparePartnerDraftRpc,
  WsNilusCreatePartnerRpc,
  WsNilusPreparePartnerUpdateRpc,
  WsNilusUpdatePartnerRpc,
  WsNilusPrepareIssueDraftRpc,
  WsNilusCreateIssueRpc,
  WsNilusPrepareIssueUpdateRpc,
  WsNilusUpdateIssueRpc,
  WsShellOpenInEditorRpc,
  WsFilesystemBrowseRpc,
  WsSubscribeGitStatusRpc,
  WsGitPullRpc,
  WsGitRefreshStatusRpc,
  WsGitRunStackedActionRpc,
  WsGitResolvePullRequestRpc,
  WsGitPreparePullRequestThreadRpc,
  WsGitListBranchesRpc,
  WsGitCreateWorktreeRpc,
  WsGitRemoveWorktreeRpc,
  WsGitCreateBranchRpc,
  WsGitCheckoutRpc,
  WsGitInitRpc,
  WsTerminalOpenRpc,
  WsTerminalWriteRpc,
  WsTerminalResizeRpc,
  WsTerminalClearRpc,
  WsTerminalRestartRpc,
  WsTerminalCloseRpc,
  WsSubscribeTerminalEventsRpc,
  WsSubscribeServerConfigRpc,
  WsSubscribeServerLifecycleRpc,
  WsSubscribeAuthAccessRpc,
  WsOrchestrationDispatchCommandRpc,
  WsOrchestrationGetTurnDiffRpc,
  WsOrchestrationGetFullThreadDiffRpc,
  WsOrchestrationReplayEventsRpc,
  WsOrchestrationSubscribeShellRpc,
  WsOrchestrationSubscribeThreadRpc,
);

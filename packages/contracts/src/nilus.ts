import { Schema } from "effect";

import { NonNegativeInt, PositiveInt, TrimmedNonEmptyString } from "./baseSchemas";

export const NilusDomain = Schema.Literals(["talk", "partners", "issues", "knowledge"]);
export type NilusDomain = typeof NilusDomain.Type;

export const NilusTaskStatus = Schema.Literals(["open", "done"]);
export type NilusTaskStatus = typeof NilusTaskStatus.Type;

export const NilusTaskRecord = Schema.Struct({
  number: PositiveInt,
  status: NilusTaskStatus,
  priority: Schema.optional(TrimmedNonEmptyString),
  createdAt: TrimmedNonEmptyString,
  completedAt: Schema.NullOr(TrimmedNonEmptyString),
  description: TrimmedNonEmptyString,
  project: Schema.NullOr(TrimmedNonEmptyString),
  owner: Schema.NullOr(TrimmedNonEmptyString),
  thread: Schema.NullOr(TrimmedNonEmptyString),
  recur: Schema.NullOr(TrimmedNonEmptyString),
  after: Schema.NullOr(TrimmedNonEmptyString),
  waiting: Schema.NullOr(TrimmedNonEmptyString),
  raw: TrimmedNonEmptyString,
});
export type NilusTaskRecord = typeof NilusTaskRecord.Type;

export const NilusStartupSnapshotInput = Schema.Struct({
  repoRoot: TrimmedNonEmptyString,
});
export type NilusStartupSnapshotInput = typeof NilusStartupSnapshotInput.Type;

export const NilusDomainCounts = Schema.Struct({
  talk: NonNegativeInt,
  partners: NonNegativeInt,
  issues: NonNegativeInt,
  knowledge: NonNegativeInt,
});
export type NilusDomainCounts = typeof NilusDomainCounts.Type;

export const NilusStartupSnapshot = Schema.Struct({
  repoRoot: TrimmedNonEmptyString,
  repoName: TrimmedNonEmptyString,
  branch: Schema.NullOr(TrimmedNonEmptyString),
  openTaskCount: NonNegativeInt,
  doneTaskCount: NonNegativeInt,
  domainCounts: NilusDomainCounts,
  topTasks: Schema.Array(NilusTaskRecord),
});
export type NilusStartupSnapshot = typeof NilusStartupSnapshot.Type;

export const NilusListTasksInput = Schema.Struct({
  repoRoot: TrimmedNonEmptyString,
  status: Schema.optional(NilusTaskStatus),
  limit: Schema.optional(PositiveInt),
});
export type NilusListTasksInput = typeof NilusListTasksInput.Type;

export const NilusDomainEntry = Schema.Struct({
  path: TrimmedNonEmptyString,
  title: TrimmedNonEmptyString,
  updatedAt: Schema.NullOr(TrimmedNonEmptyString),
  preview: Schema.NullOr(TrimmedNonEmptyString),
});
export type NilusDomainEntry = typeof NilusDomainEntry.Type;

export const NilusListDomainEntriesInput = Schema.Struct({
  repoRoot: TrimmedNonEmptyString,
  domain: NilusDomain,
  limit: Schema.optional(PositiveInt),
});
export type NilusListDomainEntriesInput = typeof NilusListDomainEntriesInput.Type;

export const NilusListDomainEntriesResult = Schema.Struct({
  domain: NilusDomain,
  entries: Schema.Array(NilusDomainEntry),
});
export type NilusListDomainEntriesResult = typeof NilusListDomainEntriesResult.Type;

export const NilusReadDocumentInput = Schema.Struct({
  repoRoot: TrimmedNonEmptyString,
  path: TrimmedNonEmptyString,
});
export type NilusReadDocumentInput = typeof NilusReadDocumentInput.Type;

export const NilusDocument = Schema.Struct({
  domain: NilusDomain,
  path: TrimmedNonEmptyString,
  title: TrimmedNonEmptyString,
  updatedAt: Schema.NullOr(TrimmedNonEmptyString),
  contents: Schema.String,
});
export type NilusDocument = typeof NilusDocument.Type;

export const NilusTaskContextInput = Schema.Struct({
  repoRoot: TrimmedNonEmptyString,
  taskNumber: PositiveInt,
});
export type NilusTaskContextInput = typeof NilusTaskContextInput.Type;

export const NilusTaskContextDocument = Schema.Struct({
  path: TrimmedNonEmptyString,
  title: TrimmedNonEmptyString,
  domain: NilusDomain,
});
export type NilusTaskContextDocument = typeof NilusTaskContextDocument.Type;

export const NilusTaskContextCommit = Schema.Struct({
  hash: TrimmedNonEmptyString,
  subject: TrimmedNonEmptyString,
});
export type NilusTaskContextCommit = typeof NilusTaskContextCommit.Type;

export const NilusTaskContext = Schema.Struct({
  task: NilusTaskRecord,
  continuityThread: Schema.NullOr(TrimmedNonEmptyString),
  projects: Schema.Array(TrimmedNonEmptyString),
  relatedOpenTasks: Schema.Array(NilusTaskRecord),
  recentDoneTasks: Schema.Array(NilusTaskRecord),
  relatedDocuments: Schema.Array(NilusTaskContextDocument),
  recentCommits: Schema.Array(NilusTaskContextCommit),
});
export type NilusTaskContext = typeof NilusTaskContext.Type;

export const NilusPrepareTaskCompletionInput = Schema.Struct({
  repoRoot: TrimmedNonEmptyString,
  taskNumber: PositiveInt,
});
export type NilusPrepareTaskCompletionInput = typeof NilusPrepareTaskCompletionInput.Type;

export const NilusTaskCompletionPreview = Schema.Struct({
  task: NilusTaskRecord,
  completedLine: TrimmedNonEmptyString,
  nextTaskLine: Schema.NullOr(TrimmedNonEmptyString),
  affectedFiles: Schema.Array(TrimmedNonEmptyString),
});
export type NilusTaskCompletionPreview = typeof NilusTaskCompletionPreview.Type;

export const NilusCompleteTaskInput = Schema.Struct({
  repoRoot: TrimmedNonEmptyString,
  taskNumber: PositiveInt,
});
export type NilusCompleteTaskInput = typeof NilusCompleteTaskInput.Type;

export const NilusCompleteTaskResult = Schema.Struct({
  completedLine: TrimmedNonEmptyString,
  nextTaskLine: Schema.NullOr(TrimmedNonEmptyString),
  affectedFiles: Schema.Array(TrimmedNonEmptyString),
});
export type NilusCompleteTaskResult = typeof NilusCompleteTaskResult.Type;

export const NilusTaskDraftInput = Schema.Struct({
  repoRoot: TrimmedNonEmptyString,
  description: TrimmedNonEmptyString,
  priority: Schema.optional(TrimmedNonEmptyString),
  project: Schema.optional(TrimmedNonEmptyString),
  owner: Schema.optional(TrimmedNonEmptyString),
  thread: Schema.optional(TrimmedNonEmptyString),
  recur: Schema.optional(TrimmedNonEmptyString),
  after: Schema.optional(TrimmedNonEmptyString),
  waiting: Schema.optional(TrimmedNonEmptyString),
});
export type NilusTaskDraftInput = typeof NilusTaskDraftInput.Type;

export const NilusTaskDraftPreview = Schema.Struct({
  line: TrimmedNonEmptyString,
  affectedFiles: Schema.Array(TrimmedNonEmptyString),
});
export type NilusTaskDraftPreview = typeof NilusTaskDraftPreview.Type;

export const NilusCreateTaskInput = NilusTaskDraftInput;
export type NilusCreateTaskInput = typeof NilusCreateTaskInput.Type;

export const NilusCreateTaskResult = Schema.Struct({
  line: TrimmedNonEmptyString,
  taskNumber: PositiveInt,
  affectedFiles: Schema.Array(TrimmedNonEmptyString),
});
export type NilusCreateTaskResult = typeof NilusCreateTaskResult.Type;

export const NilusCommitSafety = Schema.Literals(["safe_direct", "review_preferred", "blocked"]);
export type NilusCommitSafety = typeof NilusCommitSafety.Type;

export const NilusPartnerSection = Schema.Literals(["History", "Known Issues", "TODO", "Related"]);
export type NilusPartnerSection = typeof NilusPartnerSection.Type;

export const NilusIssueSection = Schema.Literals([
  "Symptoms",
  "Root Cause",
  "Resolution",
  "Affected Partners",
  "Related",
]);
export type NilusIssueSection = typeof NilusIssueSection.Type;

export const NilusMemoryMutationPreview = Schema.Struct({
  domain: Schema.Literals(["partners", "issues"]),
  mode: Schema.Literals(["create", "update"]),
  path: TrimmedNonEmptyString,
  title: TrimmedNonEmptyString,
  contents: Schema.String,
  affectedFiles: Schema.Array(TrimmedNonEmptyString),
  warnings: Schema.Array(TrimmedNonEmptyString),
  commitSafety: NilusCommitSafety,
});
export type NilusMemoryMutationPreview = typeof NilusMemoryMutationPreview.Type;

export const NilusMemoryMutationResult = NilusMemoryMutationPreview;
export type NilusMemoryMutationResult = typeof NilusMemoryMutationResult.Type;

export const NilusPartnerDraftInput = Schema.Struct({
  repoRoot: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  slug: Schema.optional(TrimmedNonEmptyString),
  primarySite: Schema.optional(TrimmedNonEmptyString),
  owner: Schema.optional(TrimmedNonEmptyString),
  status: Schema.optional(TrimmedNonEmptyString),
  lastReviewed: Schema.optional(TrimmedNonEmptyString),
  historyNote: Schema.optional(TrimmedNonEmptyString),
});
export type NilusPartnerDraftInput = typeof NilusPartnerDraftInput.Type;

export const NilusPartnerUpdateInput = Schema.Struct({
  repoRoot: TrimmedNonEmptyString,
  path: TrimmedNonEmptyString,
  section: NilusPartnerSection,
  entry: TrimmedNonEmptyString,
});
export type NilusPartnerUpdateInput = typeof NilusPartnerUpdateInput.Type;

export const NilusIssueDraftInput = Schema.Struct({
  repoRoot: TrimmedNonEmptyString,
  title: TrimmedNonEmptyString,
  slug: Schema.optional(TrimmedNonEmptyString),
  symptoms: Schema.optional(TrimmedNonEmptyString),
  rootCause: Schema.optional(TrimmedNonEmptyString),
  resolution: Schema.optional(TrimmedNonEmptyString),
});
export type NilusIssueDraftInput = typeof NilusIssueDraftInput.Type;

export const NilusIssueUpdateInput = Schema.Struct({
  repoRoot: TrimmedNonEmptyString,
  path: TrimmedNonEmptyString,
  section: NilusIssueSection,
  entry: TrimmedNonEmptyString,
});
export type NilusIssueUpdateInput = typeof NilusIssueUpdateInput.Type;

export const NilusTalkNoteDraftInput = Schema.Struct({
  repoRoot: TrimmedNonEmptyString,
  draftId: TrimmedNonEmptyString,
  topic: TrimmedNonEmptyString,
  body: TrimmedNonEmptyString,
  project: Schema.optional(TrimmedNonEmptyString),
  thread: Schema.optional(TrimmedNonEmptyString),
  refs: Schema.optional(Schema.Array(TrimmedNonEmptyString)),
});
export type NilusTalkNoteDraftInput = typeof NilusTalkNoteDraftInput.Type;

export const NilusTalkNotePreview = Schema.Struct({
  path: TrimmedNonEmptyString,
  title: TrimmedNonEmptyString,
  contents: Schema.String,
  affectedFiles: Schema.Array(TrimmedNonEmptyString),
  warnings: Schema.Array(TrimmedNonEmptyString),
  commitSafety: NilusCommitSafety,
});
export type NilusTalkNotePreview = typeof NilusTalkNotePreview.Type;

export const NilusCreateTalkNoteInput = NilusTalkNoteDraftInput;
export type NilusCreateTalkNoteInput = typeof NilusCreateTalkNoteInput.Type;

export const NilusCreateTalkNoteResult = Schema.Struct({
  path: TrimmedNonEmptyString,
  title: TrimmedNonEmptyString,
  contents: Schema.String,
  affectedFiles: Schema.Array(TrimmedNonEmptyString),
  warnings: Schema.Array(TrimmedNonEmptyString),
  commitSafety: NilusCommitSafety,
});
export type NilusCreateTalkNoteResult = typeof NilusCreateTalkNoteResult.Type;

export class NilusReadError extends Schema.TaggedErrorClass<NilusReadError>()("NilusReadError", {
  message: TrimmedNonEmptyString,
  cause: Schema.optional(Schema.Defect),
}) {}

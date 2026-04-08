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

export class NilusReadError extends Schema.TaggedErrorClass<NilusReadError>()("NilusReadError", {
  message: TrimmedNonEmptyString,
  cause: Schema.optional(Schema.Defect),
}) {}

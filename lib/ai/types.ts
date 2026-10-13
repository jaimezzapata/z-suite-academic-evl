export type GeminiModelVariant = "flash" | "pro";

export type ReadmeBatchMetadata = {
  subjectId: string;
  subjectName: string;
  groupId: string;
  groupName: string;
  momentId: string;
  momentName: string;
  questionCount: number;
  timeLimitMinutes: number;
  gradingScale: string;
  allowedQuestionTypes: string[];
};

export type ReadmeGroundingIndex = {
  normalizedFull: string;
  tokenSet: Set<string>;
};

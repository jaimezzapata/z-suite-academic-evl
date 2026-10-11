import type { CesdeGroupType } from "./catalog";

export type DriveWorkspaceRow = {
  id: string;
  institution: string;
  cesdeGroupType: CesdeGroupType | string;
  subjectId: string;
  subjectName: string;
  groupId: string;
  groupName: string;
  period: string;
  campus: string;
  jornada: string;
  dayOfWeek1: string;
  dayOfWeek2: string;
  startTime: string;
  endTime: string;
  day2StartTime: string;
  day2EndTime: string;
  weekCount: number;
  startDate: string;
  endDate: string;
  year: number;
  periodCode: string;
  health?: { broken?: boolean; issues?: unknown[]; lastCheckedAt?: unknown };
  drive: {
    groupFolderUrl?: string;
    adminFolderUrl?: string;
    publicFolderUrl?: string;
    groupFolderId?: string;
    adminFolderId?: string;
    publicFolderId?: string;
  };
  optimistic?: boolean;
};

export type DriveNodeRow = {
  pathKey: string;
  name: string;
  kind: string;
  driveFolderUrl: string;
  meta?: { week?: number };
};

export type DashboardCounts = {
  templatesTotal: number;
  templatesActive: number;
  publishedActive: number;
  publishedClosed: number;
  questionsTotal: number;
  questionsPublished: number;
  questionsDraft: number;
  questionsArchived: number;
  subjectsTotal: number;
  groupsTotal: number;
  fichasTotal: number;
  sitesTotal: number;
  shiftsTotal: number;
  momentsTotal: number;
  studyDocsActive: number;
  driveWorkspacesTotal: number;
  teachingLoadsTotal: number;
  teachingLoadsActive: number;
  teachingHoursTotal: number;
  teachingHoursCesde: number;
  teachingHoursSena: number;
  attemptsTotal: number;
  attemptsSubmitted: number;
  attemptsInProgress: number;
  attemptsFraudSubmitted: number;
  attemptsAnnulled: number;
};

export type DashboardData = {
  counts: DashboardCounts;
  activity14: { labels: string[]; values: number[] };
  gradeDist: { label: string; value: number }[];
  summary7: { avgGrade: number | null; fraudAttempts: number; submittedAttempts: number };
  topExams7: { exam: string; group: string; submissions: number; avg: string }[];
  latestAttempts: {
    when: string;
    exam: string;
    student: string;
    grade: string;
    status: string;
    fraud: number;
  }[];
};

export type TeachingLoadRow = {
  id: string;
  institution: string;
  cesdeGroupType: string;
  subjectName: string;
  audienceName: string;
  audienceType: string;
  siteName: string;
  shiftName: string;
  startDate: string;
  endDate: string;
  dayOfWeek1: string;
  dayOfWeek2: string;
  driveWorkspaceId: string;
  startTime: string;
  endTime: string;
  day2StartTime: string;
  day2EndTime: string;
  classroom: string;
  durationMinutes: number;
  academicHours: number;
  day2DurationMinutes: number;
  day2AcademicHours: number;
  active: boolean;
};

export type DriveWorkspaceRow = {
  id: string;
  institution: string;
  subjectName: string;
  groupName: string;
  period: string;
  campus: string;
  jornada: string;
  dayOfWeek1: string;
  dayOfWeek2: string;
  weekCount: number;
  healthBroken: boolean;
};

export type SessionItem = {
  id: string;
  startMinutes: number;
  endMinutes: number;
  timeLabel: string;
  subjectName: string;
  audienceName: string;
  institution: string;
  siteName: string;
  shiftName: string;
  classroom: string;
};

export type DayTimeline = {
  dateKey: string;
  weekdayLabel: string;
  dayLabel: string;
  holidayName: string | null;
  items: SessionItem[];
};

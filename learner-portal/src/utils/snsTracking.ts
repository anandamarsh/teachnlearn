export type SnsEventType =
  | "EXERCISE_STARTED"
  | "QUESTION_ANSWERED"
  | "EXERCISE_ENDED"
  | "ERROR_SERIOUS"
  | "ERROR_WARNING";

export type SnsSession = {
  sessionId: string;
  startTime: Date;
  details: {
    fullUrl: string;
    practiceDate: string;
    skillTitle: string;
    skillRef: string;
  };
};

type SnsScore = {
  questionsAnswered: { thisSession: number; previousSessions: number };
  skillScore: number;
  correctSoFar: number;
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const formatClockTime = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}`;
};

const formatPracticeDate = (date: Date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = MONTHS[date.getMonth()] ?? "Jan";
  return `${day}${month} ${date.getFullYear()}`;
};

const formatDuration = (durationMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes} min ${seconds} sec`;
};

const buildSessionId = () => {
  const randomToken = Math.random().toString(36).slice(2, 8);
  return `lp_${Date.now()}_${randomToken}`;
};

export const createSnsSession = (params: {
  skillTitle: string;
  skillRef: string;
  subject?: string | null;
  level?: string | null;
  fullUrl?: string;
}): SnsSession => {
  const now = new Date();
  const slugify = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const subjectSlug = params.subject ? slugify(params.subject) : "";
  const levelSlug = params.level ? slugify(params.level) : "";
  const titleSlug = params.skillTitle ? slugify(params.skillTitle) : "";
  const baseUrl = `${window.location.protocol}//${window.location.host}`;
  const computedUrl =
    subjectSlug && levelSlug && titleSlug
      ? `${baseUrl}/${subjectSlug}/${levelSlug}/${titleSlug}`
      : "";
  return {
    sessionId: buildSessionId(),
    startTime: now,
    details: {
      fullUrl: params.fullUrl ?? (computedUrl || window.location.href),
      practiceDate: formatPracticeDate(now),
      skillTitle: params.skillTitle,
      skillRef: params.skillRef,
    },
  };
};

export const buildSnsExerciseData = (params: {
  session: SnsSession;
  now: Date;
  score: SnsScore;
  correct?: boolean;
  ended?: boolean;
}) => {
  const { session, now, score, correct, ended } = params;
  return {
    sessionId: session.sessionId,
    details: session.details,
    time: {
      start: formatClockTime(session.startTime),
      end: ended ? formatClockTime(now) : null,
      timeSpent: {
        thisSession: formatDuration(now.getTime() - session.startTime.getTime()),
        previousSessions: "0 min 0 sec",
      },
    },
    score,
    ...(typeof correct === "boolean" ? { correct } : {}),
  };
};

type SnsInjectedApi = {
  questionAnswered?: (data: unknown) => void;
  exerciseStarted?: (data: unknown) => void;
  exerciseEnded?: (data: unknown) => void;
  showError?: (data: unknown) => void;
  showWarning?: (data: unknown) => void;
};

const getSnsApi = (): SnsInjectedApi => {
  const win = window as unknown as {
    sns?: SnsInjectedApi;
    SNS?: SnsInjectedApi;
    questionAnswered?: (data: unknown) => void;
    exerciseStarted?: (data: unknown) => void;
    exerciseEnded?: (data: unknown) => void;
    showError?: (data: unknown) => void;
    showWarning?: (data: unknown) => void;
  };
  return (
    win.sns ||
    win.SNS || {
      questionAnswered: win.questionAnswered,
      exerciseStarted: win.exerciseStarted,
      exerciseEnded: win.exerciseEnded,
      showError: win.showError,
      showWarning: win.showWarning,
    }
  );
};

export const emitSnsEvent = (type: SnsEventType, data: unknown) => {
  const api = getSnsApi();
  try {
    if (type === "QUESTION_ANSWERED") {
      api.questionAnswered?.(data);
      return;
    }
    if (type === "EXERCISE_STARTED") {
      api.exerciseStarted?.(data);
      return;
    }
    if (type === "EXERCISE_ENDED") {
      api.exerciseEnded?.(data);
      return;
    }
    if (type === "ERROR_SERIOUS") {
      api.showError?.(data);
      return;
    }
    if (type === "ERROR_WARNING") {
      api.showWarning?.(data);
    }
  } catch (_e) {
    // ignore injected handler failures
  }
};

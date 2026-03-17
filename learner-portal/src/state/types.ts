export type CatalogLesson = {
  id: string;
  title: string;
  status: string;
  subject?: string | null;
  level?: string | null;
  updated_at?: string;
  iconUrl?: string;
  teacher: string;
  content?: string | null;
  requiresLogin?: boolean | null;
  exerciseGenerator?: ExerciseGeneratorMeta | null;
  exerciseConfig?: ExerciseConfig | null;
  exerciseMode?: string | null;
  approvedQuestions?: ApprovedQuestionPage[] | null;
};

export type ApprovedQuestionPage = {
  title?: string | null;
  detectedPageNumber?: number | null;
  pageNumber?: number | null;
  questions?: string[] | null;
};

export type LessonSectionKey = string;

export type ExerciseConfig = {
  questionsPerExercise?: number | null;
  exercisesCount?: number | null;
};

export type ExerciseGeneratorMeta = {
  updatedAt?: string;
  filename?: string;
  contentLength?: number;
};

export type ExerciseStep = {
  step_html: string;
  step?: string;
  type: "fib" | "mcq";
  options?: string[];
  answer: string;
};

export type ExerciseItem = {
  type: string;
  promptTitle?: string;
  question_html: string;
  original?: boolean;
  diagram?: string;
  options?: string[];
  answer: string;
  formula_html?: string;
  steps?: ExerciseStep[];
  freeResponse?: boolean;
};

export type ExerciseStatus = "unattempted" | "correct" | "incorrect";
export type ExerciseResponseSaveState = "default" | "dirty" | "saved";

export type ResponseAttachment = {
  id: string;
  name: string;
  size: number;
  contentType?: string;
  storageKey?: string;
  url?: string;
};

export type ExerciseResponseRecord = {
  exerciseIndex: number;
  promptTitle?: string;
  questionHtml: string;
  answerMarkdown: string;
  teacherComment?: string;
  reviewStatus?: "approved" | "rejected" | null;
  attachments: ResponseAttachment[];
};

export type ExerciseStepProgress = {
  status: "unanswered" | "correct" | "correctPending" | "revealed";
  attempts: number;
  fibAnswer: string;
  mcqSelection: string;
  lastIncorrect: boolean;
};

export type ExerciseGuideState = {
  helpActive: boolean;
  stepIndex: number;
  steps: ExerciseStepProgress[];
  mainAttempts: number;
  mainLastIncorrect: boolean;
  mainPending: "none" | "incorrectPending";
  completed: boolean;
};

export type LessonProgress = {
  completed: Record<LessonSectionKey, boolean>;
  open: LessonSectionKey;
  exerciseStateBySection?: Record<string, ExerciseSectionState>;
  exerciseIndex?: number;
  maxExerciseIndex?: number;
  exerciseStatuses?: ExerciseStatus[];
  exerciseGuides?: ExerciseGuideState[];
  fibAnswers?: string[];
  mcqSelections?: string[];
  score?: ExerciseScoreSnapshot;
};

export type ExerciseScoreSnapshot = {
  questionsAnswered: { thisSession: number; previousSessions: number };
  skillScore: number;
  correctSoFar: number;
};

export type ExerciseSectionState = {
  exerciseIndex: number;
  maxExerciseIndex: number;
  exerciseStatuses: ExerciseStatus[];
  exerciseGuides: ExerciseGuideState[];
  fibAnswers: string[];
  mcqSelections: string[];
  scoreSnapshot: ExerciseScoreSnapshot;
};

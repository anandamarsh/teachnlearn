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
};

export type LessonSectionKey = string;

export type ExerciseStep = {
  step: string;
  type: "fib" | "mcq";
  options?: string[];
  answer: string;
};

export type ExerciseItem = {
  type: string;
  question_html: string;
  options?: string[];
  answer: string;
  steps?: ExerciseStep[];
};

export type ExerciseStatus = "unattempted" | "correct" | "incorrect";

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

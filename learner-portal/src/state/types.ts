export type CatalogLesson = {
  id: string;
  title: string;
  status: string;
  updated_at?: string;
  iconUrl?: string;
  teacher: string;
  content?: string | null;
};

export type LessonSectionKey = "lesson" | "references" | "exercises";

export type ExerciseItem = {
  type: string;
  question_html: string;
  options?: string[];
  answer: string;
};

export type ExerciseStatus = "unattempted" | "correct" | "incorrect";

export type LessonProgress = {
  completed: Record<LessonSectionKey, boolean>;
  open: LessonSectionKey;
  exerciseIndex?: number;
  exerciseStatuses?: ExerciseStatus[];
  fibAnswers?: string[];
  fibFeedbacks?: ({ correct: boolean; correctAnswer: string } | null)[];
  mcqSelections?: string[];
};

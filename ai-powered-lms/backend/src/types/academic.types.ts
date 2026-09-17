import {
  Difficulty,
  BloomsLevel,
  AssignmentStatus,
  EnrollmentStatus,
  ProcessingStatus,
  RecommendationType,
  RecommendationStatus,
} from "../generated/prisma/enums.js";

export {
  Difficulty,
  BloomsLevel,
  AssignmentStatus,
  EnrollmentStatus,
  ProcessingStatus,
  RecommendationType,
  RecommendationStatus,
};

export interface CreateCourseInput {
  code: string;
  title: string;
  description: string;
  department?: string;
  semester?: number;
  credits?: number;
  totalModules?: number;
  facultyId?: string;
}

export interface UpdateCourseInput {
  title?: string;
  description?: string;
  department?: string;
  semester?: number;
  credits?: number;
  totalModules?: number;
  facultyId?: string;
}

export interface CreateMaterialInput {
  title: string;
  unit: string;
  fileType?: string;
  fileSize?: string;
  fileUrl?: string;
}

export interface CreateAssignmentInput {
  title: string;
  description: string;
  dueDate: string | Date;
  totalPoints?: number;
}

export interface SubmitAssignmentInput {
  fileUrl?: string;
  content?: string;
}

export interface GradeSubmissionInput {
  score: number;
  feedback?: string;
}

export interface CreateQuizQuestionInput {
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  topic: string;
  difficulty?: Difficulty;
  bloomsLevel?: BloomsLevel;
  orderIndex?: number;
}

export interface CreateQuizInput {
  title: string;
  topic: string;
  difficulty?: Difficulty;
  timeLimitMinutes?: number;
  questions?: CreateQuizQuestionInput[];
  isAiGenerated?: boolean;
}

export interface GenerateQuizInput {
  courseId: string;
  topic: string;
  difficulty?: Difficulty;
  questionCount?: number;
  materialIds?: string[];
  saveImmediately?: boolean;
  timeLimitMinutes?: number;
}

export interface GeneratedQuestion {
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  bloomsLevel: BloomsLevel;
  difficulty: Difficulty;
  topic: string;
  sourceCitation: string;
}

export interface GenerateQuizResponseData {
  quizTitle: string;
  topic: string;
  difficulty: Difficulty;
  courseId: string;
  isGrounded: boolean;
  groundingNote: string;
  sources: Array<{
    documentName: string;
    materialId: string;
    unit: string;
    page: number | null;
    chunkId: string;
    similarity: number;
  }>;
  questions: GeneratedQuestion[];
  quiz?: any | null;
}

export interface SubmitQuizAttemptInput {
  timeSpentSeconds: number;
  answers: {
    questionId: string;
    selectedOptionIndex: number;
  }[];
}

export interface CreateAIConversationInput {
  courseId?: string;
  title?: string;
}

export interface PostAIMessageInput {
  content: string;
}

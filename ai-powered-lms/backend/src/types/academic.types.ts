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

export type UserRole = "STUDENT" | "FACULTY" | "ADMIN";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string | null;
  department?: string | null;
  enrollmentNo?: string | null;
  employeeId?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  description: string;
  department: string;
  semester: number;
  credits: number;
  totalModules: number;
  facultyId: string;
  faculty?: {
    id: string;
    name: string;
    email: string;
    department?: string;
    avatarUrl?: string | null;
  };
  enrollments?: any[];
  materials?: Material[];
  assignments?: Assignment[];
  quizzes?: Quiz[];
  _count?: {
    enrollments: number;
    materials: number;
    assignments: number;
    quizzes: number;
  };
  progressPercentage?: number;
}

export interface MaterialProgress {
  id: string;
  studentId: string;
  materialId: string;
  currentPage: number;
  totalPages: number;
  progressPercent: number;
  completed: boolean;
  lastOpenedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Material {
  id: string;
  courseId: string;
  title: string;
  unit: string;
  fileType: string;
  fileSize: string;
  fileUrl?: string;
  processingStatus: "PROCESSING" | "READY" | "FAILED";
  ragChunksCount: number;
  createdAt: string;
  progress?: MaterialProgress | null;
  course?: {
    id: string;
    code: string;
    title: string;
  };
}


export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  description: string;
  dueDate: string;
  totalPoints: number;
  createdAt: string;
  submissions?: Submission[];
  course?: {
    id: string;
    code: string;
    title: string;
  };
  _count?: {
    submissions: number;
  };
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  fileUrl?: string;
  content?: string;
  submittedAt: string;
  score?: number | null;
  feedback?: string | null;
  status: "PENDING" | "SUBMITTED" | "GRADED" | "OVERDUE";
  student?: {
    id: string;
    name: string;
    email: string;
    enrollmentNo?: string;
    avatarUrl?: string | null;
  };
  assignment?: Assignment;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctOptionIndex?: number;
  explanation?: string;
  topic: string;
  difficulty: "Easy" | "Medium" | "Hard";
  bloomsLevel: "Remember" | "Understand" | "Apply" | "Analyze" | "Evaluate";
  orderIndex: number;
}

export interface Quiz {
  id: string;
  courseId: string;
  title: string;
  topic: string;
  difficulty: "Easy" | "Medium" | "Hard";
  timeLimitMinutes: number;
  totalQuestions: number;
  isAiGenerated: boolean;
  published: boolean;
  createdAt: string;
  questions?: QuizQuestion[];
  course?: {
    id: string;
    code: string;
    title: string;
  };
  _count?: {
    attempts: number;
    questions: number;
  };
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  studentId: string;
  score: number;
  totalPoints: number;
  percentage: number;
  completedAt: string;
  timeSpentSeconds: number;
  weakTopicsIdentified: string[];
  quiz?: {
    id: string;
    title: string;
    topic: string;
    course?: {
      id: string;
      code: string;
      title: string;
    };
  };
  answers?: {
    id: string;
    questionId: string;
    selectedOptionIndex: number;
    isCorrect: boolean;
  }[];
}

export interface WeakTopic {
  id: string;
  courseId?: string;
  courseCode: string;
  topic: string;
  severity: "CRITICAL" | "MODERATE" | "IMPROVING";
  recommendedAction: string;
}

export interface Recommendation {
  id: string;
  studentId: string;
  courseId: string;
  title: string;
  topic: string;
  reason: string;
  type: "PDF_NOTE" | "QUIZ_RETEST" | "AI_PROMPT";
  estimatedMinutes: number;
  resourceId?: string | null;
  status: "ACTIVE" | "COMPLETED" | "DISMISSED";
  createdAt: string;
  course?: {
    id: string;
    code: string;
    title: string;
  };
}

export interface AIMessage {
  id: string;
  sender: "user" | "assistant";
  content: string;
  createdAt?: string;
  sources?: {
    documentName: string;
    page: number | null;
    unit: string;
    excerpt: string;
    score?: number;
    materialId?: string;
    chunkId?: string;
  }[];
  suggestedFollowUps?: string[];
}

export interface AIConversation {
  id: string;
  userId: string;
  courseId?: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
  course?: {
    id: string;
    code: string;
    title: string;
  };
  messages?: AIMessage[];
}

export interface AtRiskStudent {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  enrollmentNo: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
  primaryReason: string;
  averageQuizScore: number;
  courseProgressPercentage: number;
  recommendedIntervention: string;
}

import {
  User,
  Course,
  Material,
  Assignment,
  Quiz,
  WeakTopic,
  Recommendation,
  AIMessage,
  AtRiskStudent,
} from "./types";

export const MOCK_USER: User = {
  id: "student-1",
  name: "Harsh Vardhan",
  email: "harsh.ce@college.edu",
  role: "STUDENT",
  department: "Computer Engineering",
  enrollmentNo: "BE-2022-CS-104",
  createdAt: "2026-01-10T08:00:00.000Z",
};

export const MOCK_COURSES: Course[] = [
  {
    id: "course-1",
    code: "CS-401",
    title: "Distributed Systems & Cloud Computing",
    description: "Consensus protocols, Raft, Paxos, fault tolerance, and distributed state machines.",
    department: "Computer Engineering",
    semester: 8,
    credits: 4,
    totalModules: 5,
    facultyId: "faculty-1",
    progressPercentage: 65,
  },
  {
    id: "course-2",
    code: "CS-402",
    title: "Advanced Database Management Systems",
    description: "Query execution engines, B+ Trees, LSM Trees, concurrency control, and distributed transactions.",
    department: "Computer Engineering",
    semester: 8,
    credits: 4,
    totalModules: 5,
    facultyId: "faculty-1",
    progressPercentage: 45,
  },
];

export const MOCK_MATERIALS: Material[] = [
  {
    id: "mat-1",
    courseId: "course-1",
    title: "Unit 2: Raft Consensus & State Machine Replication",
    unit: "Unit 2",
    fileType: "pdf",
    fileSize: "4.2 MB",
    processingStatus: "READY",
    ragChunksCount: 48,
    createdAt: "2026-02-01T10:00:00.000Z",
  },
];

export const MOCK_ASSIGNMENTS: Assignment[] = [
  {
    id: "assign-1",
    courseId: "course-1",
    title: "Lab 2: Implement Leader Election in Raft",
    description: "Write RPC handlers for RequestVote and AppendEntries in Go or Python.",
    dueDate: "2026-03-01T23:59:59.000Z",
    totalPoints: 100,
    createdAt: "2026-02-10T08:00:00.000Z",
  },
];

export const MOCK_QUIZZES: Quiz[] = [
  {
    id: "quiz-1",
    courseId: "course-1",
    title: "Raft Algorithm Protocol Verification",
    topic: "Raft Consensus",
    difficulty: "Medium",
    timeLimitMinutes: 15,
    totalQuestions: 2,
    isAiGenerated: true,
    published: true,
    createdAt: "2026-02-12T09:00:00.000Z",
    questions: [
      {
        id: "q-1",
        question: "What is the minimum quorum required in Raft with N nodes to commit a log entry?",
        options: ["N/2 + 1 nodes (Majority)", "N nodes (Unanimous)", "1 node (Leader only)", "N/3 nodes"],
        correctOptionIndex: 0,
        explanation: "A majority quorum of N/2 + 1 is required to ensure overlapping quorums and prevent split-brain.",
        topic: "Raft Consensus",
        difficulty: "Medium",
        bloomsLevel: "Understand",
        orderIndex: 1,
      },
    ],
  },
];

export const MOCK_WEAK_TOPICS: WeakTopic[] = [
  {
    id: "wt-1",
    courseCode: "CS-401",
    topic: "Leader Election Split Vote Resolution",
    severity: "CRITICAL",
    recommendedAction: "Review randomized election timeouts in Section 5.2 of Raft paper.",
  },
];

export const MOCK_RECOMMENDATIONS: Recommendation[] = [
  {
    id: "rec-1",
    studentId: "student-1",
    courseId: "course-1",
    title: "Targeted Review: Raft Randomized Timeouts",
    topic: "Raft Consensus",
    reason: "Identified low score on election timer questions in recent assessment.",
    type: "PDF_NOTE",
    estimatedMinutes: 15,
    status: "ACTIVE",
    createdAt: "2026-02-15T12:00:00.000Z",
  },
];

export const MOCK_AI_MESSAGES: AIMessage[] = [
  {
    id: "msg-1",
    sender: "assistant",
    content: "Hello Harsh! How can I assist your study of Distributed Systems or Embedded Architecture today?",
  },
];

export const MOCK_AT_RISK_STUDENTS: AtRiskStudent[] = [
  {
    id: "risk-1",
    studentId: "student-1",
    studentName: "Harsh Vardhan",
    studentEmail: "harsh.ce@college.edu",
    enrollmentNo: "BE-2022-CS-104",
    courseId: "course-2",
    courseCode: "CS-402",
    courseTitle: "Advanced Database Management Systems",
    riskLevel: "HIGH",
    primaryReason: "Low quiz score (50%) on B+ Tree Split Invariants",
    averageQuizScore: 50,
    courseProgressPercentage: 40,
    recommendedIntervention: "Schedule tutorial session on B+ Tree internal node splitting algorithms.",
  },
];

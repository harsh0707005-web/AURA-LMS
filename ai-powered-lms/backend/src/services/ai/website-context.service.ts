import prisma from "../../lib/prisma.js";

export type WebsiteIntent =
  | "GREETING"
  | "WEBSITE_HELP"
  | "STUDENT_COURSES"
  | "STUDENT_WEAK_TOPICS"
  | "STUDENT_PROGRESS"
  | "STUDENT_ASSIGNMENTS"
  | "FACULTY_STUDENT_COUNT"
  | "FACULTY_WEAK_STUDENTS"
  | "FACULTY_COURSES"
  | "ADMIN_COUNTS";

export interface WebsiteContextResult {
  intent: WebsiteIntent;
  answer: string;
  suggestedFollowUps: string[];
}

const STUDENT_SUGGESTIONS = [
  "What courses am I currently enrolled in?",
  "What are my current weak topics?",
  "Why were these topics identified as weak areas?",
  "How is my progress across enrolled courses?",
  "What is my average quiz score?",
  "Which assignments have I submitted?",
  "What assignments or deadlines should I focus on?",
  "Which course should I study next?",
  "Create a study plan for my weak topics.",
  "What course materials should I review next?",
  "How can I use the AI Tutor effectively?",
  "What can I do in the AURA LMS website?",
];

const FACULTY_SUGGESTIONS = [
  "How many students are enrolled in my courses?",
  "How many students have weak-topic signals in my courses?",
  "Which courses do I currently teach?",
  "Show enrollment counts by my course.",
  "How many assignments have I posted?",
  "Which of my courses need instructional attention?",
  "What is the average quiz performance in my courses?",
  "How many submissions have my assignments received?",
  "Summarize my course materials and assessments.",
  "Which course has the most active enrollment?",
  "What can I do in the AURA LMS faculty workspace?",
  "How does the AI Tutor use course materials?",
];

const ADMIN_SUGGESTIONS = [
  "How many active students are in the system?",
  "How many active faculty members are in the system?",
  "How many courses are in the catalog?",
  "How many active enrollments exist?",
  "Show user counts by role.",
  "Which courses have the largest enrollment?",
  "How many faculty applications are pending?",
  "What is the overall assignment activity?",
  "What is the overall quiz activity?",
  "Summarize institutional academic activity.",
  "What can I do in the AURA LMS admin workspace?",
  "How does the AI Tutor protect course and student data?",
];

export async function resolveWebsiteContext(
  question: string,
  userId: string,
  role: string
): Promise<WebsiteContextResult | null> {
  const normalized = question.trim().toLowerCase();
  const intent = classifyWebsiteIntent(normalized, role);
  if (!intent) return null;

  if (intent === "GREETING") {
    return {
      intent,
      answer: greetingForRole(role),
      suggestedFollowUps: suggestionsForRole(role),
    };
  }

  if (intent === "WEBSITE_HELP") {
    return {
      intent,
      answer: helpForRole(role),
      suggestedFollowUps: suggestionsForRole(role),
    };
  }

  if (role === "STUDENT") {
    if (intent === "STUDENT_COURSES") return studentCourses(userId);
    if (intent === "STUDENT_WEAK_TOPICS") return studentWeakTopics(userId);
    if (intent === "STUDENT_PROGRESS") return studentProgress(userId);
    if (intent === "STUDENT_ASSIGNMENTS") return studentAssignments(userId);
  }

  if (role === "FACULTY") {
    if (intent === "FACULTY_STUDENT_COUNT") return facultyStudentCount(userId);
    if (intent === "FACULTY_WEAK_STUDENTS") return facultyWeakStudents(userId);
    if (intent === "FACULTY_COURSES") return facultyCourses(userId);
  }

  if (role === "ADMIN" && intent === "ADMIN_COUNTS") return adminCounts();

  return null;
}

function classifyWebsiteIntent(question: string, role: string): WebsiteIntent | null {
  if (/^(hi|hello|hey|good morning|good afternoon|good evening)(\s+tutor)?[!.? ]*$/i.test(question)) {
    return "GREETING";
  }
  if (/(what can you do|what can i ask|how can you help|what features|how does the ai tutor|how does this website work)/i.test(question)) {
    return "WEBSITE_HELP";
  }

  if (role === "STUDENT") {
    if (/(my courses|courses am i enrolled|currently enrolled|active courses|which courses do i have)/i.test(question)) return "STUDENT_COURSES";
    if (/(my weak topic|my weak area|weak topics? do i have|where am i struggling|my focus areas)/i.test(question)) return "STUDENT_WEAK_TOPICS";
    if (/(my progress|my average quiz|my quiz score|my performance|how am i doing|progress across (my|enrolled) courses)/i.test(question)) return "STUDENT_PROGRESS";
    if (/(my assignments|assignments have i|my deadlines|what assignments.*focus|what is due|what have i submitted)/i.test(question)) return "STUDENT_ASSIGNMENTS";
  }

  if (role === "FACULTY") {
    if (/(weak students?|at[- ]risk students?|struggling students?|students? need help|weak-topic signals in my courses)/i.test(question)) return "FACULTY_WEAK_STUDENTS";
    if (/(how many students.*(my|course)|student count.*(my|course)|enrollment counts? by my course|enrolled students in my)/i.test(question)) return "FACULTY_STUDENT_COUNT";
    if (/(my courses|courses do i teach|what courses do i teach|course count)/i.test(question)) return "FACULTY_COURSES";
  }

  if (role === "ADMIN" && /(active students? in the system|active faculty|user counts? by role|how many courses are in the catalog|active enrollments|system count|institutional|overall (assignment|quiz|academic)|largest enrollment)/i.test(question)) {
    return "ADMIN_COUNTS";
  }

  return null;
}

function suggestionsForRole(role: string): string[] {
  if (role === "FACULTY") return FACULTY_SUGGESTIONS;
  if (role === "ADMIN") return ADMIN_SUGGESTIONS;
  return STUDENT_SUGGESTIONS;
}

function greetingForRole(role: string): string {
  if (role === "FACULTY") return "Hello. I can summarize your assigned courses, enrollment, assignment activity, weak-topic signals, and authorized faculty analytics.";
  if (role === "ADMIN") return "Hello. I can provide authorized summaries of users, courses, enrollments, and academic activity across the AURA LMS.";
  return "Hello. I can help you with your enrolled courses, weak topics, progress, assignments, website features, and course-grounded study questions.";
}

function helpForRole(role: string): string {
  if (role === "FACULTY") return "The AURA LMS faculty workspace supports course management, materials, assignments, quizzes, submissions, analytics, and course-grounded AI tutoring. I can answer questions using only the faculty data you are authorized to view.";
  if (role === "ADMIN") return "The AURA LMS admin workspace supports authorized user, faculty, course, enrollment, and academic-activity oversight. I return aggregate summaries by default and do not expose private records through general questions.";
  return "The AURA LMS supports enrolled courses, course materials, assignments, quizzes, progress, weak-topic recommendations, and a course-grounded AI Tutor.";
}

async function studentCourses(userId: string): Promise<WebsiteContextResult> {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: userId, status: "ACTIVE" },
    select: { progressPercentage: true, course: { select: { code: true, title: true } } },
    orderBy: { course: { code: "asc" } },
  });
  const lines = enrollments.map((item) => `- ${item.course.code}: ${item.course.title} (${Math.round(item.progressPercentage)}% progress)`);
  return {
    intent: "STUDENT_COURSES",
    answer: lines.length > 0 ? `You are actively enrolled in ${lines.length} course${lines.length === 1 ? "" : "s"}:\n${lines.join("\n")}` : "You do not currently have any active course enrollments.",
    suggestedFollowUps: STUDENT_SUGGESTIONS,
  };
}

async function studentWeakTopics(userId: string): Promise<WebsiteContextResult> {
  const attempts = await prisma.quizAttempt.findMany({
    where: {
      studentId: userId,
      quiz: { course: { enrollments: { some: { studentId: userId, status: "ACTIVE" } } } },
    },
    select: { weakTopicsIdentified: true, quiz: { select: { course: { select: { code: true } } } } },
  });
  const topics = new Map<string, number>();
  for (const attempt of attempts) {
    for (const topic of attempt.weakTopicsIdentified) {
      const key = `${attempt.quiz.course.code}: ${topic}`;
      topics.set(key, (topics.get(key) || 0) + 1);
    }
  }
  const lines = Array.from(topics.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([topic, count]) => `- ${topic}${count > 1 ? ` (${count} signals)` : ""}`);
  return {
    intent: "STUDENT_WEAK_TOPICS",
    answer: lines.length > 0 ? `Your current weak-topic signals are:\n${lines.join("\n")}\n\nReview the related lecture materials and attempt targeted practice.` : "No weak-topic signals are currently recorded for your quiz attempts.",
    suggestedFollowUps: STUDENT_SUGGESTIONS,
  };
}

async function studentProgress(userId: string): Promise<WebsiteContextResult> {
  const [enrollments, attempts, submissions] = await Promise.all([
    prisma.enrollment.findMany({ where: { studentId: userId, status: "ACTIVE" }, select: { progressPercentage: true, course: { select: { code: true } } } }),
    prisma.quizAttempt.findMany({
      where: {
        studentId: userId,
        quiz: { course: { enrollments: { some: { studentId: userId, status: "ACTIVE" } } } },
      },
      select: { percentage: true },
    }),
    prisma.submission.count({
      where: {
        studentId: userId,
        assignment: { course: { enrollments: { some: { studentId: userId, status: "ACTIVE" } } } },
      },
    }),
  ]);
  const average = attempts.length > 0 ? Math.round(attempts.reduce((sum, item) => sum + item.percentage, 0) / attempts.length) : 0;
  const progress = enrollments.length > 0 ? Math.round(enrollments.reduce((sum, item) => sum + item.progressPercentage, 0) / enrollments.length) : 0;
  return {
    intent: "STUDENT_PROGRESS",
    answer: `Your current summary:\n- Active courses: ${enrollments.length}\n- Average course progress: ${progress}%\n- Average quiz score: ${average}%\n- Quiz attempts: ${attempts.length}\n- Assignment submissions: ${submissions}`,
    suggestedFollowUps: STUDENT_SUGGESTIONS,
  };
}

async function studentAssignments(userId: string): Promise<WebsiteContextResult> {
  const assignments = await prisma.assignment.findMany({
    where: { course: { enrollments: { some: { studentId: userId, status: "ACTIVE" } } } },
    select: { title: true, dueDate: true, course: { select: { code: true } }, submissions: { where: { studentId: userId }, select: { id: true, status: true } } },
    orderBy: { dueDate: "asc" },
    take: 10,
  });
  const lines = assignments.map((assignment) => `- ${assignment.course.code}: ${assignment.title} — ${assignment.submissions.length > 0 ? "submitted" : "not submitted"}`);
  return {
    intent: "STUDENT_ASSIGNMENTS",
    answer: lines.length > 0 ? `Your course assignments include:\n${lines.join("\n")}` : "No assignments are currently available in your active courses.",
    suggestedFollowUps: STUDENT_SUGGESTIONS,
  };
}

async function facultyCourses(userId: string): Promise<WebsiteContextResult> {
  const courses = await prisma.course.findMany({
    where: { facultyId: userId },
    select: { code: true, title: true, _count: { select: { enrollments: true, assignments: true, materials: true, quizzes: true } } },
    orderBy: { code: "asc" },
  });
  const lines = courses.map((course) => `- ${course.code}: ${course.title} (${course._count.enrollments} enrollments, ${course._count.materials} materials, ${course._count.assignments} assignments, ${course._count.quizzes} quizzes)`);
  return { intent: "FACULTY_COURSES", answer: lines.length > 0 ? `You currently teach ${lines.length} course${lines.length === 1 ? "" : "s"}:\n${lines.join("\n")}` : "You do not currently have assigned courses.", suggestedFollowUps: FACULTY_SUGGESTIONS };
}

async function facultyStudentCount(userId: string): Promise<WebsiteContextResult> {
  const enrollments = await prisma.enrollment.findMany({ where: { status: "ACTIVE", course: { facultyId: userId } }, select: { studentId: true, course: { select: { code: true } } }, distinct: ["studentId", "courseId"] });
  const distinctStudents = new Set(enrollments.map((item) => item.studentId)).size;
  const courseCounts = new Map<string, number>();
  for (const item of enrollments) courseCounts.set(item.course.code, (courseCounts.get(item.course.code) || 0) + 1);
  const lines = Array.from(courseCounts.entries()).map(([code, count]) => `- ${code}: ${count} active enrollments`);
  return { intent: "FACULTY_STUDENT_COUNT", answer: `Your courses have ${distinctStudents} distinct active student${distinctStudents === 1 ? "" : "s"} across ${courseCounts.size} course${courseCounts.size === 1 ? "" : "s"}.\n${lines.join("\n")}`, suggestedFollowUps: FACULTY_SUGGESTIONS };
}

async function facultyWeakStudents(userId: string): Promise<WebsiteContextResult> {
  const attempts = await prisma.quizAttempt.findMany({ where: { quiz: { course: { facultyId: userId } }, weakTopicsIdentified: { isEmpty: false } }, select: { studentId: true }, distinct: ["studentId"] });
  return { intent: "FACULTY_WEAK_STUDENTS", answer: `${attempts.length} distinct student${attempts.length === 1 ? " has" : "s have"} recorded at least one weak-topic signal in your courses. Use the authorized analytics workspace for the detailed course-level review.`, suggestedFollowUps: FACULTY_SUGGESTIONS };
}

async function adminCounts(): Promise<WebsiteContextResult> {
  const [students, faculty, courses, enrollments] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT", status: "ACTIVE" } }),
    prisma.user.count({ where: { role: "FACULTY", status: "ACTIVE" } }),
    prisma.course.count(),
    prisma.enrollment.count({ where: { status: "ACTIVE" } }),
  ]);
  return { intent: "ADMIN_COUNTS", answer: `Current authorized system summary:\n- Active students: ${students}\n- Active faculty: ${faculty}\n- Courses: ${courses}\n- Active enrollments: ${enrollments}`, suggestedFollowUps: ADMIN_SUGGESTIONS };
}

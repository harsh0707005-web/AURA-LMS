import "dotenv/config";
import bcrypt from "bcrypt";
import prisma from "../lib/prisma.js";

async function seed() {
  console.log("==========================================");
  console.log("AuraLMS Database Seed: Provisioning Academic Platform");
  console.log("==========================================");

  const defaultPassword = "Password123";
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  // 1. Users
  console.log("[SEED] Provisioning Users...");
  
  const studentUser = await prisma.user.upsert({
    where: { email: "harsh.ce@college.edu" },
    update: { passwordHash: hashedPassword },
    create: {
      name: "Harsh Vardhan",
      email: "harsh.ce@college.edu",
      passwordHash: hashedPassword,
      role: "STUDENT",
      department: "Computer Engineering",
      enrollmentNo: "BE-2022-CS-104",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    },
  });

  const studentUser2 = await prisma.user.upsert({
    where: { email: "ananya.ce@college.edu" },
    update: { passwordHash: hashedPassword },
    create: {
      name: "Ananya Roy",
      email: "ananya.ce@college.edu",
      passwordHash: hashedPassword,
      role: "STUDENT",
      department: "Computer Engineering",
      enrollmentNo: "BE-2022-CS-105",
      avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    },
  });

  const facultyUser1 = await prisma.user.upsert({
    where: { email: "dr.rajesh@college.edu" },
    update: { passwordHash: hashedPassword },
    create: {
      name: "Dr. Rajesh Sharma",
      email: "dr.rajesh@college.edu",
      passwordHash: hashedPassword,
      role: "FACULTY",
      department: "Computer Engineering",
      employeeId: "EMP-CS-042",
      avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
    },
  });

  const facultyUser2 = await prisma.user.upsert({
    where: { email: "priya.iyer@college.edu" },
    update: { passwordHash: hashedPassword },
    create: {
      name: "Prof. Priya Iyer",
      email: "priya.iyer@college.edu",
      passwordHash: hashedPassword,
      role: "FACULTY",
      department: "Computer Engineering",
      employeeId: "EMP-CS-058",
      avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: "admin.ce@college.edu" },
    update: { passwordHash: hashedPassword },
    create: {
      name: "Prof. S. K. Kulkarni (HOD)",
      email: "admin.ce@college.edu",
      passwordHash: hashedPassword,
      role: "ADMIN",
      department: "Computer Engineering",
      employeeId: "ADMIN-CE-001",
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    },
  });

  console.log(`[SEED] Users created: 2 Students, 2 Faculty, 1 Admin`);

  // 2. Courses
  console.log("[SEED] Provisioning Courses...");

  const course1 = await prisma.course.upsert({
    where: { code: "CS-401" },
    update: { facultyId: facultyUser1.id },
    create: {
      code: "CS-401",
      title: "Distributed Systems & Cloud Computing",
      description: "Fundamental concepts of distributed algorithms, consensus (Raft/Paxos), RPC protocols, fault tolerance, and microservices architecture.",
      department: "Computer Engineering",
      semester: 8,
      credits: 4,
      totalModules: 5,
      facultyId: facultyUser1.id,
    },
  });

  const course2 = await prisma.course.upsert({
    where: { code: "CS-402" },
    update: { facultyId: facultyUser2.id },
    create: {
      code: "CS-402",
      title: "Embedded Systems & Real-Time OS",
      description: "ARM architecture, memory-mapped I/O, interrupt servicing routines (ISRs), RTOS task scheduling algorithms, and FreeRTOS concurrency.",
      department: "Computer Engineering",
      semester: 8,
      credits: 4,
      totalModules: 6,
      facultyId: facultyUser2.id,
    },
  });

  const course3 = await prisma.course.upsert({
    where: { code: "CS-403" },
    update: { facultyId: facultyUser1.id },
    create: {
      code: "CS-403",
      title: "Advanced Database Management & Storage Engines",
      description: "B-Tree vs LSM trees, write-ahead logging (WAL), multi-version concurrency control (MVCC), query planner optimization, and sharding.",
      department: "Computer Engineering",
      semester: 8,
      credits: 4,
      totalModules: 5,
      facultyId: facultyUser1.id,
    },
  });

  const course4 = await prisma.course.upsert({
    where: { code: "CS-404" },
    update: { facultyId: facultyUser2.id },
    create: {
      code: "CS-404",
      title: "Machine Learning & Neural Architectures",
      description: "Supervised and unsupervised learning, gradient descent optimization, backpropagation mathematics, transformers, and evaluation metrics.",
      department: "Computer Engineering",
      semester: 8,
      credits: 4,
      totalModules: 6,
      facultyId: facultyUser2.id,
    },
  });

  console.log(`[SEED] Courses created: CS-401, CS-402, CS-403, CS-404`);

  // 3. Enrollments
  console.log("[SEED] Provisioning Enrollments...");

  await prisma.enrollment.upsert({
    where: { studentId_courseId: { studentId: studentUser.id, courseId: course1.id } },
    update: { progressPercentage: 72 },
    create: { studentId: studentUser.id, courseId: course1.id, progressPercentage: 72, status: "ACTIVE" },
  });

  await prisma.enrollment.upsert({
    where: { studentId_courseId: { studentId: studentUser.id, courseId: course2.id } },
    update: { progressPercentage: 65 },
    create: { studentId: studentUser.id, courseId: course2.id, progressPercentage: 65, status: "ACTIVE" },
  });

  await prisma.enrollment.upsert({
    where: { studentId_courseId: { studentId: studentUser.id, courseId: course3.id } },
    update: { progressPercentage: 88 },
    create: { studentId: studentUser.id, courseId: course3.id, progressPercentage: 88, status: "ACTIVE" },
  });

  await prisma.enrollment.upsert({
    where: { studentId_courseId: { studentId: studentUser.id, courseId: course4.id } },
    update: { progressPercentage: 45 },
    create: { studentId: studentUser.id, courseId: course4.id, progressPercentage: 45, status: "ACTIVE" },
  });

  await prisma.enrollment.upsert({
    where: { studentId_courseId: { studentId: studentUser2.id, courseId: course1.id } },
    update: { progressPercentage: 85 },
    create: { studentId: studentUser2.id, courseId: course1.id, progressPercentage: 85, status: "ACTIVE" },
  });

  await prisma.enrollment.upsert({
    where: { studentId_courseId: { studentId: studentUser2.id, courseId: course2.id } },
    update: { progressPercentage: 35 },
    create: { studentId: studentUser2.id, courseId: course2.id, progressPercentage: 35, status: "ACTIVE" },
  });

  // 4. Materials
  console.log("[SEED] Provisioning Course Materials...");

  const existingMaterials = await prisma.material.count();
  if (existingMaterials === 0) {
    await prisma.material.createMany({
      data: [
        {
          courseId: course1.id,
          title: "Unit 1: System Models, RPC & Inter-Process Communication",
          unit: "Unit 1",
          fileType: "pdf",
          fileSize: "3.2 MB",
          fileUrl: "/materials/cs401-unit1-rpc.pdf",
          processingStatus: "READY",
          ragChunksCount: 48,
        },
        {
          courseId: course1.id,
          title: "Unit 2: Consensus Protocols (Paxos vs Raft Comparison)",
          unit: "Unit 2",
          fileType: "pdf",
          fileSize: "4.1 MB",
          fileUrl: "/materials/cs401-unit2-consensus.pdf",
          processingStatus: "READY",
          ragChunksCount: 64,
        },
        {
          courseId: course2.id,
          title: "Unit 1: ARM Cortex-M Architecture & NVIC Interrupt Handling",
          unit: "Unit 1",
          fileType: "pdf",
          fileSize: "5.4 MB",
          fileUrl: "/materials/cs402-unit1-nvic.pdf",
          processingStatus: "READY",
          ragChunksCount: 82,
        },
        {
          courseId: course2.id,
          title: "Unit 2: FreeRTOS Task Synchronization & Priority Inversion",
          unit: "Unit 2",
          fileType: "pdf",
          fileSize: "2.8 MB",
          fileUrl: "/materials/cs402-unit2-freertos.pdf",
          processingStatus: "READY",
          ragChunksCount: 52,
        },
        {
          courseId: course3.id,
          title: "Unit 1: Storage Internals — B+ Trees vs LSM Trees",
          unit: "Unit 1",
          fileType: "pdf",
          fileSize: "3.7 MB",
          fileUrl: "/materials/cs403-unit1-storage.pdf",
          processingStatus: "READY",
          ragChunksCount: 55,
        },
        {
          courseId: course4.id,
          title: "Unit 1: Gradient Descent & Loss Function Formulations",
          unit: "Unit 1",
          fileType: "pdf",
          fileSize: "4.5 MB",
          fileUrl: "/materials/cs404-unit1-optimization.pdf",
          processingStatus: "READY",
          ragChunksCount: 70,
        },
      ],
    });
  }

  // 5. Assignments & Submissions
  console.log("[SEED] Provisioning Assignments & Submissions...");

  const existingAssignments = await prisma.assignment.count();
  if (existingAssignments === 0) {
    const a1 = await prisma.assignment.create({
      data: {
        courseId: course1.id,
        title: "Distributed Key-Value Store with Raft Consensus",
        description: "Implement a fault-tolerant replicated key-value state machine in Go or Java using the Raft consensus algorithm. Support Leader Election and Log Replication.",
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        totalPoints: 100,
      },
    });

    const a2 = await prisma.assignment.create({
      data: {
        courseId: course2.id,
        title: "FreeRTOS Priority Inheritance & Interrupt Service Lab",
        description: "Configure UART interrupt service routines on STM32 microcontrollers. Demonstrate priority ceiling protocol preventing unbounded priority inversion.",
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        totalPoints: 50,
      },
    });

    const a3 = await prisma.assignment.create({
      data: {
        courseId: course3.id,
        title: "PostgreSQL Query Execution Plan Optimization",
        description: "Analyze query execution plans using EXPLAIN ANALYZE. Optimize index scans with composite B-Tree indexes and partial indexing.",
        dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago (past)
        totalPoints: 100,
      },
    });

    // Submissions
    await prisma.submission.create({
      data: {
        assignmentId: a3.id,
        studentId: studentUser.id,
        fileUrl: "/submissions/harsh_cs403_query_plan.pdf",
        content: "Completed benchmark analysis of nested loop vs hash join scans.",
        score: 92,
        feedback: "Excellent query plan decomposition and indexing analysis.",
        status: "GRADED",
      },
    });

    await prisma.submission.create({
      data: {
        assignmentId: a2.id,
        studentId: studentUser.id,
        fileUrl: "/submissions/harsh_cs402_lab2.zip",
        content: "Implemented binary semaphore with priority inheritance protocol.",
        status: "SUBMITTED",
      },
    });
  }

  // 6. Quizzes & Questions
  console.log("[SEED] Provisioning Quizzes & Questions...");

  const existingQuizzes = await prisma.quiz.count();
  if (existingQuizzes === 0) {
    const q1 = await prisma.quiz.create({
      data: {
        courseId: course1.id,
        title: "Consensus Protocols & Fault Tolerance Quiz",
        topic: "Consensus Algorithms",
        difficulty: "Medium",
        timeLimitMinutes: 20,
        totalQuestions: 3,
        isAiGenerated: false,
        published: true,
        questions: {
          create: [
            {
              question: "In the Raft consensus algorithm, how does a candidate node transition into a leader?",
              options: [
                "By receiving votes from a majority (quorum) of cluster nodes in the current term",
                "By immediately incrementing its log index without waiting for replies",
                "By querying the previous term's leader directly via heartbeat",
                "By generating an asymmetric cryptographic token verified by clients",
              ],
              correctOptionIndex: 0,
              explanation: "Raft requires a candidate to secure votes from a strict majority (N/2 + 1) of cluster members in a given election term.",
              topic: "Raft Consensus",
              difficulty: "Medium",
              bloomsLevel: "Understand",
              orderIndex: 1,
            },
            {
              question: "What guarantees are provided by the CAP theorem for a distributed network partition (P)?",
              options: [
                "The system must choose between Consistency (C) and Availability (A)",
                "The system can achieve full Consistency and Availability simultaneously",
                "The network partition can be resolved without sacrificing latency",
                "Transactions can always achieve ACID compliance without rollback",
              ],
              correctOptionIndex: 0,
              explanation: "In the presence of a network partition (P), a distributed system can either yield consistent data (CP) or remain responsive (AP), but not both.",
              topic: "CAP Theorem",
              difficulty: "Medium",
              bloomsLevel: "Analyze",
              orderIndex: 2,
            },
            {
              question: "Which RPC semantic guarantees that an operation is executed at most once despite network packet retries?",
              options: [
                "At-most-once semantics with server duplicate filtering",
                "At-least-once semantics with infinite retries",
                "Best-effort asynchronous UDP broadcasting",
                "Fire-and-forget message queuing",
              ],
              correctOptionIndex: 0,
              explanation: "At-most-once semantics ensure requests with duplicate transaction IDs are filtered out by the server, preventing repeated execution.",
              topic: "RPC Semantics",
              difficulty: "Easy",
              bloomsLevel: "Remember",
              orderIndex: 3,
            },
          ],
        },
      },
    });

    const q2 = await prisma.quiz.create({
      data: {
        courseId: course2.id,
        title: "Interrupt Handling & RTOS Scheduling Assessment",
        topic: "Embedded Systems Concurrency",
        difficulty: "Hard",
        timeLimitMinutes: 15,
        totalQuestions: 2,
        isAiGenerated: true,
        published: true,
        questions: {
          create: [
            {
              question: "How does Priority Inversion occur in a pre-emptive Real-Time Operating System?",
              options: [
                "When a high-priority task is blocked waiting for a shared mutex held by a low-priority task, and a medium-priority task preempts the low-priority task",
                "When all tasks are given equal round-robin time slices regardless of criticality",
                "When an Interrupt Service Routine (ISR) takes longer than the SysTick timer duration",
                "When dynamic memory allocation causes heap fragmentation in real time",
              ],
              correctOptionIndex: 0,
              explanation: "Priority Inversion happens when medium-priority tasks prevent a low-priority task from releasing a lock that a high-priority task urgently requires.",
              topic: "Priority Inversion",
              difficulty: "Hard",
              bloomsLevel: "Analyze",
              orderIndex: 1,
            },
            {
              question: "What is the primary function of the Nested Vectored Interrupt Controller (NVIC) in ARM Cortex-M?",
              options: [
                "Hardware priority evaluation and deterministic, low-latency interrupt vectoring",
                "Virtual memory page table management and translation lookaside buffer (TLB) caching",
                "Instruction decoding for RISC branch prediction pipelines",
                "Software-level round-robin scheduling of RTOS user threads",
              ],
              correctOptionIndex: 0,
              explanation: "The NVIC in Cortex-M hardware manages interrupt priorities, nesting, and tail-chaining for sub-microsecond latency.",
              topic: "Interrupt Handling",
              difficulty: "Medium",
              bloomsLevel: "Understand",
              orderIndex: 2,
            },
          ],
        },
      },
    });

    // Quiz Attempt for student
    await prisma.quizAttempt.create({
      data: {
        quizId: q1.id,
        studentId: studentUser.id,
        score: 30,
        totalPoints: 30,
        percentage: 100,
        timeSpentSeconds: 420,
        weakTopicsIdentified: [],
      },
    });

    await prisma.quizAttempt.create({
      data: {
        quizId: q2.id,
        studentId: studentUser.id,
        score: 10,
        totalPoints: 20,
        percentage: 50,
        timeSpentSeconds: 650,
        weakTopicsIdentified: ["Priority Inversion", "Interrupt Handling"],
      },
    });
  }

  // 7. Performance & Recommendations
  console.log("[SEED] Provisioning Performance Metrics & Diagnostic Recommendations...");

  await prisma.performance.upsert({
    where: { studentId_courseId: { studentId: studentUser.id, courseId: course1.id } },
    update: { averageScore: 92, quizzesAttempted: 1, assignmentsSubmitted: 1 },
    create: {
      studentId: studentUser.id,
      courseId: course1.id,
      averageScore: 92,
      quizzesAttempted: 1,
      assignmentsSubmitted: 1,
    },
  });

  await prisma.performance.upsert({
    where: { studentId_courseId: { studentId: studentUser.id, courseId: course2.id } },
    update: { averageScore: 50, quizzesAttempted: 1, assignmentsSubmitted: 1 },
    create: {
      studentId: studentUser.id,
      courseId: course2.id,
      averageScore: 50,
      quizzesAttempted: 1,
      assignmentsSubmitted: 1,
    },
  });

  const existingRecs = await prisma.recommendation.count();
  if (existingRecs === 0) {
    await prisma.recommendation.create({
      data: {
        studentId: studentUser.id,
        courseId: course2.id,
        title: "Review Priority Inversion & Mutex Protocols",
        topic: "RTOS Concurrency",
        reason: "Scored 50% on Recent Embedded Systems Quiz on Priority Inversion question.",
        type: "PDF_NOTE",
        estimatedMinutes: 20,
        status: "ACTIVE",
      },
    });

    await prisma.recommendation.create({
      data: {
        studentId: studentUser.id,
        courseId: course2.id,
        title: "Practice Targeted Retest: NVIC Interrupt Servicing",
        topic: "ARM NVIC Architecture",
        reason: "Reinforce concept mastery of interrupt priority grouping before the midterm lab exam.",
        type: "QUIZ_RETEST",
        estimatedMinutes: 15,
        status: "ACTIVE",
      },
    });
  }

  console.log("==========================================");
  console.log("Database seed completed successfully.");
  console.log("==========================================");
}

seed()
  .catch((err) => {
    console.error("Database seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

import prisma from "../lib/prisma.js";
import { Role } from "../types/auth.types.js";

export interface CreateAnnouncementInput {
  title?: unknown;
  body?: unknown;
  courseId?: unknown;
}

function announcementError(message: string, statusCode = 400): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}

function cleanText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw announcementError(`${field} is required`);
  }
  const cleaned = value.trim();
  if (cleaned.length > maxLength) {
    throw announcementError(`${field} must be ${maxLength} characters or fewer`);
  }
  return cleaned;
}

export async function listAnnouncementsForUser(userId: string, role: Role) {
  const where = role === "ADMIN"
    ? {}
    : role === "FACULTY"
      ? { authorId: userId }
      : {
          OR: [
            { courseId: null },
            { course: { enrollments: { some: { studentId: userId, status: "ACTIVE" as const } } } },
          ],
        };

  return prisma.announcement.findMany({
    where,
    include: {
      course: { select: { id: true, code: true, title: true } },
      author: { select: { id: true, name: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function createAnnouncement(input: CreateAnnouncementInput, authorId: string, role: Role) {
  const title = cleanText(input.title, "Announcement title", 160);
  const body = cleanText(input.body, "Announcement message", 5000);
  const courseId = typeof input.courseId === "string" && input.courseId.trim()
    ? input.courseId.trim()
    : undefined;

  if (role === "FACULTY" && !courseId) {
    throw announcementError("Faculty announcements must target one of your courses");
  }

  if (courseId) {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw announcementError("Course not found", 404);
    if (role === "FACULTY" && course.facultyId !== authorId) {
      throw announcementError("You can only announce to courses you teach", 403);
    }
  }

  const announcement = await prisma.announcement.create({
    data: { title, body, courseId, authorId },
    include: {
      course: { select: { id: true, code: true, title: true } },
      author: { select: { id: true, name: true, role: true } },
    },
  });

  const recipients = courseId
    ? await prisma.enrollment.findMany({
        where: { courseId, status: "ACTIVE", student: { status: "ACTIVE", role: "STUDENT" } },
        select: { studentId: true },
      })
    : await prisma.user.findMany({
        where: { role: "STUDENT", status: "ACTIVE" },
        select: { id: true },
      });

  if (recipients.length > 0) {
    await prisma.notification.createMany({
      data: recipients.map((recipient) => ({
        userId: "studentId" in recipient ? recipient.studentId : recipient.id,
        announcementId: announcement.id,
        kind: "ANNOUNCEMENT",
        title,
        body,
        link: "/student/announcements",
      })),
      skipDuplicates: true,
    });
  }

  return announcement;
}

export async function listNotificationsForUser(userId: string) {
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      include: {
        announcement: {
          include: { course: { select: { id: true, code: true, title: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  return { items, unreadCount };
}

export async function markNotificationRead(notificationId: string, userId: string) {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  });
  if (result.count === 0) throw announcementError("Notification not found", 404);
  return { message: "Notification marked as read" };
}

export async function markAllNotificationsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { message: "Notifications marked as read", updatedCount: result.count };
}

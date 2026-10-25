import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../lib/prisma.js";
import { createAnnouncement, listAnnouncementsForUser } from "../services/announcement.service.js";

function replace(t: any, target: any, method: string, implementation: (...args: any[]) => any) {
  const original = target[method];
  target[method] = implementation;
  t.after(() => { target[method] = original; });
}

test("faculty announcements are limited to owned courses and notify active enrolled students", { concurrency: false }, async (t) => {
  const createdNotifications: any[] = [];
  replace(t, prisma.course, "findUnique", async () => ({ id: "course-1", facultyId: "faculty-1" }));
  replace(t, prisma.announcement, "create", async ({ data }: any) => ({
    id: "announcement-1",
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
    course: { id: "course-1", code: "CS-401", title: "Distributed Systems" },
    author: { id: "faculty-1", name: "Faculty", role: "FACULTY" },
  }));
  replace(t, prisma.enrollment, "findMany", async () => [{ studentId: "student-1" }, { studentId: "student-2" }]);
  replace(t, prisma.notification, "createMany", async ({ data }: any) => { createdNotifications.push(...data); return { count: data.length }; });

  const announcement = await createAnnouncement(
    { title: "Review session", body: "Please attend the review session.", courseId: "course-1" },
    "faculty-1",
    "FACULTY",
  );

  assert.equal(announcement.id, "announcement-1");
  assert.equal(createdNotifications.length, 2);
  assert.deepEqual(createdNotifications.map((item) => item.userId), ["student-1", "student-2"]);
  await assert.rejects(
    createAnnouncement({ title: "Other course", body: "Not allowed", courseId: "course-1" }, "faculty-2", "FACULTY"),
    { statusCode: 403 },
  );
});

test("students see institution announcements and announcements for active enrollments", { concurrency: false }, async (t) => {
  let capturedWhere: any;
  replace(t, prisma.announcement, "findMany", async (args: any) => { capturedWhere = args.where; return []; });
  await listAnnouncementsForUser("student-1", "STUDENT");
  assert.deepEqual(capturedWhere.OR[0], { courseId: null });
  assert.equal(capturedWhere.OR[1].course.enrollments.some.studentId, "student-1");
  assert.equal(capturedWhere.OR[1].course.enrollments.some.status, "ACTIVE");
});

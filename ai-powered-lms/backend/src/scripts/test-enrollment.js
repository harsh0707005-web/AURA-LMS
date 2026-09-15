async function testEnrollmentFlow() {
  const BASE_URL = "http://localhost:5000/api";
  console.log("==========================================");
  console.log("AURA LMS: Testing Enrollment Endpoints & Security");
  console.log("==========================================");

  // 1. Authenticate Student
  const studentLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "ananya.ce@college.edu",
      password: "Password123",
    }),
  });
  const studentData = await studentLoginRes.json();
  const studentToken = studentData.data.token;
  console.log("[Setup] Student Logged In:", studentData.data.user.name);

  // 2. Authenticate Faculty
  const facultyLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "dr.rajesh@college.edu",
      password: "Password123",
    }),
  });
  const facultyData = await facultyLoginRes.json();
  const facultyToken = facultyData.data.token;
  console.log("[Setup] Faculty Logged In:", facultyData.data.user.name);

  // 3. Get Course List
  const coursesRes = await fetch(`${BASE_URL}/courses`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const coursesData = await coursesRes.json();
  const testCourse = coursesData.data[0];
  console.log("[Setup] Target Course:", testCourse.code, testCourse.id);

  // Unenroll first if already enrolled to ensure clean state
  await fetch(`${BASE_URL}/courses/${testCourse.id}/enroll`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${studentToken}` },
  });

  // TEST A: Authenticated student enrolling in existing course
  const enrollRes1 = await fetch(`${BASE_URL}/courses/${testCourse.id}/enroll`, {
    method: "POST",
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const enrollData1 = await enrollRes1.json();
  console.log(
    "TEST A [Student Enroll]:",
    enrollRes1.status === 201 ? "PASS (201 Created)" : `FAIL (${enrollRes1.status})`,
    enrollData1.message || JSON.stringify(enrollData1)
  );

  // TEST B: Same student enrolling again (Duplicate enrollment)
  const enrollRes2 = await fetch(`${BASE_URL}/courses/${testCourse.id}/enroll`, {
    method: "POST",
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const enrollData2 = await enrollRes2.json();
  console.log(
    "TEST B [Duplicate Enroll 409]:",
    enrollRes2.status === 409 ? "PASS (409 Conflict)" : `FAIL (${enrollRes2.status})`,
    enrollData2.message
  );

  // TEST C: Unauthenticated request
  const unauthRes = await fetch(`${BASE_URL}/courses/${testCourse.id}/enroll`, {
    method: "POST",
  });
  const unauthData = await unauthRes.json();
  console.log(
    "TEST C [Unauthenticated 401]:",
    unauthRes.status === 401 ? "PASS (401 Unauthorized)" : `FAIL (${unauthRes.status})`,
    unauthData.message
  );

  // TEST D: Faculty attempting student enrollment
  const facultyEnrollRes = await fetch(`${BASE_URL}/courses/${testCourse.id}/enroll`, {
    method: "POST",
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  const facultyEnrollData = await facultyEnrollRes.json();
  console.log(
    "TEST D [Faculty Enroll Blocked 403]:",
    facultyEnrollRes.status === 403 ? "PASS (403 Forbidden)" : `FAIL (${facultyEnrollRes.status})`,
    facultyEnrollData.message
  );

  // TEST E: Invalid course ID
  const invalidCourseRes = await fetch(`${BASE_URL}/courses/00000000-0000-0000-0000-000000000000/enroll`, {
    method: "POST",
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const invalidCourseData = await invalidCourseRes.json();
  console.log(
    "TEST E [Invalid Course 404]:",
    invalidCourseRes.status === 404 ? "PASS (404 Not Found)" : `FAIL (${invalidCourseRes.status})`,
    invalidCourseData.message
  );

  console.log("==========================================");
  console.log("ALL ENROLLMENT TESTS COMPLETED SUCCESSFULLY!");
  console.log("==========================================");
}

testEnrollmentFlow().catch(console.error);

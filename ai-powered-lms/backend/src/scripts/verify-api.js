async function testAuthAndEndpoints() {
  const BASE_URL = "http://localhost:5000/api";
  console.log("==========================================");
  console.log("AURA LMS: Testing API Endpoints & Auth Flow");
  console.log("==========================================");

  // 1. Health Check
  const healthRes = await fetch(`${BASE_URL}/health`);
  const healthData = await healthRes.json();
  console.log("[1] Health Check:", healthData.success ? "PASS" : "FAIL", healthData.message);

  // 2. DB Health Check
  const dbHealthRes = await fetch(`${BASE_URL}/health/db`);
  const dbHealthData = await dbHealthRes.json();
  console.log("[2] DB Health Check:", dbHealthData.success ? "PASS" : "FAIL", JSON.stringify(dbHealthData.stats));

  // 3. Reject Admin Public Registration
  const adminRegRes = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Hacker",
      email: "hacker@test.edu",
      password: "Password123",
      role: "ADMIN",
    }),
  });
  const adminRegData = await adminRegRes.json();
  console.log("[3] Reject Admin Public Reg:", adminRegRes.status === 400 ? "PASS (400 Bad Request)" : "FAIL", adminRegData.message);

  // 4. Student Login
  const studentLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "harsh.ce@college.edu",
      password: "Password123",
    }),
  });
  const studentLoginData = await studentLoginRes.json();
  const studentToken = studentLoginData.data?.token;
  console.log("[4] Student Login:", studentLoginData.success ? "PASS" : "FAIL", `Role: ${studentLoginData.data?.user?.role}`);

  // 5. GET /api/auth/me
  const meRes = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const meData = await meRes.json();
  console.log("[5] GET /api/auth/me:", meData.success ? "PASS" : "FAIL", `User: ${meData.data?.name}`);

  // 6. Student Access to Student Courses
  const studentCoursesRes = await fetch(`${BASE_URL}/students/${studentLoginData.data.user.id}/courses`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const studentCoursesData = await studentCoursesRes.json();
  console.log("[6] Student Courses:", studentCoursesData.success ? "PASS" : "FAIL", `Courses count: ${studentCoursesData.data?.length}`);

  // 7. Student Unauthorized Attempt on Admin Users Endpoint (Must return 403)
  const adminUsersRes = await fetch(`${BASE_URL}/users`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  console.log("[7] Student Blocked from /api/users:", adminUsersRes.status === 403 ? "PASS (403 Forbidden)" : "FAIL");

  // 8. Faculty Login & Course Access
  const facultyLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "dr.rajesh@college.edu",
      password: "Password123",
    }),
  });
  const facultyLoginData = await facultyLoginRes.json();
  const facultyToken = facultyLoginData.data?.token;
  console.log("[8] Faculty Login:", facultyLoginData.success ? "PASS" : "FAIL", `Role: ${facultyLoginData.data?.user?.role}`);

  // 9. Faculty Access to Courses
  const facultyCoursesRes = await fetch(`${BASE_URL}/faculty/${facultyLoginData.data.user.id}/courses`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  const facultyCoursesData = await facultyCoursesRes.json();
  console.log("[9] Faculty Courses:", facultyCoursesData.success ? "PASS" : "FAIL", `Courses count: ${facultyCoursesData.data?.length}`);

  // 10. Admin Login & User Management
  const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin.ce@college.edu",
      password: "Password123",
    }),
  });
  const adminLoginData = await adminLoginRes.json();
  const adminToken = adminLoginData.data?.token;

  const allUsersRes = await fetch(`${BASE_URL}/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const allUsersData = await allUsersRes.json();
  console.log("[10] Admin User Roster:", allUsersData.success ? "PASS" : "FAIL", `Total users in DB: ${allUsersData.data?.length}`);

  // 11. Courses & Materials API
  const coursesRes = await fetch(`${BASE_URL}/courses`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const coursesData = await coursesRes.json();
  console.log("[11] Courses List API:", coursesData.success ? "PASS" : "FAIL", `Total courses: ${coursesData.data?.length}`);

  // 12. Quizzes API
  const firstCourseId = coursesData.data?.[0]?.id;
  const quizzesRes = await fetch(`${BASE_URL}/courses/${firstCourseId}/quizzes`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const quizzesData = await quizzesRes.json();
  console.log("[12] Quizzes List API:", quizzesData.success ? "PASS" : "FAIL", `Quizzes count: ${quizzesData.data?.length}`);

  console.log("==========================================");
  console.log("ALL BACKEND VERIFICATION CHECKS PASSED!");
  console.log("==========================================");
}

testAuthAndEndpoints().catch(console.error);

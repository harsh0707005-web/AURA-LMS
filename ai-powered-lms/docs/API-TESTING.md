# AURA LMS — API Verification & Testing Guide

This document outlines the testing procedures and commands to verify that all backend and frontend services are operating correctly.

---

## 1. Automated Verification Suite

Run the automated verification script against a running backend server:

```bash
cd backend
node src/scripts/verify-api.js
```

### Expected Output:
```
==========================================
AURA LMS: Testing API Endpoints & Auth Flow
==========================================
[1] Health Check: PASS AURA LMS backend service is operational
[2] DB Health Check: PASS {"totalUsers":6,"totalCourses":4}
[3] Reject Admin Public Reg: PASS (400 Bad Request) Public registration for Administrator role is strictly prohibited. Admin accounts must be created by existing admins or system seed.
[4] Student Login: PASS Role: STUDENT
[5] GET /api/auth/me: PASS User: Harsh Vardhan
[6] Student Courses: PASS Courses count: 4
[7] Student Blocked from /api/users: PASS (403 Forbidden)
[8] Faculty Login: PASS Role: FACULTY
[9] Faculty Courses: PASS Courses count: 2
[10] Admin User Roster: PASS Total users in DB: 6
[11] Courses List API: PASS Total courses: 4
[12] Quizzes List API: PASS Quizzes count: 1
==========================================
ALL BACKEND VERIFICATION CHECKS PASSED!
==========================================
```

---

## 2. Manual cURL Testing Commands

### A. Health Checks
```bash
# General Server Health
curl http://localhost:5000/api/health

# PostgreSQL Connection & Counts
curl http://localhost:5000/api/health/db
```

### B. Authentication & Security Tests
```bash
# 1. Student Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"harsh.ce@college.edu","password":"Password123"}'

# 2. Faculty Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dr.rajesh@college.edu","password":"Password123"}'

# 3. Admin Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin.ce@college.edu","password":"Password123"}'

# 4. Block Public Admin Registration (Must return 400 Bad Request)
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Attacker","email":"hacker@test.edu","password":"Password123","role":"ADMIN"}'
```

### C. Role-Based Access Control (RBAC) Enforcement
```bash
# Try accessing /api/users with a Student token (Must return 403 Forbidden)
curl -X GET http://localhost:5000/api/users \
  -H "Authorization: Bearer <STUDENT_TOKEN>"

# Access /api/users with Admin token (Must return 200 OK with user roster)
curl -X GET http://localhost:5000/api/users \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### D. Academic Workflow Tests
```bash
# List all courses
curl -X GET http://localhost:5000/api/courses \
  -H "Authorization: Bearer <STUDENT_TOKEN>"

# Fetch At-Risk Student Diagnostics
curl -X GET http://localhost:5000/api/analytics/at-risk \
  -H "Authorization: Bearer <FACULTY_TOKEN>"
```

---

## 3. Seed Credentials Reference

| Role | Email | Password | Identifier | Department |
| :--- | :--- | :--- | :--- | :--- |
| **Student** | `harsh.ce@college.edu` | `Password123` | `BE-2022-CS-104` | Computer Engineering |
| **Student** | `ananya.ce@college.edu` | `Password123` | `BE-2022-CS-108` | Computer Engineering |
| **Faculty** | `dr.rajesh@college.edu` | `Password123` | `EMP-CS-042` | Computer Engineering |
| **Faculty** | `prof.sneha@college.edu` | `Password123` | `EMP-CS-049` | Computer Engineering |
| **Admin** | `admin.ce@college.edu` | `Password123` | `SYS-ADMIN-01` | Computer Engineering |

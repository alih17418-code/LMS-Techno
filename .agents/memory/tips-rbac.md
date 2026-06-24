---
name: TIPS Finance RBAC Architecture
description: Key decisions for the RBAC system, instructor class assignment, student attendance, and role-based dashboards.
---

## Role Enforcement

- Auth middleware is in `artifacts/api-server/src/middlewares/auth.ts`
- Session stores: `userId`, `role`, `displayName`, `instructorId`
- `requireAuth` → any logged-in user
- `requireAdminOrStaff` → admin + staff (not instructor)
- `requireAdmin` → admin only (deletes, user management)
- `getSessionUser(req)` → returns session data for role-scoped filtering

**Why:** Instructors are self-service — they see only their own data. Staff can add/edit but not delete or manage users. Admins have full access.

## Data Scoping for Instructors

- Instructors are linked to classes via `instructor_classes` junction table (`instructor_id`, `class_id`).
- Student filtering: `students.classId` (FK to classes). Instructors see only students whose `classId` is in their assigned classes.
- Student attendance: `student_attendance` table (`studentId`, `classId`, `attendanceDate`, `status`). Instructors can only mark attendance for their assigned classes.

**How to apply:** Every GET endpoint must check `session.role === "instructor"` and filter to `instructorId`'s assigned classes. Never rely on frontend filtering alone.

## New Tables

- `instructor_classes`: many-to-many between instructors and classes (unique constraint on pair)
- `student_attendance`: per-student daily attendance with `status` (present/absent/late)
- `students` now has: `classId`, `className`, `batchStartDate`, `openingPaidAmount`, `openingPendingAmount`, `openingPresentDays`, `openingAbsentDays`

## Frontend Role-Based Routing

- `use-auth.ts` exports: `canDelete` (admin only), `canEdit` (admin+staff), `canAdd` (admin+staff), `showFinancials` (admin only)
- Dashboard renders `<AdminDashboard>`, `<StaffDashboard>`, or `<InstructorDashboard>` based on role
- Sidebar navigation is role-gated: Finance section (admin), Staff-Fees section (staff), My Portal (instructor)
- `/student-attendance` — new route for class-based student attendance marking

## Key Routes

- `POST /instructors/:id/classes` — assign/replace class list for an instructor
- `GET /student-attendance?classId=&date=` — get attendance for a class on a date
- `POST /student-attendance/bulk` — batch save attendance for a class (upsert)
- `GET /student-attendance/summary/:studentId` — attendance stats including opening balance days

## Migration / Opening Balance Logic

- `openingMonthsPaid` (integer, default 0) on `students` table
- Voucher generation in `vouchers.ts` skips any month whose index (0-based from enrollment) is < `openingMonthsPaid`
- Example: student enrolled Jan, `openingMonthsPaid=1` → Jan voucher is skipped, Feb+ are generated
- Students form shows live feedback: "Months 1–N already paid, starting from month N+1"

## Voucher Print

- `printVoucher.ts` renders 2 copies (Student Copy + Office Copy) on one page with a dashed cut line
- Layout: navy header bar with TIPS logo + org name + voucher badge, info grid, 4 fee boxes, payment history table, signature lines

## DB Schema Push

Run `pnpm --filter @workspace/db run push` after any schema changes. The `drizzle.config.ts` is in `lib/db/`.

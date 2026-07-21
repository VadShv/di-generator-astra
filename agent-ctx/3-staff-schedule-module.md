# Task 3 - Staff Schedule Module (Штатное расписание)

## Agent: Z.ai Code
## Date: 2026-07-21

## Summary
Built the complete Staff Schedule (Штатное расписание) module for the Группа Астра Job Description Generator. This module manages the organizational structure — departments and positions — with full CRUD operations via API and a professional two-panel UI.

## Files Created/Modified

### API Routes
1. **`/src/app/api/departments/route.ts`** — Full CRUD for departments
   - GET: List all departments with parent/children relations and position count
   - POST: Create department with name, code, optional parentId; validates unique code and parent existence
   - PUT: Update department by id; validates unique code and prevents circular self-reference
   - DELETE: Delete department by id; prevents deletion if children or positions exist

2. **`/src/app/api/positions/route.ts`** — Full CRUD for positions
   - GET: List all positions with department info; supports filtering by departmentId, grade, domain via query params
   - POST: Create position with title, code, departmentId, grade, domain, headcount, functions; validates unique code and department existence
   - PUT: Update position by id; validates unique code and department existence if changed
   - DELETE: Delete position by id; prevents deletion if linked archiveDIs or generatedDIs exist

### Frontend Component
3. **`/src/components/modules/staff-schedule.tsx`** — Complete StaffScheduleModule component
   - Two-panel layout: left panel for departments tree, right panel for positions table
   - Recursive DepartmentTreeNode component with expand/collapse, inline add/edit/delete actions
   - Positions table with columns: Код, Должность, Подразделение, Грейд, Домен, Штатных единиц, Функции, Действия
   - Department dialog (create/edit) with name, code, parent selection
   - Position dialog (create/edit) with all fields including grade/domain selects with predefined options
   - Bulk upload dialog with CSV-like format (semicolon-separated): Код;Название;Код_подразделения;Грейд;Домен;Штатных_единиц;Функции
   - Filter bar: department, grade, domain selects + search input
   - Delete confirmation dialogs for both departments and positions
   - Toast notifications for all CRUD operations
   - Russian language UI labels throughout
   - Responsive design with mobile support
   - Loading skeletons, empty states with contextual CTAs

## Technical Details
- All API routes use Prisma ORM with `db` from `@/lib/db`
- Proper error handling with validation and Russian error messages
- Client component using useState/useEffect for state and data fetching
- Uses shadcn/ui components: Card, Table, Dialog, Button, Input, Select, Badge, AlertDialog, ScrollArea, Skeleton, Separator, Label, Textarea
- Lucide React icons for visual elements
- Department tree supports unlimited hierarchy depth
- Position counts shown as badges in department tree
- Auto-uppercase for department and position codes in forms

## Testing
- API endpoints tested successfully with curl (GET, POST, PUT, DELETE for both departments and positions)
- ESLint passes with no errors
- Dev server compiles and runs correctly

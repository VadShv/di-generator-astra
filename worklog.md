# Worklog — Генератор ДИ Группы Астра

## Project Status
The Job Description Generator (Генератор ДИ) for Группа Астра is fully functional with 9 modules (added Справочники). The system now uses Business Functions and Projects instead of Domains, Grade is now a structured choice ("линейная" / "руководитель"), and GeneratedDI supports "signedByEmployee" criterion.

## Current Phase — Schema & UI Refactoring: Domain→Business Functions/Projects, Grade→Enum, SignedByEmployee (2026-07-24)

### Completed in This Phase

1. **Prisma Schema Updated**
   - Added `BusinessFunction` model (id, name, code, description, isActive) — replaces "domain"
   - Added `Project` model (id, name, code, description, isActive) — new field replacing "domain"
   - Position model: replaced `domain` with `businessFunctionId` (FK→BusinessFunction) + `projectId` (FK→Project)
   - Position model: `grade` now constrained to "линейная" or "руководитель" (validated in API)
   - MasterPrompt model: replaced `domain` with `businessFunctionId` (FK→BusinessFunction)
   - GeneratedDI model: added `signedByEmployee Boolean @default(false)` + `signedAt DateTime?`
   - Database schema pushed and Prisma Client regenerated successfully

2. **API Routes Created/Updated**
   - Created `/api/business-functions` — full CRUD with uniqueness check and position reference validation
   - Created `/api/projects` — full CRUD with uniqueness check and position reference validation
   - Updated `/api/positions` — grade validation ("линейная"/"руководитель"), businessFunctionId/projectId FK validation, includes businessFunction & project relations
   - Updated `/api/master-prompts` — replaced domain with businessFunctionId, include businessFunction relation
   - Updated `/api/master-prompts/resolve` — replaced domain scoring with businessFunctionId matching
   - Updated `/api/generate-di` — PUT now handles signedByEmployee toggle (sets signedAt)
   - Updated `/api/generate-di/ai-generate` — position context shows businessFunction/project instead of domain
   - Updated `/api/generate-di/ai-section` — position context shows businessFunction/project instead of domain
   - Updated `/api/generate-di/ai-improve` — position context shows businessFunction/project instead of domain
   - Updated `/api/export-di` — HTML export shows businessFunction/project, grade labels, signedByEmployee
   - Updated `/api/export-di/docx` — JSON export includes businessFunction/project, grade labels, signedByEmployee

3. **UI Modules Updated**
   - **New module: Справочники (Dictionaries)** — tabs for Business Functions and Projects with full CRUD, search, active/inactive toggle
   - **staff-schedule module** — replaced domain with businessFunction/project Select dropdowns, grade Select with "линейная"/"руководитель", position cards show new badges, stats show "Бизнес-функций" instead of "Доменов"
   - **generation module** — replaced domain with businessFunction/project, grade labels, signedByEmployee toggle with Switch
   - **archive module** — replaced domain with businessFunction/project, grade labels
   - **master-prompts module** — replaced domain with businessFunctionId Select dropdown, grade labels
   - **Sidebar updated** — added "Справочники" button with BookOpen icon in "Данные" group
   - **Store updated** — ActiveSection type now includes 'dictionaries'

4. **Grammar fixes in dictionaries module**
   - "Новая проект" → "Новый проект"
   - "Добавить бизнес-функция" → "Добавить бизнес-функцию"

### Verification via agent-browser + VLM
- ✅ Справочники tab: Business function "IT-инфраструктура" created successfully
- ✅ Справочники tab: Project "Астра Cloud" created successfully
- ✅ Штатное расписание: Position form shows grade Select ("линейная"/"руководитель"), businessFunction Select, project Select
- ✅ Штатное расписание: DevOps-инженер position created with grade="линейная", businessFunction="IT-инфраструктура", project="Астра Cloud"
- ✅ Stats show "Бизнес-функций: 1" instead of "Доменов"
- ✅ All lint checks pass cleanly
- ✅ VLM verification confirms UI is clean and correctly laid out

## All Completed Modules (9 modules total)

### 1. Dashboard (Дашборд)
### 2. Staff Schedule (Штатное расписание) — UPDATED with businessFunction/project, grade enum
### 3. Dictionaries (Справочники) — NEW module for Business Functions & Projects
### 4. Archive DI (Архив ДИ) — UPDATED with businessFunction/project
### 5. Templates (Шаблоны ДИ) — ENHANCED with isPrimary/пресет system
### 6. Master Prompts (Мастер-промпты) — UPDATED with businessFunctionId
### 7. AI Generation (Генерация ДИ) — UPDATED with businessFunction/project + signedByEmployee
### 8. Tracking (Отслеживание)
### 9. Version Comparison (Сравнение версий)

## API Endpoints
- `/api/companies` - CRUD for legal entities
- `/api/departments` - includes companyId and company relation
- `/api/business-functions` - CRUD for business functions (NEW)
- `/api/projects` - CRUD for projects (NEW)
- `/api/positions` - CRUD with businessFunctionId, projectId, grade validation
- `/api/templates` - CRUD with isPrimary support
- `/api/templates/[id]` - GET single template
- `/api/generate-di` - CRUD for generated DIs (now handles signedByEmployee)
- `/api/generate-di/ai-generate` - AI full generation (businessFunction/project context)
- `/api/generate-di/ai-section` - AI single section generation
- `/api/generate-di/ai-improve` - AI section improvement
- `/api/master-prompts` - CRUD for master prompts (businessFunctionId)
- `/api/archive-di` - CRUD for archive DIs
- `/api/tracking` - CRUD for DI tracking
- `/api/compare` - Version comparison
- `/api/export-di` - DOCX/HTML export (includes signedByEmployee, businessFunction, project)
- `/api/dashboard/stats` - Dashboard statistics

## Database Schema
- Company model (id, name, shortName, code, type, director, description, departments)
- Department model (id, name, code, parentId hierarchy, companyId, positions, masterPrompts)
- **BusinessFunction model** (id, name, code, description, isActive, positions, masterPrompts) — NEW
- **Project model** (id, name, code, description, isActive, positions) — NEW
- Position model (id, title, code, departmentId, grade, businessFunctionId, projectId, headcount, functions, archiveDIs, generatedDIs)
- DITemplate model (id, name, description, sections, generatedDIs, isActive, isPrimary, createdAt, updatedAt)
- DITemplateSection model (id, templateId, title, order, promptGuidance, isRequired, content)
- MasterPrompt model (id, name, content, version, isActive, departmentId, businessFunctionId, grade, functionType, description)
- GeneratedDI model (id, positionId, templateId, title, status, **signedByEmployee**, **signedAt**, sections, trackings, versions)
- GeneratedDISection model (id, generatedDIId, sectionTitle, sectionContent, order, aiGenerated, editedBy)
- ArchiveDI model (id, title, content, positionId, fileName, uploadedAt)
- DITracking model (id, generatedDIId, status, assignee, notes)
- DIVersion model (id, generatedDIId, content, version, isOriginal, uploadedBy, fileName, diffSummary)

## Previous Phase Updates (from earlier sessions)

5. **Logo plaque flip card — UPDATED (2026-07-23)**
6. **Logo removed, dashboard header simplified (2026-07-23)**

## Known Issues / Risks
- Background processes die between bash tool calls — need to restart server each session
- Dev server requires restart after Prisma schema changes + .next cache clear

## Priority Recommendations for Next Phase
1. Verify Tracking module shows signedByEmployee status
2. Verify Dashboard stats correctly count business functions instead of domains
3. Add ability to filter positions by businessFunction/project in generation module
4. Add batch DI generation with progress tracking
5. Add DOCX export using the docx npm package
6. Improve styling with more visual polish and animations

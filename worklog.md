# Worklog — Генератор ДИ Группы Астра

## Project Status
The Job Description Generator (Генератор ДИ) for Группа Астра is functionally complete with all 8 modules and 20+ API endpoints built. The application runs on Next.js 16 with TypeScript, Tailwind CSS 4, shadcn/ui, Prisma ORM (SQLite), and z-ai-web-dev-sdk for AI features.

## Completed Modules

### 1. Dashboard (Дашборд)
- Stats cards showing counts for all entities
- Quick action links
- Recent activity feed

### 2. Staff Schedule (Штатное расписание)
- CRUD for departments (hierarchical tree structure)
- CRUD for positions (with department, grade, domain, headcount, functions)
- Filtering by department, grade, domain
- Bulk upload support
- API: GET/POST/PUT/DELETE /api/departments, /api/positions

### 3. Archive DI (Архив ДИ)
- CRUD for archived job descriptions
- Linked to positions in the staff schedule
- Search/filter by position, department, content
- Full content viewer
- API: GET/POST/PUT/DELETE /api/archive-di, GET /api/archive-di/[id]

### 4. Templates (Шаблоны ДИ)
- CRUD for DI templates with sections
- Section management (add, remove, reorder)
- AI prompt guidance per section
- Default Russian DI template (6 standard sections)
- Preview mode
- API: GET/POST/PUT/DELETE /api/templates, GET /api/templates/[id]

### 5. Master Prompts (Мастер-промпты)
- CRUD with versioning (auto-increment version on same name)
- Applicability rules: department, domain, grade, function type
- Smart resolver: given a position, finds best matching prompt
- Priority scoring: department(1000) > domain(100) > grade(10) > function(1) > global(0)
- Version history and comparison
- API: GET/POST/PUT/DELETE /api/master-prompts, POST /api/master-prompts/resolve, GET /api/master-prompts/versions

### 6. AI Generation (Генерация ДИ)
- Step-by-step generation wizard
- Generate all sections at once with AI
- Generate individual sections with custom prompts
- Improve existing content with AI instructions
- Quick enhancement actions (improve, add details, condense, formalize)
- Status workflow: draft → review → approved → exported
- Uses z-ai-web-dev-sdk for all AI operations
- API: GET/POST/PUT/DELETE /api/generate-di, POST /api/generate-di/ai-generate, /ai-section, /ai-improve

### 7. Tracking (Отслеживание)
- Lifecycle tracking for generated DIs
- Status columns: draft, sent_for_review, returned_with_comments, approved, rejected, signed, cancelled
- Add tracking entries with assignee and notes
- Status timeline per DI
- API: GET/POST/PUT/DELETE /api/tracking, PUT /api/tracking/update-di-status

### 8. Version Comparison (Сравнение версий)
- Upload edited versions of DIs for comparison
- Auto-save original generated version
- Side-by-side diff view with color coding (added/removed/modified)
- AI-powered diff summary using z-ai-web-dev-sdk
- Version timeline
- API: GET/POST /api/compare, POST /api/compare/ai-diff, /auto-save-original, GET /api/compare/[id]

### 9. Export
- HTML export of generated DIs
- JSON export for DOCX generation
- API: GET /api/export-di, /api/export-di/docx

## Database Schema
- Department (hierarchical)
- Position (with grade, domain, headcount, functions)
- ArchiveDI (linked to Position)
- DITemplate + DITemplateSection
- MasterPrompt (versioned, with applicability rules)
- GeneratedDI + GeneratedDISection
- DITracking
- DIVersion

## Known Issues
- Memory constraints in sandbox environment cause server crashes with concurrent browser connections
- Dev server works for sequential API requests
- Browser testing is limited due to OOM when loading JS chunks concurrently
- Components were simplified (77% reduction) to mitigate memory issues

## Priority Recommendations
1. Enhance UI styling and add more visual polish
2. Add DOCX export using the docx npm package
3. Implement proper error handling and loading states
4. Add data validation on API endpoints
5. Implement proper authentication
6. Add more AI-powered features (auto-suggest sections, content analysis)

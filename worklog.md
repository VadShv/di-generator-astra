# Worklog — Генератор ДИ Группы Астра

## Project Status
The Job Description Generator (Генератор ДИ) for Группа Астра is fully functional with all 8 modules. Templates now support `isPrimary` (основной пресет) which is pre-selected during manual DI generation. The Generation module has been redesigned to use template presets instead of hardcoded sections.

## Current Phase — Template Preset System for Manual Generation (2026-07-22)

### Completed in This Phase

1. **isPrimary field for DITemplate model**
   - Added `isPrimary Boolean @default(false)` field to DITemplate Prisma model
   - Only one template can be primary at any time — setting a new primary automatically unsets the previous one
   - Database schema pushed successfully

2. **Templates API updated for isPrimary**
   - POST: When creating a template with isPrimary=true, all other templates' isPrimary is set to false first
   - PUT: Same logic for updating isPrimary — exclusive, only one can be primary
   - Both create and update flows handle the exclusive primary constraint correctly

3. **Templates Module enhanced**
   - Added "Основной шаблон (пресет)" highlight card at top showing the primary template with Crown icon and amber styling
   - Info message when no primary template is set
   - Template cards show Crown icon and "Основной" badge for primary templates
   - "Основной" button to set any template as primary (with confirmation dialog)
   - "Снять" button to remove primary status from a primary template
   - "Основной (пресет)" switch in edit mode with Crown badge explanation
   - Confirmation dialog when setting a template as primary

4. **Generation Module redesigned for preset-based manual creation**
   - **Removed hardcoded STANDARD_DI_SECTIONS** — sections now come from selected template/preset
   - **Manual creation flow**: 
     - If primary template exists → auto-selected, sections loaded, goes directly to edit mode
     - If no primary template → shows preset selection step where user picks a template card
   - **Preset indicator bar** at top of manual edit view showing:
     - Crown icon + selected template name
     - "Основной" badge if it's the primary template
     - Dropdown to switch to another preset (preserves matching content)
     - "Другой пресет" button to go back to preset selection
   - **Section customization in manual mode**:
     - Inline editable section titles (when expanded)
     - Add custom sections beyond template ("Добавить секцию" button)
     - Remove template sections
     - Reorder sections (move up/down buttons)
     - "Обяз." badges for required sections from template
   - **Generation list view** shows primary template name on the "Создать вручную" card with Crown icon
   - **Manual save** now includes templateId (manualPresetId) to link DI to its template

### Verification via agent-browser
- ✅ Templates tab: Created "Стандартный шаблон ДИ Группы Астра" with isPrimary=true
- ✅ Templates list shows primary template highlight card with amber styling and Crown
- ✅ Template card shows "Основной" badge and "Снять" button
- ✅ Generation tab "Создать вручную" card shows primary template name
- ✅ Manual creation: Primary template auto-selected, sections loaded from template
- ✅ Manual creation: Preset indicator bar visible at top with dropdown and "Другой пресет" button
- ✅ Manual creation: Sections from template shown with all customization options
- ✅ All lint checks pass cleanly

## All Completed Modules (from previous phases)

### 1. Dashboard (Дашборд)
### 2. Staff Schedule (Штатное расписание) — REDESIGNED with company support & DI coverage
### 3. Archive DI (Архив ДИ)
### 4. Templates (Шаблоны ДИ) — ENHANCED with isPrimary/пресет system
### 5. Master Prompts (Мастер-промпты)
### 6. AI Generation (Генерация ДИ) — ENHANCED with preset-based manual creation
### 7. Tracking (Отслеживание)
### 8. Version Comparison (Сравнение версий)

## API Endpoints
- `/api/companies` - CRUD for legal entities
- `/api/departments` - includes companyId and company relation
- `/api/positions` - includes generatedDIs, archiveDIs
- `/api/templates` - CRUD with isPrimary support
- `/api/templates/[id]` - GET single template
- `/api/generate-di` - CRUD for generated DIs (now accepts templateId for manual)
- `/api/generate-di/ai-generate` - AI full generation
- `/api/generate-di/ai-section` - AI single section generation
- `/api/generate-di/ai-improve` - AI section improvement
- `/api/master-prompts` - CRUD for master prompts
- `/api/archive-di` - CRUD for archive DIs
- `/api/tracking` - CRUD for DI tracking
- `/api/compare` - Version comparison
- `/api/export-di` - DOCX export
- `/api/dashboard/stats` - Dashboard statistics

## Database Schema
- Company model (id, name, shortName, code, type, director, description, departments)
- Department model (id, name, code, parentId hierarchy, companyId, positions, masterPrompts)
- Position model (id, title, code, departmentId, grade, domain, headcount, functions, archiveDIs, generatedDIs)
- DITemplate model (id, name, description, sections, generatedDIs, isActive, **isPrimary**, createdAt, updatedAt)
- DITemplateSection model (id, templateId, title, order, promptGuidance, isRequired, content)
- MasterPrompt model (id, name, content, version, isActive, departmentId, domain, grade, functionType)
- GeneratedDI model (id, positionId, templateId, title, status, sections, trackings, versions)
- GeneratedDISection model (id, generatedDIId, sectionTitle, sectionContent, order, aiGenerated, editedBy)
- ArchiveDI model (id, title, content, positionId, fileName, uploadedAt)
- DITracking model (id, generatedDIId, status, assignee, notes)
- DIVersion model (id, generatedDIId, content, version, isOriginal, uploadedBy, fileName, diffSummary)

5. **Logo plaque flip card — UPDATED (2026-07-23)**
   - Added CSS 3D flip animation in `globals.css` (`.flip-card`, `.flip-card-inner`, `.flip-card-front`, `.flip-card-back`)
   - Updated `page.tsx` — the sidebar "Группа Астра / Генератор ДИ" plaque flips on click via `rotateY(180deg)` transform
   - **Front side**: Uploaded logo image (`/logo.png`) + "Группа Астра" / "Генератор ДИ"
   - **Back side**: Only **"@VADSHV"** text (bold, primary color) — removed the longer phrase per user request
   - Back side has gradient background (from-primary/10 to-primary/5) with border and centered text
   - Collapsed sidebar: shows logo image on front, "@" on back (both 8x8 size)
   - `logoFlipped` state toggles the flip; smooth 0.6s cubic-bezier transition
   - ✅ Verified via agent-browser + VLM: flip toggles correctly, shows "@VADSHV" on back, logo on front
   - ✅ Lint passes cleanly

6. **Logo image added to project (2026-07-23)**
   - User-uploaded image (`generated-image (1).png`) copied to `/public/logo.png`
   - Logo used in sidebar plaque (front side) via `next/image` `<Image src="/logo.png" />`
   - Logo used in dashboard header via `next/image` `<Image src="/logo.png" />` (replacing Activity icon)
   - Added `images: { unoptimized: true }` to `next.config.ts` for standalone compatibility
   - Removed unused `MessageCircle` and `Activity` icon imports

## Known Issues / Risks
- Background processes die between bash tool calls — need to restart server each session
- DB was reset during this session — test data needs to be re-created (companies, departments, positions)

## Priority Recommendations for Next Phase
1. Re-create test data (companies, departments, positions) since DB was reset
2. Add batch DI generation with progress tracking
3. Add DOCX export using the docx npm package
4. Enhance position cards with direct link to DI generation
5. Add ability to create DI directly from position card (quick action)
6. Improve styling with more visual polish and animations

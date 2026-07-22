# Worklog — Генератор ДИ Группы Астра

## Project Status
The Job Description Generator (Генератор ДИ) for Группа Астра is fully functional with all 8 modules, enhanced with file upload capabilities and manual DI creation mode with per-section AI generation. The Staff Schedule module has been significantly redesigned with company (Юр лицо) support and DI coverage tracking.

## Current Phase - Staff Schedule Redesign (2026-07-22)

### Completed in This Phase

1. **Company (Юр лицо) Model & Management**
   - Added `Company` model to Prisma schema with fields: name, shortName, code, type, director, description
   - Created `/api/companies` CRUD endpoint
   - Added `companyId` field to `Department` model linking departments to companies
   - Updated `/api/departments` to include company relation and companyId
   - Company CRUD dialog with fields for name, short name, code/ИНН, type (ООО/АО/ПАО/ИП etc.), director, description
   - Companies shown as expandable sections in organization tree

2. **DI Coverage Tracking per Department & Company**
   - Updated `/api/positions` to include `generatedDIs` (with status) and `archiveDIs` in response
   - Each position now shows DI status: "Утверждена" (approved), "Сгенерирована" (draft), "Архивная" (archive), "Нет ДИ" (none)
   - Each department in tree shows mini progress bar with coverage percentage
   - Each company shows overall coverage bar with percentage
   - Global coverage summary bar at top showing: total approved, in progress, without DI
   - Color-coded coverage: green (≥80%), amber (≥50%), orange (≥25%), red (<25%)

3. **Rich Position Cards**
   - Each position displayed as an informative card instead of a simple table row
   - Shows: DI status icon with color badge, position title + code, department name, company name, grade, domain, headcount, archive DI count, functions preview
   - Edit/delete buttons appear on hover

4. **Organization Tree with Companies**
   - Left panel: tree view with companies as root nodes
   - Each company expandable to show its department hierarchy
   - Departments without company shown under "Без юр. лица" section
   - Expandable/collapsible with chevron icons
   - Action buttons on hover for companies and departments

5. **Enhanced Stats Dashboard**
   - 6 stat cards: Юр. лица, Подразделения, Должности, Штат. единиц, Покрытие ДИ, Доменов
   - Each card with gradient background and appropriate icon
   - Coverage card is color-coded based on percentage

6. **DI Status Filter**
   - Dropdown filter for positions: "Все должности", "✅ Утверждена", "📝 Сгенерирована", "❌ Нет ДИ"

7. **Package.json Update**
   - Changed dev script to include `-H 0.0.0.0` flag for proper IPv4 binding

8. **Next.js Config Update**
   - Added `allowedDevOrigins` for preview panel domain

### Test Data Created
- 2 companies: ООО Астра Групп, АО Астра Лаб
- 5 departments: Комплексные решения, IT отдел, HR отдел, Лаборатория инноваций, Отдел продаж
- 7 positions with various grades, domains, headcounts
- All verified via agent-browser: companies, departments, positions, coverage, and DI status all display correctly

## All Completed Modules (from previous phases)

### 1. Dashboard (Дашборд)
### 2. Staff Schedule (Штатное расписание) — REDESIGNED
### 3. Archive DI (Архив ДИ)
### 4. Templates (Шаблоны ДИ)
### 5. Master Prompts (Мастер-промпты)
### 6. AI Generation (Генерация ДИ)
### 7. Tracking (Отслеживание)
### 8. Version Comparison (Сравнение версий)

## API Endpoints
- All previous endpoints unchanged
- **NEW** `/api/companies` - CRUD for legal entities (Юр лица)
- Updated `/api/departments` - includes `companyId` and `company` relation
- Updated `/api/positions` - includes `generatedDIs` (status), `archiveDIs`, department with company

## Database Schema Changes
- **NEW** `Company` model (id, name, shortName, code, type, director, description, departments)
- Updated `Department` model (added companyId, company relation)
- `Position` now includes generatedDIs and archiveDIs in API responses

## Known Issues / Risks
- Dev server binding: needed `-H 0.0.0.0` flag in package.json for IPv4 access (some sandbox networking quirks)
- Background processes die between bash tool calls — need to restart server each session
- The "Отдел продаж" department from original session has companyId=null (orphan)

## Priority Recommendations for Next Phase
1. Fix orphan departments (assign Отдел продаж to ООО Астра Групп)
2. Add batch DI generation with progress tracking
3. Add DOCX export using the docx npm package
4. Implement proper authentication with NextAuth.js
5. Add more keyboard shortcuts and accessibility features
6. Add collaborative editing features
7. Enhance position cards with direct link to DI generation
8. Add ability to create DI directly from position card (quick action)

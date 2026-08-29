// Определение типа файла по magic bytes и санитизация имён (Фаза 3, шаг 3.3).
// Проверка по сигнатурам надёжнее расширения: атакующий может переименовать
// любой файл в .pdf/.docx/.xlsx, но magic bytes подделать сложнее.

export type DetectedFileType = 'pdf' | 'zip' | 'unknown'

/** PDF-сигнатура: %PDF (25 50 44 46). */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]
/** ZIP-сигнатура: PK\x03\x04 (50 4B 03 04) — начало DOCX/XLSX (они суть ZIP). */
const ZIP_MAGICS: number[][] = [
  [0x50, 0x4b, 0x03, 0x04], // локальный заголовок файла
  [0x50, 0x4b, 0x05, 0x06], // пустой архив
  [0x50, 0x4b, 0x07, 0x08], // spanned archive
]

function matchesMagic(buf: Uint8Array, magic: number[]): boolean {
  if (buf.length < magic.length) return false
  for (let i = 0; i < magic.length; i++) {
    if (buf[i] !== magic[i]) return false
  }
  return true
}

/**
 * Определить тип файла по сигнатуре (magic bytes).
 * DOCX и XLSX — это ZIP-архивы, поэтому распознаются как 'zip'.
 */
export function detectFileType(buffer: ArrayBuffer): DetectedFileType {
  const bytes = new Uint8Array(buffer.slice(0, 8))
  if (matchesMagic(bytes, PDF_MAGIC)) return 'pdf'
  if (ZIP_MAGICS.some((m) => matchesMagic(bytes, m))) return 'zip'
  return 'unknown'
}

/**
 * Проверить, что содержимое файла соответствует ожидаемому расширению.
 * @param buffer содержимое файла
 * @param ext ожидаемое расширение ('pdf' | 'docx' | 'xlsx' | 'xls')
 * @returns true если magic bytes совпадают с ожидаемым типом.
 *
 * Примечание: .xls (стый бинарный формат OLE2, сигнатура D0 CF 11 E0)
 * поддерживается отдельно; .docx и .xlsx — это ZIP-архивы.
 */
export function validateFileType(
  buffer: ArrayBuffer,
  ext: string
): boolean {
  const detected = detectFileType(buffer)
  switch (ext) {
    case 'pdf':
      return detected === 'pdf'
    case 'docx':
    case 'xlsx':
      return detected === 'zip'
    case 'xls':
      // OLE2 Compound Document: D0 CF 11 E0 A1 B1 1A E1
      return detected === 'zip' || isOle2(buffer)
    default:
      return false
  }
}

/** OLE2-сигнатура для legacy .xls/.doc: D0 CF 11 E0 A1 B1 1A E1. */
const OLE2_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
function isOle2(buffer: ArrayBuffer): boolean {
  return matchesMagic(new Uint8Array(buffer.slice(0, 8)), OLE2_MAGIC)
}

/**
 * Санитизация имени файла перед сохранением в БД (Фаза 3, шаг 3.3).
 * Убирает компоненты пути (../), управляющие символы, ограничивает длину.
 * Возвращает безопасный basename без расширения-дублирования.
 */
export function sanitizeFileName(name: string): string {
  // Берём только basename — отсекаем любые пути (Unix/Windows).
  const basename = name.replace(/\\/g, '/').split('/').pop() || ''
  // Убираем управляющие символы (0x00–0x1F, 0x7F) и небезопасные для FS символы.
  const cleaned = basename.replace(/[\x00-\x1f\x7f<>:"|?*]/g, '').trim()
  // Ограничиваем длину (255 — предел большинства ФС, оставляем запас).
  const limited = cleaned.length > 200 ? cleaned.slice(0, 200) : cleaned
  // Если после очистки имя пустое — дефолт.
  return limited || 'document'
}

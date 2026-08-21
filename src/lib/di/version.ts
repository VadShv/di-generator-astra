// Утилиты работы с версиями ДИ (Фаза 2).
// Вынесено из роутов generate-di/* (дублировалось в ai-generate и mass-generate).

import { db } from '../db'

export interface SectionForVersion {
  title: string
  content: string
}

/**
 * Сериализовать секции ДИ в JSON-контент для DIVersion.
 * Формат: { title, sections: [{title, content}] }.
 */
export function serializeDiVersion(title: string, sections: SectionForVersion[]): string {
  return JSON.stringify({
    title,
    sections: sections.map((s) => ({ title: s.title, content: s.content })),
  })
}

/**
 * Создать начальную (v1) запись версии ДИ.
 * @param generatedDIId ID сгенерированной ДИ
 * @param title заголовок ДИ
 * @param sections секции [{title, content}]
 * @param uploadedBy автор (по умолчанию 'ai-generate')
 * @param changeDescription описание изменения
 */
export async function createInitialVersion(
  generatedDIId: string,
  title: string,
  sections: SectionForVersion[],
  uploadedBy = 'ai-generate',
  changeDescription = 'Начальная AI-генерация'
): Promise<void> {
  const content = serializeDiVersion(title, sections)
  await db.dIVersion.create({
    data: {
      generatedDIId,
      content,
      version: 1,
      isOriginal: true,
      changeDescription,
      uploadedBy,
    },
  })
}

// Утилиты работы с версиями ДИ (Фаза 2).
// Вынесено из роутов generate-di/* (дублировалось в ai-generate и mass-generate).

 import { PrismaClient } from '@prisma/client'
 import { db } from '../db'

/** Тип БД-клиента: основной или транзакционный. */
type DbClient = PrismaClient | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]
type DbClientExtended = DbClient | typeof db
// Минимальный интерфейс: клиент с доступом к dIVersion (основной extended-клиент
// или транзакционный tx-клиент). Избегает конфликтов типов Prisma extension.
interface DiVersionClient {
  dIVersion: {
    // any-параметр: контравариантность Prisma-генериков делает точную типизацию
    // несовместимой между extended-клиентом и tx-клиентом. Runtime-контракт
    // одинаковый — тип контролируется на стороне вызова.
    create: (args: any) => Promise<any>
  }
}

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
  changeDescription = 'Начальная AI-генерация',
  tx?: DiVersionClient
): Promise<void> {
  const content = serializeDiVersion(title, sections)
  const client = tx ?? db
  await client.dIVersion.create({
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

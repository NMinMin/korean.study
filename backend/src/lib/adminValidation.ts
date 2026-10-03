import { z } from 'zod'

const status = z.enum(['draft', 'published', 'locked', 'no_content'])
const requiredText = z.string().trim().min(1)
const text = z.string().trim()
const textbook = z.object({ slug: requiredText, titleKo: requiredText, titleVi: text.optional(), description: text.optional(), sortOrder: z.number().int().nonnegative().optional(), status: status.optional() })
const lesson = z.object({ textbookId: z.string().uuid(), lessonNumber: z.number().int().positive(), titleKo: requiredText, titleVi: text.optional(), status: status.optional() })
const exercise = z.object({ lessonId: z.string().uuid(), skillType: z.enum(['vocabulary_grammar', 'dictation', 'shadowing', 'review']), exerciseType: text.optional(), promptKo: requiredText, promptVi: text.optional(), answer: z.record(z.string(), z.unknown()).optional(), explanationVi: text.optional(), mediaUrl: text.optional(), imageUrl: text.optional(), audioUrl: text.optional(), sortOrder: z.number().int().nonnegative().optional(), status: status.optional() })

export function adminBodySchema(method: string, route: string) {
  const path = route.slice(route.indexOf('/admin'))
  if (method === 'POST') return ({ '/admin/textbooks': textbook, '/admin/lessons': lesson, '/admin/exercises': exercise } as Record<string, z.ZodType>)[path]
  if (method !== 'PATCH') return undefined
  const schemas: Record<string, z.ZodType> = {
    '/admin/textbooks/:id': textbook.partial(),
    '/admin/lessons/:id': lesson.partial(),
    '/admin/exercises/:id': exercise.partial(),
    '/admin/exercises/actions/bulk-move': z.object({ exerciseIds: z.array(z.string().uuid()).min(1).max(1000), lessonId: z.string().uuid() }),
    '/admin/users/:id/role': z.object({ role: z.enum(['user', 'admin']) }),
    '/admin/users/:id/lock': z.object({ locked: z.boolean() }),
    '/admin/community/custom-lessons/:id': z.object({ hidden: z.boolean() }),
    '/admin/community/posts/:id': z.object({ hidden: z.boolean().optional(), commentsLocked: z.boolean().optional(), reason: text.optional() }).refine((value) => value.hidden !== undefined || value.commentsLocked !== undefined),
    '/admin/community/reports/:id': z.object({ status: z.enum(['resolved', 'dismissed']), note: text.optional() }),
  }
  return schemas[path]
}

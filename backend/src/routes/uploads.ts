import { createHash } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import { config } from '../config.js'
import { requireAuth } from '../plugins/auth.js'

type UploadKind = 'lesson' | 'community' | 'avatar'

const folders: Record<UploadKind, string> = {
  lesson: 'korean-study/lessons',
  community: 'korean-study/community',
  avatar: 'korean-study/avatars',
}

export const uploadRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: { kind?: UploadKind } }>(
    '/uploads/cloudinary/signature',
    {
      preHandler: requireAuth,
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          properties: { kind: { type: 'string', enum: ['lesson', 'community', 'avatar'] } },
        },
      },
    },
    async (request, reply) => {
      const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = config
      if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
        return reply.code(503).send({
          code: 'CLOUDINARY_NOT_CONFIGURED',
          message: 'Cloudinary chưa được cấu hình trên backend.',
          requestId: request.id,
        })
      }

      const kind = request.body?.kind ?? 'lesson'
      const timestamp = Math.floor(Date.now() / 1000)
      const folder = `${folders[kind]}/${request.userId}`
      const signature = createHash('sha1')
        .update(`folder=${folder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`)
        .digest('hex')

      return {
        cloudName: CLOUDINARY_CLOUD_NAME,
        apiKey: CLOUDINARY_API_KEY,
        timestamp,
        folder,
        signature,
        maxBytes: 20 * 1024 * 1024,
      }
    },
  )
}

import { createHash } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import { config } from '../config.js'
import { requireAuth } from '../plugins/auth.js'

type UploadKind = 'lesson' | 'community' | 'avatar'
type AssetType = 'image' | 'audio' | 'file'

const folders: Record<UploadKind, string> = {
  lesson: 'korean-study/lessons',
  community: 'korean-study/community',
  avatar: 'korean-study/avatars',
}

export const uploadRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: { kind?: UploadKind; assetType?: AssetType } }>(
    '/uploads/cloudinary/signature',
    {
      preHandler: requireAuth,
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            kind: { type: 'string', enum: ['lesson', 'community', 'avatar'] },
            assetType: { type: 'string', enum: ['image', 'audio', 'file'] },
          },
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
      const assetType = request.body?.assetType ?? 'file'
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
        maxBytes: assetType === 'image' ? 10 * 1024 * 1024 : assetType === 'audio' ? 100 * 1024 * 1024 : 20 * 1024 * 1024,
      }
    },
  )
}

import cors from '@fastify/cors'
import Fastify from 'fastify'
import { config } from './config.js'
import { meRoutes } from './routes/me.js'
import { uploadRoutes } from './routes/uploads.js'
import { adminRoutes } from './routes/admin.js'

const app = Fastify({ logger: true, requestIdHeader: 'x-request-id' })

await app.register(cors, {
  origin(origin, callback) {
    if (!origin || config.allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error('Origin is not allowed'), false)
  },
  credentials: true,
})

app.get('/health', async () => ({ status: 'ok', service: 'korean-study-api', timestamp: new Date().toISOString() }))
await app.register(meRoutes, { prefix: '/v1' })
await app.register(uploadRoutes, { prefix: '/v1' })
await app.register(adminRoutes, { prefix: '/v1' })

app.setNotFoundHandler((request, reply) => reply.code(404).send({ code: 'NOT_FOUND', message: 'Không tìm thấy API.', requestId: request.id }))
app.setErrorHandler((error, request, reply) => {
  request.log.error(error)
  const normalized = error instanceof Error ? error : new Error('Unknown server error')
  const statusCode = 'statusCode' in normalized && typeof normalized.statusCode === 'number' && normalized.statusCode >= 400
    ? normalized.statusCode
    : 500
  reply.code(statusCode).send({
    code: 'INTERNAL_ERROR',
    message: config.NODE_ENV === 'production' ? 'Hệ thống đang gặp sự cố.' : normalized.message,
    requestId: request.id,
  })
})

await app.listen({ port: config.PORT, host: config.HOST })

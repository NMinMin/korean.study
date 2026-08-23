import cors from '@fastify/cors'
import Fastify from 'fastify'
import { config } from './config.js'
import { meRoutes } from './routes/me.js'
import { uploadRoutes } from './routes/uploads.js'
import { adminRoutes } from './routes/admin.js'
import { shadowingRoutes } from './routes/shadowing.js'
import { aiRoutes } from './routes/ai.js'

const app = Fastify({ logger: true, requestIdHeader: 'x-request-id' })

function normalizeOrigin(origin: string) {
  try {
    const url = new URL(origin)
    return `${url.protocol}//${url.host}`.toLowerCase()
  } catch {
    return origin.trim().replace(/\/+$/, '').toLowerCase()
  }
}

const allowedOrigins = new Set(config.allowedOrigins.map(normalizeOrigin))

await app.register(cors, {
  origin(origin, callback) {
    // Requests without Origin are server-to-server/health checks. Browser
    // origins never contain a path, so normalize configured GitHub Pages URLs
    // such as https://user.github.io/project/ to scheme + host before comparing.
    if (!origin || allowedOrigins.has(normalizeOrigin(origin))) return callback(null, true)

    const error = Object.assign(new Error(`Origin is not allowed: ${origin}`), { statusCode: 403 })
    callback(error, false)
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  maxAge: 86400,
})

app.log.info({ allowedOrigins: [...allowedOrigins] }, 'CORS origins configured')

app.get('/health', async () => ({ status: 'ok', service: 'korean-study-api', timestamp: new Date().toISOString() }))
await app.register(meRoutes, { prefix: '/v1' })
await app.register(uploadRoutes, { prefix: '/v1' })
await app.register(adminRoutes, { prefix: '/v1' })
await app.register(shadowingRoutes, { prefix: '/v1' })
await app.register(aiRoutes, { prefix: '/v1' })

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

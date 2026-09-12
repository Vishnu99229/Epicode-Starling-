import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'

export class HttpError extends Error {
  readonly statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.statusCode = statusCode
  }
}

export function notFound(message: string) {
  return new HttpError(404, message)
}

export function badRequest(message: string) {
  return new HttpError(400, message)
}

export function notImplemented(message: string) {
  return new HttpError(501, message)
}

export function serviceUnavailable(message: string) {
  return new HttpError(503, message)
}

export function registerErrorHandler(app: {
  setErrorHandler: (
    handler: (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => void,
  ) => void
}) {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({ message: error.message })
    }

    if (error instanceof ZodError) {
      const message = error.errors.map((e) => e.message).join('; ') || 'Validation failed'
      return reply.status(400).send({ message })
    }

    if (error.validation) {
      return reply.status(400).send({ message: error.message })
    }

    reply.log.error(error)
    return reply.status(500).send({ message: 'Internal server error' })
  })
}

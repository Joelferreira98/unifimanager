import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({ message: 'Dados inválidos', errors: err.flatten().fieldErrors })
    return
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ message: 'Registro duplicado: já existe um cadastro com esses dados' })
      return
    }
    if (err.code === 'P2025') {
      res.status(404).json({ message: 'Registro não encontrado' })
      return
    }
  }

  console.error(err)
  res.status(500).json({ message: 'Erro interno do servidor' })
}

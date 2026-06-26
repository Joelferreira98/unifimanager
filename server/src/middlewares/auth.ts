import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { Role } from '@prisma/client'

export interface AuthPayload {
  userId: string
  role: Role
  companyId?: string
}

declare global {
  namespace Express {
    interface Request {
      user: AuthPayload
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ message: 'Token não informado' })
    return
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload
  } catch {
    // Token inválido ou expirado → 401 para o front deslogar e redirecionar
    res.status(401).json({ message: 'Token inválido ou expirado' })
    return
  }
  next()
}

export function authorize(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ message: 'Acesso negado' })
      return
    }
    next()
  }
}

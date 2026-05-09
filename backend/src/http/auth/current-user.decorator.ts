import { ExecutionContext, createParamDecorator } from '@nestjs/common'
import type { Request } from 'express'

type UserField = keyof NonNullable<Request['user']>

export const CurrentUser = createParamDecorator(
  (field: UserField | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<Request>()
    if (!req.user) return undefined
    return field ? req.user[field] : req.user
  },
)

import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { jwtVerify } from 'jose'
import type { Request } from 'express'
import { JwksProvider } from './jwks.provider'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwks: JwksProvider) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>()
    const header = req.headers.authorization
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Unauthorized')
    }

    const token = header.slice(7)

    try {
      const { payload } = await jwtVerify(token, this.jwks.get(), {
        issuer: this.jwks.issuer,
        audience: 'authenticated',
        algorithms: ['RS256', 'ES256'],
      })

      if (!payload.sub) {
        throw new UnauthorizedException('Invalid token: missing sub claim')
      }

      req.user = { userId: payload.sub }
      return true
    } catch (err) {
      if (err instanceof HttpException) throw err
      throw new UnauthorizedException('Invalid or expired token')
    }
  }
}

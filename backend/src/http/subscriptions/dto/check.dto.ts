import { IsNotEmpty, IsString } from 'class-validator'

export class CheckQueryDto {
  @IsString()
  @IsNotEmpty({ message: 'Missing igdbIds parameter' })
  igdbIds!: string
}

export class SyncQueryDto {
  source?: string
}

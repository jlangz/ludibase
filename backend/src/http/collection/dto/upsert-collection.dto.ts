import { IsArray, IsOptional, IsString } from 'class-validator'

export class UpsertCollectionBodyDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  platforms?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  storefronts?: string[]
}

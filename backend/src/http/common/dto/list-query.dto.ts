import { Type } from 'class-transformer'
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { PlatformFilter, SortMode } from '../../subscriptions/dto/family-listing.dto'

export class ListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string

  @IsOptional()
  @IsEnum(SortMode)
  sort: SortMode = SortMode.AlphaAsc

  @IsOptional()
  @IsEnum(PlatformFilter)
  platform?: PlatformFilter

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20
}

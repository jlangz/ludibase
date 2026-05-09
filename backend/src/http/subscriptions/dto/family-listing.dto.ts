import { Type } from 'class-transformer'
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

export enum SortMode {
  AlphaAsc = 'alpha-asc',
  AlphaDesc = 'alpha-desc',
  RatingAsc = 'rating-asc',
  RatingDesc = 'rating-desc',
}

export enum PlatformFilter {
  PC = 'pc',
  Console = 'console',
}

export class FamilyListingQueryDto {
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
  @IsString()
  tier?: string

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
  pageSize: number = 30
}

import {
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator'

export class SaveArticleDto {
  @IsUrl()
  @MaxLength(2048)
  url!: string

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title!: string

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string

  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  imageUrl?: string

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  source!: string

  @IsOptional()
  @IsISO8601()
  pubDate?: string
}

export class UnsaveArticleDto {
  @IsUrl()
  @MaxLength(2048)
  url!: string
}

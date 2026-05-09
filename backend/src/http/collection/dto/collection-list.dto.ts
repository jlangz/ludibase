import { IsBooleanString, IsOptional, IsString } from 'class-validator'
import { ListQueryDto } from '../../common/dto/list-query.dto'

export class CollectionListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  storefront?: string
}

export class CollectionSubscriptionsQueryDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  service?: string

  @IsOptional()
  @IsBooleanString()
  overlap?: string
}

export class CollectionAllQueryDto extends ListQueryDto {}

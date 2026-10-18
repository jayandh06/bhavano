import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsString, MaxLength, ValidateNested } from 'class-validator';

class AreaFaqDto {
  @IsString()
  @MaxLength(300)
  question!: string;

  @IsString()
  @MaxLength(1000)
  answer!: string;
}

/** The size limits here only stop abuse; the real content rules live in
 * `validateAreaOverviewContent` (@bhavano/types/areaOverview), which the service applies. */
export class SaveAreaOverviewDto {
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(2000, { each: true })
  about!: string[];

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(2000, { each: true })
  gettingAround!: string[];

  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => AreaFaqDto)
  faqs!: AreaFaqDto[];
}

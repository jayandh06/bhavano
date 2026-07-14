import { IsString, MinLength } from 'class-validator';

export class RecordViewDto {
  @IsString()
  @MinLength(1)
  viewerKey!: string;
}

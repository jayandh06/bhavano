import { IsString, MaxLength } from 'class-validator';

export class RecordPageViewDto {
  @IsString()
  @MaxLength(64)
  sessionId!: string;

  @IsString()
  @MaxLength(500)
  path!: string;
}

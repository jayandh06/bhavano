import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SendMoveToMobileDto {
  /** Free text such as "10 November"; left out, the message says "soon". */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  deadline?: string;
}

import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import {
  CONTACT_TOPICS,
  MESSAGE_MAX_LENGTH,
  MESSAGE_MIN_LENGTH,
  type ContactTopic,
} from '@bhavano/types/support';

/** Multipart form fields arrive as strings, so numeric/boolean-ish fields are parsed in the
 * controller rather than declared as non-string types here. */
export class CreateSupportTicketDto {
  @IsIn(CONTACT_TOPICS)
  topic!: ContactTopic;

  @IsString()
  @Length(1, 100)
  name!: string;

  @IsEmail({}, { message: 'email must be a valid email address' })
  @Length(1, 200)
  email!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'phone must be a 10-digit Indian mobile number',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  listingUrl?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  paymentId?: string;

  @IsString()
  @Length(MESSAGE_MIN_LENGTH, MESSAGE_MAX_LENGTH)
  message!: string;

  /** Honeypot — hidden from real users, so any value at all means a bot. Must stay optional so
   * a legitimate submission that omits it entirely still validates. */
  @IsOptional()
  @IsString()
  website?: string;

  /** Milliseconds the form was on screen before submit, as a string (multipart). */
  @IsOptional()
  @IsString()
  dwellMs?: string;

  /** Stamped by the web app's server action from the NextAuth session, never by the browser —
   * nothing in the client can reach this endpoint directly (see the BFF_INTERNAL_URL split), so
   * this is a trustworthy attribution rather than a claim to authorise anything against. */
  @IsOptional()
  @IsString()
  @Length(1, 50)
  userId?: string;
}

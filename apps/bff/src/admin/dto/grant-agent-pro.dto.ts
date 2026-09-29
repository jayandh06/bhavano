import { IsIn, IsInt, Max, Min } from 'class-validator';

export const AGENT_PRO_GRANT_REASONS = ['founding_broker'] as const;
export type AgentProGrantReason = (typeof AGENT_PRO_GRANT_REASONS)[number];

export class GrantAgentProDto {
  @IsInt()
  @Min(1)
  @Max(12)
  months!: number;

  @IsIn(AGENT_PRO_GRANT_REASONS)
  reason!: AgentProGrantReason;
}

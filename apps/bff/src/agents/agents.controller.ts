import { Controller, Get, Param } from '@nestjs/common';
import type { AgentStorefrontDto } from '@bhavano/types';
import { AgentsService } from './agents.service';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get(':id')
  getStorefront(@Param('id') id: string): Promise<AgentStorefrontDto> {
    return this.agentsService.getStorefront(id);
  }
}

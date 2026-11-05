import { PartialType } from '@nestjs/swagger';
import { CreateLeaveTypeDto } from './create-leave-type.dto.js';

export class UpdateLeaveTypeDto extends PartialType(CreateLeaveTypeDto) {}


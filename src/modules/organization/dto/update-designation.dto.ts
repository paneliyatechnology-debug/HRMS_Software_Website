import { PartialType } from '@nestjs/swagger';
import { CreateDesignationDto } from './create-designation.dto.js';

export class UpdateDesignationDto extends PartialType(CreateDesignationDto) {}


import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfilePhotoDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Profile photo image file (JPEG, PNG, WebP up to 5 MB)',
  })
  profilePhoto: any;
}

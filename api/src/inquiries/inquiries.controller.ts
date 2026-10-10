import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/auth';
import { InquiryDto } from '../vehicles/vehicles.dto';
import { InquiriesService } from './inquiries.service';

@Controller()
export class InquiriesController {
  constructor(private readonly inquiries: InquiriesService) {}

  @Post('vehicles/:id/inquiries')
  start(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: InquiryDto) {
    return this.inquiries.start(user.id, id, dto.body);
  }

  @Get('inquiries')
  list(@CurrentUser() user: AuthUser) {
    return this.inquiries.list(user.id);
  }

  @Get('inquiries/:id')
  thread(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.inquiries.thread(user.id, id, user.roles.includes('admin'));
  }

  @Post('inquiries/:id/messages')
  reply(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: InquiryDto) {
    return this.inquiries.reply(user.id, id, dto.body);
  }
}

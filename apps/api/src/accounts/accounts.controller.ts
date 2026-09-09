import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccountsService } from './accounts.service';
import { OnboardPartnerDto } from './dto/onboard-partner.dto';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';
import { AdminUpdatePartnerDto } from './dto/admin-update-partner.dto';
import { AdminSetPartnerLockDto } from './dto/admin-set-partner-lock.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(private readonly service: AccountsService) {}

  @Post('admin/partners/onboard-with-stock')
  onboardPartner(@CurrentUser() admin: AuthenticatedUser, @Body() dto: OnboardPartnerDto) {
    return this.service.onboardPartnerWithStock(admin, dto);
  }

  @Patch('admin/partners/:id/account')
  updatePartner(@CurrentUser() admin: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminUpdatePartnerDto) {
    return this.service.adminUpdatePartner(admin, id, dto);
  }

  @Delete('admin/partners/:id')
  deletePartner(@CurrentUser() admin: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.adminDeletePartner(admin, id);
  }

  @Patch('admin/partners/:id/lock')
  setPartnerLock(@CurrentUser() admin: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminSetPartnerLockDto) {
    return this.service.adminSetPartnerLock(admin, id, dto.locked);
  }

  @Get('profile')
  profile(@CurrentUser() user: AuthenticatedUser) { return this.service.getOwnProfile(user); }

  @Patch('profile')
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateOwnProfileDto) {
    return this.service.updateOwnProfile(user, dto);
  }

  @Post('profile/image')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024 } }))
  profileImage(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file?: { buffer: Buffer; mimetype: string; originalname: string }) {
    return this.service.saveProfileImage(user, file);
  }
}

@Controller('profile/images')
export class ProfileImagesController {
  constructor(private readonly service: AccountsService) {}
  @Get(':filename') image(@Param('filename') filename: string) { return this.service.profileImage(filename); }
}

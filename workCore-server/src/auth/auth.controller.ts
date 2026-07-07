import {Controller, Get, Post, Body, Patch, Param, Delete, Req, Res} from '@nestjs/common';
import { AuthService } from './auth.service';
import {CreateUserDto} from "./dto/registration.dto";
import {Request, Response} from "express";
import {UserLoginDto} from "./dto/login.dto";
import { Throttle } from '@nestjs/throttler';
import {
  ForgotPasswordDto,
  ResendVerificationDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/password-reset.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Захист від масової реєстрації: 3 спроби за хвилину
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post("register")
  create(@Req() request: Request, @Body() createAuthDto: CreateUserDto) {
    return this.authService.create(request, createAuthDto);
  }

  // Захист від брутфорсу пароля: 5 спроб за хвилину
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("login")
  login(@Req() request: Request, @Body() userLoginDto: UserLoginDto) {
    return this.authService.login(request, userLoginDto);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('resend-verification')
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto.email);
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Post("logout")
  logout(@Res({passthrough: true}) res: Response, @Req() req: Request): Promise<void> {
    return this.authService.logout(res, req);
  }
}

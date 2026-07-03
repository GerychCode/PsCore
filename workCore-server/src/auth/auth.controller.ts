import {Controller, Get, Post, Body, Patch, Param, Delete, Req, Res} from '@nestjs/common';
import { AuthService } from './auth.service';
import {CreateUserDto} from "./dto/registration.dto";
import {Request, Response} from "express";
import {UserLoginDto} from "./dto/login.dto";
import { Throttle } from '@nestjs/throttler';

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

  @Post("logout")
  logout(@Res({passthrough: true}) res: Response, @Req() req: Request): Promise<void> {
    return this.authService.logout(res, req);
  }
}

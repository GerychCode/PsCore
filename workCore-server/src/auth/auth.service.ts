import {BadRequestException, Injectable, InternalServerErrorException} from '@nestjs/common';
import {UserService} from "../user/user.service";
import {CreateUserDto} from "./dto/registration.dto";
import {User} from "../../generated/prisma";
import {Request, Response} from "express";
import {UserLoginDto} from "./dto/login.dto";
import * as bcrypt from 'bcrypt';
import {ConfigService} from "@nestjs/config";
import {UserDto} from "../user/dto/user.dto";

@Injectable()
export class AuthService {

  constructor(
      private userService: UserService,
      private configService: ConfigService
  ) {}
  async create(req: Request, createUserDto: CreateUserDto){
    const isExistEmail = await this.userService.findByEmail(createUserDto.email);
    if(isExistEmail){
      throw new BadRequestException("Пошта вже використовується");
    }

    const newUser = await this.userService.create({
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      email: createUserDto.email,
      password: createUserDto.password
    })

    return this.saveSession(req, newUser);
  }
  async login(req: Request, userLoginDto: UserLoginDto){
    const findUser = await this.userService.findByEmail(userLoginDto.email);
    if(!findUser || !findUser.passwordHash){
      throw new BadRequestException("Пошту не знайено!");
    }

    const validPassword = bcrypt.compareSync(userLoginDto.password, findUser.passwordHash);
    if (!validPassword) throw new BadRequestException("Невірний пароль!");

    return this.saveSession(req, findUser);
  }

  logout(res: Response, req: Request): Promise<void> {
    return new Promise((resolve, reject) => {
      req.session.destroy(err => {
        if(err){
         return reject( new InternalServerErrorException("Не вдалося завершити сесію!"))
        }
      })
      res.clearCookie(this.configService.getOrThrow<string>('SESSION_NAME'))
      resolve()
    })
  }

  private async saveSession(req: Request, user: UserDto) {
    return new Promise((resolve, reject) => {
      req.session.userId= user.id;

      req.session.save(err => {
        if (err) {
          return reject(
              new InternalServerErrorException(
                  'Не удалось сохранить сессию. Проверьте, правильно ли настроены параметры сессии.'
              )
          );
        }

        resolve(undefined);
      });
    });
  }

}

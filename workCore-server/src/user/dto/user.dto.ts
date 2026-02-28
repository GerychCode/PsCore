import { Exclude, Expose } from 'class-transformer';

export class UserDto {
  @Expose() id: number;
  @Expose() firstName: string;
  @Expose() lastName: string;
  @Expose() email: string;
  @Expose() phone: string;
  @Expose() address: string;
  @Expose() avatar: string;
  @Expose() dateOfBirth: Date;
  @Expose() role: string;

  @Exclude()
  passwordHash: string;

  constructor(partial: Partial<UserDto>) {
    Object.assign(this, partial);
  }
}
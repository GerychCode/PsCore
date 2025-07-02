import { axiosClassic } from "@/api/interceptors";
import { IUserLogin, IUserRegister } from "@/interface/IUserAuth";
import { IUserUpdate } from '@/interface/IUserUpdate'

class UserService {
  public async getUserData() {
    return await axiosClassic.get(`/user`);
  }

  public async getUsersData() {
    return await axiosClassic.get(`/user/list`);
  }

  public async updateUser(data : IUserUpdate) {
    return await axiosClassic.put(`/user`, data);
  }
}

export const userService = new UserService();

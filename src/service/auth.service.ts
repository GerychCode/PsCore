import { axiosClassic } from "@/api/interceptors";
import { IUserLogin, IUserRegister } from "@/interface/IUserAuth";

class AuthService {
  public async login(data: IUserLogin) {
    return await axiosClassic.post(`/auth/login`, data);
  }

  public async register(data: IUserRegister) {
    return await axiosClassic.post(`/auth/register`, data);
  }
  public async logout() {
    return await axiosClassic.post(`/auth/logout`);
  }
}
export const authService = new AuthService();

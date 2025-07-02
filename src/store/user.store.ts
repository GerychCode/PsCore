import { create } from "zustand";
import { IUser } from "@/interface/IUser";

interface UserStore {
  user: IUser | null;
  updateUser: (user: IUser) => void;
}

export const userStore = create<UserStore>((set) => ({
  user: null,
  updateUser: (user: IUser) => set(() => ({ user })),
}));

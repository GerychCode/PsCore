"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { userService } from "@/service/user.service";
import { toast } from "sonner";
import { authService } from "@/service/auth.service";
import { userStore } from "@/store/user.store";
import { IUser } from "@/interface/IUser";
import { IoIosMenu, IoIosSettings } from "react-icons/io";
import { Sidebar } from "@/app/components/Sidebar/Sidebar";
import Avatar from "@/app/components/user/Avatar";
import { capitalize } from "@/utils/capitalize";
import { FaBell } from "react-icons/fa";
import Profile from "@/app/components/user/Profile";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = userStore((state) => state.user);
  const { mutate } = useMutation({
    mutationKey: ["getUserOnLoad"],
    mutationFn: async () => {
      const user = await userService.getUserData();
      if (!user.data) {
        toast.error("Не вдалось завантажити профіль!");
        await authService.logout();
      }
      userStore.getState().updateUser(user.data as IUser);
    },
  });
  const [sideBarIsCollapsed, SetSideBarIsCollapsed] = useState(false);

  useEffect(() => {
    mutate();
  }, []);
  return (
    <main className="flex flex-row w-full h-full">
      <Sidebar collapsed={sideBarIsCollapsed} />
      <section className="flex flex-col w-full z-0">
        <div className="h-full max-h-20 w-full flex justify-between items-center p-5">
          <IoIosMenu
            className="text-3xl hover:opacity-75 cursor-pointer text-secondary"
            onClick={() => SetSideBarIsCollapsed(!sideBarIsCollapsed)}
          />
          <div className="flex items-center justify-between gap-6">
            <FaBell className="text-2xl hover:opacity-75 cursor-pointer text-secondary" />
            <IoIosSettings className="text-3xl hover:opacity-75 cursor-pointer text-secondary" />
            <Profile />
          </div>
        </div>
        <section className="flex-grow overflow-y-auto p-5">{children}</section>
      </section>
    </main>
  );
}

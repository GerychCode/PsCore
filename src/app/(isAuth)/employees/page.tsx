"use client";
import React, { useEffect, useState } from "react";
import EmployeeBlock from "@/app/(isAuth)/employees/employee.block";
import { IUser } from "@/interface/IUser";
import { useMutation } from "@tanstack/react-query";
import { userService } from "@/service/user.service";
import { toast } from "sonner";
import { authService } from "@/service/auth.service";

const Page = () => {
  const [userList, setUserList] = useState<IUser[]>([]);
  const { mutate } = useMutation({
    mutationKey: ["getUsersList"],
    mutationFn: async () => {
      const users = await userService.getUsersData();
      if (!users.data) {
        toast.error("Не вдалось завантажити користувачів!");
        await authService.logout();
      } else setUserList(users.data);
    },
  });

  useEffect(() => {
    mutate();
  }, []);
  return (
    <div className="px-3">
      <div className="grid grid gap-6 grid-cols-[repeat(auto-fit,minmax(22rem,1fr))]">
        {userList.map((employee: IUser) => {
          return (
            <EmployeeBlock
              onClick={() => {}}
              key={employee.id}
              user={employee}
            />
          );
        })}
      </div>
    </div>
  );
};

export default Page;

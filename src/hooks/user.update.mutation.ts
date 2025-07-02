"use client";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { authService } from "@/service/auth.service";
import { toast } from "sonner";
import { IUserUpdate } from '@/interface/IUserUpdate'
import { userService } from '@/service/user.service'

export function userUpdate(data : IUserUpdate) {

  const { mutate, isPending } = useMutation({
    mutationKey: ["updateUser"],
    mutationFn: async () => await userService.updateUser(data),
    onSuccess: () => {
      toast.success("Дані оновлено!");
    },
    onError: (error) => toast.error(error.message),
  });

  return { mutate, isPending };
}

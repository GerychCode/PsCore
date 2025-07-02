"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { authService } from "@/service/auth.service";
import { PathConfig } from "@/config/path.config";
import { toast } from "sonner";
import axios from "axios";
import { FiLogOut } from "react-icons/fi";

export const LogoutButton = () => {
  const router = useRouter();

  const { mutate, isPending } = useMutation({
    mutationKey: ["logout"],
    mutationFn: async () => await authService.logout(),
    onSuccess: () => {
      toast.success("Ви вийшли з аккаунту");
      router.push(PathConfig.LOGIN);
    },
    onError: (error: unknown | Error) => {
      if (axios.isAxiosError(error)) {
        const data = error.response?.data;
        toast.error(data.message || error.message);
      } else toast.error("Виникла помилка, спробуйте пізніше!");
    },
  });

  return (
    <button
      onClick={() => mutate()}
      disabled={isPending}
      className="text-3xl hover:opacity-75 text-secondary"
    >
      <FiLogOut />
    </button>
  );
};

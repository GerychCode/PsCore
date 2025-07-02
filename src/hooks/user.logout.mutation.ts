"use client";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { authService } from "@/service/auth.service";
import { PathConfig } from "@/config/path.config";
import { toast } from "sonner";

export function userLogout() {
  const router = useRouter();

  const { mutate, isPending } = useMutation({
    mutationKey: ["logout"],
    mutationFn: async () => await authService.logout(),
    onSuccess: () => {
      toast.success("Ви вийшли з аккаунту");
      router.push(PathConfig.LOGIN);
    },
    onError: (error) => toast.error(error.message),
  });

  return { mutate, isPending };
}

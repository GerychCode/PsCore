import { IconType } from "react-icons";
import { RiAccountCircleLine } from "react-icons/ri";
import { PiUsersThreeBold } from "react-icons/pi";
import { LuLayoutDashboard } from "react-icons/lu";
import { CgProfile } from "react-icons/cg";

interface ISidebarMenu {
  title: string;
  icon?: IconType;
  path: string;
}
export const sidebarMenuConfig: ISidebarMenu[] = [
  {
    title: "Профіль",
    icon: CgProfile,
    path: "/profile",
  },
  {
    title: "Головне меню",
    icon: LuLayoutDashboard,
    path: "/dashboard",
  },
  {
    title: "Співробітники",
    icon: PiUsersThreeBold,
    path: "/employees",
  },
];

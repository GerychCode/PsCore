import { IconType } from 'react-icons'
import { PiUsersThreeBold } from 'react-icons/pi'
import { LuLayoutDashboard } from 'react-icons/lu'
import { CgProfile } from 'react-icons/cg'
import {FaRegCalendarAlt} from "react-icons/fa";
import { HiOutlineOfficeBuilding } from "react-icons/hi";

interface ISidebarMenu {
  title: string
  icon?: IconType
  path: string
}
export const sidebarMenuConfig: ISidebarMenu[] = [
  {
    title: 'Профіль',
    icon: CgProfile,
    path: '/profile',
  },
  {
    title: 'Головне меню',
    icon: LuLayoutDashboard,
    path: '/dashboard',
  },
  {
    title: 'Співробітники',
    icon: PiUsersThreeBold,
    path: '/employees',
  },
  {
    title: 'Графік роботи',
    icon: FaRegCalendarAlt,
    path: '/schedule',
  },
  {
    title: 'Відділення',
    icon: HiOutlineOfficeBuilding,
    path: '/departments',
  },
]
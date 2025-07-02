import React from "react";
import Avatar from "@/app/components/user/Avatar";
import { capitalize } from "@/utils/capitalize";
import { userStore } from "@/store/user.store";
import Link from "next/link";
import { PathConfig } from "@/config/path.config";

const Profile = () => {
  const user = userStore((state) => state.user);
  return (
    <Link href={PathConfig.PROFILE} className="flex items-center gap-3 ">
      <Avatar />
      <div className="flex flex-col">
        <h1 className="text-xl font-semibold text-black">
          {capitalize(user?.firstName)} {capitalize(user?.lastName)}
        </h1>
        <p className="text-sm text-secondary">{user?.email}</p>
      </div>
    </Link>
  );
};

export default Profile;

"use client";
import React, { useState } from 'react'
import Avatar from "@/app/components/user/Avatar";
import { userStore } from "@/store/user.store";
import { FaEdit } from "react-icons/fa";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import ProfileModal from '@/app/(isAuth)/profile/Profile.Modal'


const Page = () => {
  const user = userStore((state) => state.user);
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex h-auto w-full rounded-2xl shadow-xs border-1 border-secondary/10 p-6 gap-5 justify-between bg-white">
      <div className="flex items-center gap-5">
        <Avatar size={8} />
        <div className="flex items-left gap-3 flex-col justify-center w-full">
          <div>
            <h3 className="font-semibold text-black text-3xl">
              {user?.firstName} {user?.lastName}
            </h3>
            <p className="text-xl text-secondary">{user?.email}</p>
          </div>
          <p className="text-xl text-primary ">{user?.role}</p>
        </div>
      </div>
      <div className="flex self-stretch items-center gap-5">
        <div className="h-full w-0.5 bg-secondary"></div>
        <div>
          <p>День народження: {user?.dateOfBirth ? format(new Date(user?.dateOfBirth), "dd MMM yyyy", { locale: uk }) : "-"}</p>
          <p>
            Акаунт створено:{" "}
            {user?.createdAt
              ? format(new Date(user?.createdAt), "dd MMM yyyy", { locale: uk })
              : "-"}
          </p>
          <p>Посада: {user?.role ? user?.role : "-"}</p>
        </div>
      </div>
      <FaEdit
        className="text-secondary text-xl hover:opacity-75"
        onClick={() => {
          setIsModalOpen(true);
        }}
      />
      <ProfileModal isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen} />
    </div>
  );
};

export default Page;

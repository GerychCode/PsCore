"use client";
import React from "react";
import { userStore } from "@/store/user.store";

const Page = () => {
  const user = userStore((state) => state.user);
  return <div>{user?.email}</div>;
};

export default Page;

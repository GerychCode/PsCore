import React from "react";
import { IUser } from "@/interface/IUser";
import Avatar from "@/app/components/user/Avatar";
import { ImMail4 } from "react-icons/im";

interface Props {
  user: IUser;
  onClick?: () => void;
}

const EmployeeBlock = ({ user, onClick }: Props) => {
  const onClickEvent = () => {};

  return (
    <div
      onClick={onClick}
      key={user.id}
      className="bg-white flex flex-col cursor-pointer max-w-168 w-full flex items-center justify-center text-white rounded-xl shadow-xs border-1 border-secondary/10 transform transition-transform duration-300 hover:scale-101 p-5 gap-5"
    >
      <div className="flex flex-row justify-between items-center w-full gap-5">
        <Avatar size={5.6} />
        <div className="flex items-left gap-3 flex-col justify-center w-full">
          <div>
            <h3 className="font-semibold text-black text-xl">
              {user.firstName} {user.lastName}
            </h3>
            <p className="text-sm text-secondary">{user?.email}</p>
          </div>
          <p className="text-md text-primary ">{user?.role}</p>
        </div>
      </div>
      {/*<div className="flex flex-row items-center w-full gap-3">*/}
      {/*    <ImMail4 className="text-primary text-3xl hover:opacity-75" />*/}
      {/*    <p className="text-md text-black">{user?.email}</p>*/}
      {/*</div>*/}
    </div>
  );
};

export default EmployeeBlock;

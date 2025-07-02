"use client";

import { motion } from "framer-motion";
import Image from "next/image";

interface SidebarLogoProps {
  collapsed: boolean;
}

export function SidebarLogo({ collapsed }: SidebarLogoProps) {
  return (
    <div className={`h-16 flex items-center justify-center`}>
      <motion.div
        layout
        style={{
          width: collapsed ? 45 : 120,
          height: "auto",
          position: "relative",
          transformOrigin: "center left",
        }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
      >
        <Image
          src="/logo.svg"
          alt="Лого"
          width={collapsed ? 45 : 120}
          height={0}
          style={{
            height: "auto",
            width: "100%",
            objectFit: "contain",
            display: "block",
          }}
          priority
        />
      </motion.div>
    </div>
  );
}

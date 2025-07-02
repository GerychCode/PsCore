"use client";
import Image from "next/image";

interface IAvatar {
  src?: string;
  size?: number; // в rem
}

export default function Avatar({ src = "/test-ava.jpg", size = 3.5 }: IAvatar) {
  const remSize = `${size}rem`;

  return (
    <div
      style={{ width: remSize, height: remSize }}
      className="relative rounded-full overflow-hidden flex items-center justify-center shadow-sm shrink-0"
    >
      {src ? (
        <Image
          src={src}
          alt="Avatar"
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50px"
        />
      ) : (
        <span className="text-gray-500 text-xs">No image</span>
      )}
    </div>
  );
}

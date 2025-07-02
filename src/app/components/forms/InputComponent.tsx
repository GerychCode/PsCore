import React, { useEffect, useId, useRef, useState } from "react";
import Image, { StaticImageData } from "next/image";
import { MdOutlineVisibility, MdOutlineVisibilityOff } from "react-icons/md";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { format, formatISO } from "date-fns";
import { uk } from "date-fns/locale";
import { FaCalendarAlt } from "react-icons/fa";

interface IInput {
  id?: string;
  label?: string | null;
  defaultValue?: string;
  name?: string | null;
  type?: "text" | "password" | "email" | "number" | "tel" | "url" | "date";
  ico?: StaticImageData | string | null;
  errors?: string | null;
  placeholder?: string;
  onSelect?: (date: any) => void;
}

const InputComponent = ({
  id = useId(),
  label = null,
  name = null,
  defaultValue = "",
  type = "text",
  ico = null,
  errors = null,
  placeholder = "",
  onSelect,
  ...inputProps
}: IInput) => {
  const [isVisiblePassword, setIsVisiblePassword] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    defaultValue ? new Date(defaultValue) : undefined,
  );

  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setShowCalendar(false);
      }
    };

    if (showCalendar) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showCalendar]);

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setShowCalendar(false);
    onSelect?.(date ? formatISO(date) : undefined);
  };

  const formattedDate =
    selectedDate instanceof Date && !isNaN(selectedDate.getTime())
      ? format(selectedDate, "yyyy-MM-dd")
      : "";

  return (
    <section
      ref={wrapperRef}
      className="flex flex-col items-left w-full gap-1.5 relative"
    >
      {label && (
        <div className="flex justify-between items-center mb-1">
          <label className="text-base font-medium" htmlFor={id}>
            {label}
          </label>
          {errors && (
            <span className="text-sm text-red-500 overflow-hidden text-ellipsis whitespace-nowrap">
              {errors}
            </span>
          )}
        </div>
      )}

      <div
        className={`h-12 w-full rounded-2xl border-2 border-gray-200 p-3 flex items-center gap-3 ${
          type === "date" && "cursor-pointer"
        }`}
        onClick={() => {
          if (type === "date") setShowCalendar(true);
        }}
      >
        {ico && <Image width={24} height={24} src={ico} alt={type} />}
        {type === "date" ? (
          <>
            <input
              readOnly
              className="w-full bg-transparent outline-none"
              id={id}
              name={name ?? ""}
              value={formattedDate}
              placeholder={placeholder || "Оберіть дату"}
              {...inputProps}
            />
            <FaCalendarAlt className="text-secondary text-xl hover:opacity-75" />
          </>
        ) : (
          <input
            className="w-full bg-transparent outline-none"
            id={id}
            name={name ?? ""}
            defaultValue={defaultValue}
            type={
              type !== "password"
                ? type
                : isVisiblePassword
                  ? "text"
                  : "password"
            }
            placeholder={placeholder}
            {...inputProps}
          />
        )}

        {type === "password" && (
          <button
            type="button"
            onClick={() => setIsVisiblePassword((prev) => !prev)}
            className="focus:outline-none"
          >
            {isVisiblePassword ? (
              <MdOutlineVisibility className="text-2xl hover:opacity-75" />
            ) : (
              <MdOutlineVisibilityOff className="text-2xl hover:opacity-75" />
            )}
          </button>
        )}
      </div>

      {type === "date" && showCalendar && (
        <div className="absolute bottom-[100%] left-0 z-50 bg-white border-2 border-gray-200 rounded-xl shadow-sm mt-2 p-2">
          <DayPicker
            mode="single"
            animate
            captionLayout="dropdown"
            selected={selectedDate}
            onSelect={handleDateSelect}
            disabled={{ after: new Date() }}
            locale={uk}
          />
        </div>
      )}
    </section>
  );
};

export default InputComponent;

"use client";

import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/utils/cn";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

type DatePickerProps = {
  value?: string;
  onChange: (date: string) => void;
  placeholder?: string;
  className?: string;
};

export function DatePicker({ value, onChange, placeholder = "Sélectionner", className }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"years" | "months" | "days">("days");
  const [viewDate, setViewDate] = useState(() => value ? new Date(value) : new Date());

  const selected = value ? new Date(value) : undefined;

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  const MONTHS = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
  ];

  const years = Array.from({ length: 12 }, (_, i) => currentYear - 5 + i);

  const handleSelect = (day: Date | undefined) => {
    if (day) {
      onChange(format(day, "yyyy-MM-dd"));
      setOpen(false);
      setView("days");
    }
  };

  const handleYearClick = (year: number) => {
    setViewDate(new Date(year, currentMonth, 1));
    setView("months");
  };

  const handleMonthClick = (month: number) => {
    setViewDate(new Date(currentYear, month, 1));
    setView("days");
  };

  const handleCaptionClick = () => {
    if (view === "days") setView("months");
    else if (view === "months") setView("years");
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setView("days"); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 w-40 justify-start text-left font-normal text-sm",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
          {selected ? format(selected, "dd MMM yyyy", { locale: fr }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {view === "years" && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setViewDate(new Date(currentYear - 12, currentMonth, 1))}
              >
                &lt;
              </Button>
              <span className="text-sm font-semibold">{years[0]} — {years[years.length - 1]}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setViewDate(new Date(currentYear + 12, currentMonth, 1))}
              >
                &gt;
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {years.map((y) => (
                <Button
                  key={y}
                  variant={y === new Date().getFullYear() ? "default" : "ghost"}
                  size="sm"
                  className={cn("h-9 text-sm", selected && selected.getFullYear() === y && "ring-2 ring-primary")}
                  onClick={() => handleYearClick(y)}
                >
                  {y}
                </Button>
              ))}
            </div>
          </div>
        )}

        {view === "months" && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setViewDate(new Date(currentYear - 1, currentMonth, 1))}
              >
                &lt;
              </Button>
              <Button variant="ghost" size="sm" className="text-sm font-semibold" onClick={() => setView("years")}>
                {currentYear}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setViewDate(new Date(currentYear + 1, currentMonth, 1))}
              >
                &gt;
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {MONTHS.map((m, i) => (
                <Button
                  key={m}
                  variant={i === new Date().getMonth() && currentYear === new Date().getFullYear() ? "default" : "ghost"}
                  size="sm"
                  className={cn("h-9 text-xs", selected && selected.getMonth() === i && selected.getFullYear() === currentYear && "ring-2 ring-primary")}
                  onClick={() => handleMonthClick(i)}
                >
                  {m.slice(0, 3)}
                </Button>
              ))}
            </div>
          </div>
        )}

        {view === "days" && (
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            month={viewDate}
            onMonthChange={setViewDate}
            locale={fr}
            showOutsideDays
            className="p-3"
            classNames={{
              months: "flex flex-col",
              month: "flex flex-col gap-3",
              caption: "flex justify-center pt-1 relative items-center w-full",
              caption_label: "text-sm font-medium cursor-pointer hover:text-primary transition-colors",
              nav: "flex items-center gap-1",
              nav_button: "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
              nav_button_previous: "absolute left-1",
              nav_button_next: "absolute right-1",
              table: "w-full border-collapse",
              head_row: "flex",
              head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
              row: "flex w-full mt-1",
              cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected])]:rounded-md",
              day: "inline-flex items-center justify-center rounded-md text-sm h-8 w-8 p-0 font-normal hover:bg-accent hover:text-accent-foreground aria-selected:opacity-100",
              day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
              day_today: "bg-accent text-accent-foreground font-semibold",
              day_outside: "text-muted-foreground opacity-50",
              day_disabled: "text-muted-foreground opacity-50",
              day_hidden: "invisible",
            }}
            components={{
              CaptionLabel: ({ displayMonth }) => (
                <button type="button" onClick={handleCaptionClick} className="text-sm font-medium hover:text-primary transition-colors">
                  {format(displayMonth, "MMMM yyyy", { locale: fr })}
                </button>
              ),
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

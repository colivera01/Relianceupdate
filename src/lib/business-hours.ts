export type BusinessHoursDayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type BusinessHoursDay = {
  day: BusinessHoursDayKey;
  enabled: boolean;
  open: string;
  close: string;
};

export type BusinessHoursSchedule = {
  timezone?: string | null;
  days: BusinessHoursDay[];
};

export type BusinessHoursStatus = {
  configured: boolean;
  openNow: boolean | null;
  label: string;
  todayLabel: string | null;
};

const DAY_KEYS: BusinessHoursDayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DISPLAY_ORDER: BusinessHoursDayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const DAY_LABELS: Record<BusinessHoursDayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export function defaultBusinessHours(): BusinessHoursSchedule {
  return {
    timezone: null,
    days: DISPLAY_ORDER.map((day) => ({
      day,
      enabled: day !== "sat" && day !== "sun",
      open: "09:00",
      close: "17:00",
    })),
  };
}

function normalizeTime(value: unknown, fallback: string): string {
  const text = String(value || "").trim();
  return /^\d{2}:\d{2}$/.test(text) ? text : fallback;
}

export function normalizeBusinessHours(value: unknown): BusinessHoursSchedule {
  const fallback = defaultBusinessHours();
  const raw =
    typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value);
          } catch {
            return null;
          }
        })()
      : value;
  const rawDays = raw && typeof raw === "object" ? (raw as any).days : null;
  if (!Array.isArray(rawDays)) return fallback;

  const byDay = new Map<string, any>();
  for (const day of rawDays) {
    const key = String(day?.day || "").trim().toLowerCase();
    if (DISPLAY_ORDER.includes(key as BusinessHoursDayKey)) byDay.set(key, day);
  }

  return {
    timezone:
      raw && typeof raw === "object" && typeof (raw as any).timezone === "string"
        ? String((raw as any).timezone).trim() || null
        : null,
    days: DISPLAY_ORDER.map((day) => {
      const existing = byDay.get(day);
      return {
        day,
        enabled: Boolean(existing?.enabled),
        open: normalizeTime(existing?.open, "09:00"),
        close: normalizeTime(existing?.close, "17:00"),
      };
    }),
  };
}

export function serializeBusinessHours(schedule: BusinessHoursSchedule): string {
  return JSON.stringify(normalizeBusinessHours(schedule));
}

function minutesFromTime(value: string): number {
  const [hoursRaw, minutesRaw] = value.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return Math.max(0, Math.min(23, hours)) * 60 + Math.max(0, Math.min(59, minutes));
}

export function formatBusinessTime(value: string): string {
  const totalMinutes = minutesFromTime(value);
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function dayForDate(date: Date): BusinessHoursDayKey {
  return DAY_KEYS[date.getDay()];
}

function statusForDay(schedule: BusinessHoursSchedule, date: Date): BusinessHoursStatus {
  const dayKey = dayForDate(date);
  const day = schedule.days.find((entry) => entry.day === dayKey) || null;
  const configured = schedule.days.some((entry) => entry.enabled);
  if (!configured) {
    return {
      configured: false,
      openNow: null,
      label: "Hours not listed",
      todayLabel: null,
    };
  }
  if (!day?.enabled) {
    return {
      configured: true,
      openNow: false,
      label: "Closed today",
      todayLabel: `${DAY_LABELS[dayKey]}: Closed`,
    };
  }
  const open = minutesFromTime(day.open);
  const close = minutesFromTime(day.close);
  const now = date.getHours() * 60 + date.getMinutes();
  const openNow = close > open ? now >= open && now < close : now >= open || now < close;
  return {
    configured: true,
    openNow,
    label: openNow ? `Open now until ${formatBusinessTime(day.close)}` : `Closed - opens ${formatBusinessTime(day.open)}`,
    todayLabel: `${DAY_LABELS[dayKey]}: ${formatBusinessTime(day.open)}-${formatBusinessTime(day.close)}`,
  };
}

export function getBusinessHoursStatus(
  value: string | BusinessHoursSchedule | null | undefined,
  date = new Date()
): BusinessHoursStatus {
  if (value == null || value === "") {
    return {
      configured: false,
      openNow: null,
      label: "Hours not listed",
      todayLabel: null,
    };
  }
  return statusForDay(normalizeBusinessHours(value || null), date);
}

type HolidayEntry = {
  key: string;
  name: string;
};

const holidayCache = new Map<number, HolidayEntry[]>();

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function nextMonday(date: Date) {
  const weekday = date.getDay();
  if (weekday === 1) return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = weekday === 0 ? 1 : 8 - weekday;
  return addDays(date, offset);
}

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function buildHolidayEntries(year: number) {
  const cached = holidayCache.get(year);
  if (cached) return cached;

  const easter = easterSunday(year);
  const entries: HolidayEntry[] = [
    { key: toDateKey(new Date(year, 0, 1)), name: "Anio Nuevo" },
    { key: toDateKey(nextMonday(new Date(year, 0, 6))), name: "Reyes Magos" },
    { key: toDateKey(nextMonday(new Date(year, 2, 19))), name: "San Jose" },
    { key: toDateKey(addDays(easter, -3)), name: "Jueves Santo" },
    { key: toDateKey(addDays(easter, -2)), name: "Viernes Santo" },
    { key: toDateKey(new Date(year, 4, 1)), name: "Dia del Trabajo" },
    { key: toDateKey(nextMonday(addDays(easter, 39))), name: "Ascension del Senor" },
    { key: toDateKey(nextMonday(addDays(easter, 60))), name: "Corpus Christi" },
    { key: toDateKey(nextMonday(addDays(easter, 68))), name: "Sagrado Corazon" },
    { key: toDateKey(nextMonday(new Date(year, 5, 29))), name: "San Pedro y San Pablo" },
    { key: toDateKey(new Date(year, 6, 20)), name: "Independencia de Colombia" },
    { key: toDateKey(new Date(year, 7, 7)), name: "Batalla de Boyaca" },
    { key: toDateKey(nextMonday(new Date(year, 7, 15))), name: "Asuncion de la Virgen" },
    { key: toDateKey(nextMonday(new Date(year, 9, 12))), name: "Dia de la Raza" },
    { key: toDateKey(nextMonday(new Date(year, 10, 1))), name: "Todos los Santos" },
    { key: toDateKey(nextMonday(new Date(year, 10, 11))), name: "Independencia de Cartagena" },
    { key: toDateKey(new Date(year, 11, 8)), name: "Inmaculada Concepcion" },
    { key: toDateKey(new Date(year, 11, 25)), name: "Navidad" },
  ];

  const uniqueEntries = Array.from(new Map(entries.map((entry) => [entry.key, entry])).values());
  holidayCache.set(year, uniqueEntries);
  return uniqueEntries;
}

export function getColombiaHolidayName(date: Date) {
  const key = toDateKey(date);
  return buildHolidayEntries(date.getFullYear()).find((entry) => entry.key === key)?.name ?? null;
}

export function isColombiaHoliday(date: Date) {
  return Boolean(getColombiaHolidayName(date));
}

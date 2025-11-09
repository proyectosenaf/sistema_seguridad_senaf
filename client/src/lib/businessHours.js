// Rangos válidos: [08:00, 12:00) y [13:00, 17:00) hora local.
export function isWithinBusinessHours(date) {
  if (!(date instanceof Date) || isNaN(date)) return false;
  const minutes = date.getHours() * 60 + date.getMinutes();
  const AM_START = 8 * 60;   // 08:00
  const AM_END   = 12 * 60;  // 12:00 (excluido)
  const PM_START = 13 * 60;  // 13:00
  const PM_END   = 17 * 60;  // 17:00 (excluido)
  return (minutes >= AM_START && minutes < AM_END) ||
         (minutes >= PM_START && minutes < PM_END);
}

export function businessHoursMessage() {
  return "Horario permitido: 8:00–12:00 y 13:00–17:00 (12:00 y 17:00 no permitidas).";
}

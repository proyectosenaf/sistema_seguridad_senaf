export const yyyymm = (d = new Date()) => new Date(d).toISOString().slice(0,7); // "YYYY-MM"
export const yyyymmdd = (d = new Date()) => new Date(d).toISOString().slice(0,10); // "YYYY-MM-DD"
export const hhmm = (d = new Date()) => new Date(d).toISOString().slice(11,16); // "HH:MM"  
/**
 * Fetches Islamic public holidays for the current Gregorian year by converting
 * fixed Hijri calendar dates using the aladhan.com API.
 * Results are cached at module level to avoid repeated network calls.
 */

export interface IslamicHoliday {
  gregorianDate: string; // "YYYY-MM-DD"
  name: string;
  hijriLabel: string;    // e.g. "1 Muharram 1447H"
}

// Fixed Hijri dates for annual Islamic observances
const HIJRI_HOLIDAYS = [
  { day: 1,  month: 1,  name: "Awal Muharram" },
  { day: 10, month: 1,  name: "Hari Asyura" },
  { day: 12, month: 3,  name: "Maulidur Rasul" },
  { day: 27, month: 7,  name: "Israk Mikraj" },
  { day: 15, month: 8,  name: "Nisfu Syaaban" },
  { day: 1,  month: 9,  name: "Awal Ramadan" },
  { day: 17, month: 9,  name: "Nuzul Quran" },
  { day: 1,  month: 10, name: "Aidilfitri" },
  { day: 2,  month: 10, name: "Aidilfitri (Hari Ke-2)" },
  { day: 10, month: 12, name: "Aidiladha" },
  { day: 11, month: 12, name: "Aidiladha (Hari Ke-2)" },
];

// Cache: keyed by Gregorian year
const _cache: Record<number, IslamicHoliday[]> = {};

async function convertHijriToGregorian(
  day: number,
  month: number,
  hijriYear: number
): Promise<{ gregorianDate: string; hijriLabel: string } | null> {
  try {
    const res = await fetch(
      `https://api.aladhan.com/v1/hToG/${day}-${month}-${hijriYear}`
    );
    if (!res.ok) return null;
    const json = await res.json();
    const d = json?.data?.gregorian;
    if (!d) return null;
    // API returns day, month.number, year as strings
    const greg = `${d.year}-${String(d.month.number).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
    const hijriMonthName = json.data.hijri?.month?.en || `Month ${month}`;
    return {
      gregorianDate: greg,
      hijriLabel: `${day} ${hijriMonthName} ${hijriYear}H`,
    };
  } catch {
    return null;
  }
}

/**
 * Returns Islamic holidays that fall within the given Gregorian year.
 * Checks Hijri years that overlap with the Gregorian year (typically 2 Hijri years).
 */
export async function getIslamicHolidays(gregorianYear: number): Promise<IslamicHoliday[]> {
  if (_cache[gregorianYear]) return _cache[gregorianYear];

  // A Gregorian year typically spans parts of 2 Hijri years.
  // For 2026: approx 1447 and 1448. Compute dynamically based on a rough conversion.
  // ~1 Gregorian year = 1.030684 Hijri years; offset ~622 years
  const approxHijriYear = Math.floor((gregorianYear - 622) * 1.030684);
  const hijriYears = [approxHijriYear, approxHijriYear + 1];

  const results: IslamicHoliday[] = [];

  for (const hijriYear of hijriYears) {
    const conversions = await Promise.all(
      HIJRI_HOLIDAYS.map(h => convertHijriToGregorian(h.day, h.month, hijriYear).then(result => ({
        name: h.name,
        result,
      })))
    );

    for (const { name, result } of conversions) {
      if (!result) continue;
      const year = parseInt(result.gregorianDate.split("-")[0], 10);
      if (year === gregorianYear) {
        results.push({
          gregorianDate: result.gregorianDate,
          name,
          hijriLabel: result.hijriLabel,
        });
      }
    }
  }

  // Sort by date
  results.sort((a, b) => a.gregorianDate.localeCompare(b.gregorianDate));

  // Deduplicate (same date + same name from overlapping Hijri year queries)
  const seen = new Set<string>();
  const deduped = results.filter(r => {
    const key = `${r.gregorianDate}-${r.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  _cache[gregorianYear] = deduped;
  return deduped;
}

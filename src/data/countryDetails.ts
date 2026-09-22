export interface CountryInfo {
  name: string;
  code: string;
  iso: string;
  flag: string;
}

export const COUNTRIES: CountryInfo[] = [
  { name: "India", code: "+91", iso: "IN", flag: "https://flagcdn.com/w40/in.png" },
  { name: "United States", code: "+1", iso: "US", flag: "https://flagcdn.com/w40/us.png" },
  { name: "United Kingdom", code: "+44", iso: "GB", flag: "https://flagcdn.com/w40/gb.png" },
  { name: "Canada", code: "+1", iso: "CA", flag: "https://flagcdn.com/w40/ca.png" },
  { name: "Australia", code: "+61", iso: "AU", flag: "https://flagcdn.com/w40/au.png" },
  { name: "Germany", code: "+49", iso: "DE", flag: "https://flagcdn.com/w40/de.png" },
  { name: "France", code: "+33", iso: "FR", flag: "https://flagcdn.com/w40/fr.png" },
  { name: "China", code: "+86", iso: "CN", flag: "https://flagcdn.com/w40/cn.png" },
  { name: "Japan", code: "+81", iso: "JP", flag: "https://flagcdn.com/w40/jp.png" },
  { name: "Brazil", code: "+55", iso: "BR", flag: "https://flagcdn.com/w40/br.png" },
  { name: "South Africa", code: "+27", iso: "ZA", flag: "https://flagcdn.com/w40/za.png" },
  { name: "Russia", code: "+7", iso: "RU", flag: "https://flagcdn.com/w40/ru.png" },
  { name: "UAE", code: "+971", iso: "AE", flag: "https://flagcdn.com/w40/ae.png" },
  { name: "Singapore", code: "+65", iso: "SG", flag: "https://flagcdn.com/w40/sg.png" },
  { name: "Nepal", code: "+977", iso: "NP", flag: "https://flagcdn.com/w40/np.png" }
];

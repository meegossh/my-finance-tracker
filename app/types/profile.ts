export type Theme = "light" | "dark" | "system";
export type CurrencyCode = "USD" | "CRC";
export type HomePage =
  | "Dashboard" | "Accounts" | "Transactions" | "Cash Flow"
  | "Reports" | "Budget" | "Recurring" | "Goals" | "Investments" | "Settings";

export interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string | null;
  country: string | null;
  theme: Theme;
  language: string;
  home_page: HomePage;
  sidebar_collapsed: boolean;
  currency_primary: CurrencyCode;
  date_format: "YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY";
  number_format: "1,234.56" | "1.234,56";
  reports_default_range: "30d" | "month" | "ytd";
  chart_prefs: Record<string, unknown>;
  notifications: Record<string, unknown>;
  updated_at: string;
}

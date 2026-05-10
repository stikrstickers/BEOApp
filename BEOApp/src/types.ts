export interface BeoItem {
  id: string;       // uuid-like: Date.now().toString()
  uri: string;      // local file URI from document picker
  name: string;     // display name
  addedAt: string;  // ISO date string
}

export interface WeekFile {
  id: number;
  name: string;
}

export interface BEOWeek {
  id: number;
  label: string;
  week_start: string;   // YYYY-MM-DD
  file_count: number;
  files: WeekFile[];
}

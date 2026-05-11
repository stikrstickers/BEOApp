// Tiny className joiner — like clsx, no dependency.
export type ClassValue = string | undefined | null | false | ClassValue[];

export function cn(...args: ClassValue[]): string {
  const out: string[] = [];
  for (const a of args) {
    if (!a) continue;
    if (Array.isArray(a)) out.push(cn(...a));
    else out.push(a);
  }
  return out.join(' ');
}

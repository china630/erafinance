/**
 * Keeps E.164 Azerbaijan mobile: +994 + exactly 9 digits (user types digits after +994).
 */
export function normalizeAzPhoneInput(raw: string): string {
  if (!raw) return "";
  let s = raw.trim();
  if (!s.startsWith("+")) {
    const digits = s.replace(/\D/g, "");
    if (digits.startsWith("994") && digits.length >= 3) {
      s = `+${digits.slice(0, 12)}`;
    } else if (digits.length > 0) {
      s = `+994${digits.replace(/^994/, "").slice(0, 9)}`;
    } else {
      s = "+994";
    }
  } else {
    const rest = s.slice(1).replace(/\D/g, "");
    if (rest.startsWith("994")) {
      s = `+${rest.slice(0, 12)}`;
    } else {
      s = `+994${rest.slice(0, 9)}`;
    }
  }
  if (s === "+") s = "+994";
  if (s.length > 13) s = s.slice(0, 13);
  return s;
}

export function isValidAzPhoneE164(s: string): boolean {
  return /^\+994\d{9}$/.test(s.trim());
}

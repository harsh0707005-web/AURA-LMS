export function getParam(param: string | string[] | undefined, defaultValue = ""): string {
  if (!param) return defaultValue;
  return Array.isArray(param) ? param[0] : param;
}

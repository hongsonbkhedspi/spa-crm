/** Template variables available in a campaign message. */
export const VARIABLES = [
  { token: "{ten}", label: "Tên khách" },
  { token: "{ten_spa}", label: "Tên spa" },
] as const;

/** Fill {ten} and {ten_spa}. Pure: used for the live preview and when saving recipients. */
export function renderMessage(template: string, vars: { name: string; spaName: string }) {
  return template.replaceAll("{ten_spa}", vars.spaName).replaceAll("{ten}", vars.name);
}

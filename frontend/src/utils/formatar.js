/** O backend devolve datas em UTC sem sufixo "Z"; sem ele o navegador as leria como horário local. */
export function formatarData(valor) {
  if (!valor) return "";
  const iso = /(Z|[+-]\d{2}:?\d{2})$/.test(valor) ? valor : `${valor}Z`;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatarTamanho(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

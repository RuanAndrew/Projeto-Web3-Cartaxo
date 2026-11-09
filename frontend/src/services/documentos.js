import { apiGet } from "../utils/api.js";

/** Receitas já liberadas do paciente (o backend só devolve as liberadas ao paciente). */
export function listarReceitas(pacienteId, opcoes) {
  return apiGet(`/documentos/paciente/${pacienteId}?tipo=receita`, opcoes);
}

/** URL assinada, válida por poucos minutos, para abrir/baixar o arquivo. */
export function obterUrlDocumento(documentoId, opcoes) {
  return apiGet(`/documentos/${documentoId}/url`, opcoes);
}

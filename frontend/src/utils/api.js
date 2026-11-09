import { API_URL } from "../config/env.js";
import { obterToken } from "./auth.js";

export class ApiError extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.name = "ApiError";
    this.status = status;
  }
}

function mensagemPorStatus(status, detalhe) {
  if (status === 401) return "Sua sessão expirou ou é inválida. Entre novamente.";
  if (status === 403) return "Você não tem permissão para acessar este recurso.";
  if (status === 404) return "Recurso não encontrado.";
  if (status === 502 || status === 504) return "O serviço está indisponível no momento. Tente novamente em instantes.";
  return typeof detalhe === "string" && detalhe ? detalhe : "Ocorreu um erro inesperado.";
}

/** GET autenticado no API Gateway. Devolve o JSON ou lança ApiError com mensagem pronta para exibir. */
export async function apiGet(caminho, { signal } = {}) {
  const token = obterToken();
  if (!token) throw new ApiError(401, mensagemPorStatus(401));

  let resposta;
  try {
    resposta = await fetch(`${API_URL}${caminho}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
  } catch (erro) {
    if (erro.name === "AbortError") throw erro;
    throw new ApiError(0, "Não foi possível conectar ao servidor.");
  }

  if (!resposta.ok) {
    let detalhe = "";
    try {
      detalhe = (await resposta.json()).detail;
    } catch {
      /* resposta sem corpo JSON */
    }
    throw new ApiError(resposta.status, mensagemPorStatus(resposta.status, detalhe));
  }

  return resposta.json();
}

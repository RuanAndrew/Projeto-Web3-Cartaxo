import { API_URL } from "../config/env.js";
import { ApiError, mensagemPorStatus } from "../utils/api.js";
import {
  obterRefreshToken,
  obterToken,
  removerSessao,
  salvarPerfil,
  salvarRefreshToken,
  salvarToken,
} from "../utils/auth.js";

async function postJson(caminho, corpo, { token } = {}) {
  let resposta;
  try {
    const cabecalhos = { "Content-Type": "application/json" };
    if (token) cabecalhos.Authorization = `Bearer ${token}`;
    resposta = await fetch(`${API_URL}${caminho}`, {
      method: "POST",
      headers: cabecalhos,
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new ApiError(0, "Não foi possível conectar ao servidor.");
  }

  if (!resposta.ok) {
    let detalhe = "";
    try {
      detalhe = (await resposta.json()).detail;
    } catch {}
    throw new ApiError(resposta.status, mensagemPorStatus(resposta.status, detalhe));
  }
  return resposta.json();
}

export async function entrar(email, senha) {
  const sessao = await postJson("/auth/login", {
    email: email.trim(),
    senha,
  });
  salvarToken(sessao.access_token);
  salvarRefreshToken(sessao.refresh_token);
  salvarPerfil(sessao.usuario?.perfil ?? null);
  return sessao;
}

export async function sair() {
  const token = obterToken();
  const refresh = obterRefreshToken();
  if (token) {
    try {
      await postJson("/auth/logout", { refresh_token: refresh }, { token });
    } catch {
      removerSessao();
    }
  }
  removerSessao();
}

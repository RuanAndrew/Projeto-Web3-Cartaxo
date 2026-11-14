import { DEV_TOKEN } from "../config/env.js";

const CHAVE_TOKEN = "clinica.token";
const CHAVE_REFRESH = "clinica.refresh";
const CHAVE_PERFIL = "clinica.perfil";

/** Token da sessão (login real, quando existir) ou o token de teste de desenvolvimento. */
export function obterToken() {
  return sessionStorage.getItem(CHAVE_TOKEN) || DEV_TOKEN || null;
}

export function salvarToken(token) {
  sessionStorage.setItem(CHAVE_TOKEN, token);
}

export function removerToken() {
  sessionStorage.removeItem(CHAVE_TOKEN);
}

export function obterRefreshToken() {
  return sessionStorage.getItem(CHAVE_REFRESH) || null;
}

export function salvarRefreshToken(token) {
  sessionStorage.setItem(CHAVE_REFRESH, token);
}

export function obterPerfil() {
  return sessionStorage.getItem(CHAVE_PERFIL) || null;
}

export function salvarPerfil(perfil) {
  sessionStorage.setItem(CHAVE_PERFIL, perfil);
}

export function removerSessao() {
  sessionStorage.removeItem(CHAVE_TOKEN);
  sessionStorage.removeItem(CHAVE_REFRESH);
  sessionStorage.removeItem(CHAVE_PERFIL);
}

export function rotaPorPerfil(perfil) {
  switch (perfil) {
    case "ADMIN":
      return "/admin/profissionais";
    case "PROFISSIONAL":
    case "ATENDENTE":
      return "/agenda";
    case "PACIENTE":
      return "/portal";
    default:
      return "/";
  }
}

/** Lê as claims do JWT SOMENTE para exibir/montar URLs. A validação real é do servidor. */
export function lerPayload(token) {
  try {
    const parte = token.split(".")[1];
    const base64 = parte.replace(/-/g, "+").replace(/_/g, "/");
    const completo = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const json = decodeURIComponent(
      atob(completo)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Id do paciente logado (claim "sub" do token) ou null. */
export function obterPacienteId() {
  const token = obterToken();
  if (!token) return null;
  const id = Number(lerPayload(token)?.sub);
  return Number.isInteger(id) && id > 0 ? id : null;
}

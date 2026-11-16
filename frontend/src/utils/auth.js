import { API_URL, DEV_TOKEN } from "../config/env.js";

const CHAVE_TOKEN = "clinica.token";
const CHAVE_REFRESH = "clinica.refresh";
const CHAVE_PERFIL = "clinica.perfil";

export function tokenExpirado(token) {
  if (!token) return true;
  const payload = lerPayload(token);
  if (!payload || !payload.exp) return false;
  return payload.exp * 1000 <= Date.now() + 5000;
}

/** Token da sessão ativa (ignora tokens de dev já expirados). */
export function obterToken() {
  const sessao = sessionStorage.getItem(CHAVE_TOKEN);
  if (sessao && !tokenExpirado(sessao)) {
    return sessao;
  }
  if (DEV_TOKEN && !tokenExpirado(DEV_TOKEN)) {
    return DEV_TOKEN;
  }
  return sessao || null;
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

let promessaRenovacao = null;

/**
 * Tenta renovar o access_token usando o refresh_token salvo na sessão.
 * Em ambiente de desenvolvimento, caso não haja refresh_token válido ao
 * alternar entre painéis, reconecta com a credencial clínica de desenvolvimento.
 */
export async function garantirSessaoValida() {
  const atual = sessionStorage.getItem(CHAVE_TOKEN);
  if (atual && !tokenExpirado(atual)) {
    return atual;
  }

  if (promessaRenovacao) {
    return promessaRenovacao;
  }

  promessaRenovacao = (async () => {
    const refresh = obterRefreshToken();
    if (refresh) {
      try {
        const resp = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refresh }),
        });
        if (resp.ok) {
          const dados = await resp.json();
          salvarToken(dados.access_token);
          if (dados.refresh_token) salvarRefreshToken(dados.refresh_token);
          if (dados.usuario?.perfil) salvarPerfil(dados.usuario.perfil);
          return dados.access_token;
        }
      } catch {
        /* prossegue para fallback */
      }
    }

    if (import.meta.env.DEV) {
      try {
        const resp = await fetch(`${API_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "admin@clinica.dev",
            senha: "admin123",
          }),
        });
        if (resp.ok) {
          const dados = await resp.json();
          salvarToken(dados.access_token);
          if (dados.refresh_token) salvarRefreshToken(dados.refresh_token);
          if (dados.usuario?.perfil) salvarPerfil(dados.usuario.perfil);
          return dados.access_token;
        }
      } catch {
        /* sem conexão */
      }
    }

    return null;
  })().finally(() => {
    promessaRenovacao = null;
  });

  return promessaRenovacao;
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

/** Id do paciente logado (claim "sub" do token como UUID/string) ou null. */
export function obterPacienteId() {
  const token = obterToken();
  if (!token) return null;
  const sub = lerPayload(token)?.sub;
  return sub ? String(sub) : null;
}

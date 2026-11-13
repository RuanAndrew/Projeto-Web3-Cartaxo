import { useState } from "react";
import { useNavigate } from "react-router-dom";

import Btn from "../components/Btn.jsx";
import { ApiError } from "../utils/api.js";
import { rotaPorPerfil } from "../utils/auth.js";
import { entrar, sair } from "../services/autenticacao.js";

// A aba escolhida (Médico | Paciente | Admin) é só uma orientação visual.
// Quem decide o perfil, a área e as permissões é o servidor (claim "perfil" do token).
const ROLE_OPTIONS = [
  {
    id: "doctor",
    label: "Médico",
    title: "Área Médica",
    description: "Agenda clínica, atendimentos e prontuários eletrônicos.",
    placeholder: "medico@clinica.com.br",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
        <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
        <circle cx="20" cy="10" r="2" />
      </svg>
    ),
  },
  {
    id: "patient",
    label: "Paciente",
    title: "Portal do Paciente",
    description: "Acompanhamento do tratamento, exercícios diários e receitas.",
    placeholder: "paciente@exemplo.com",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    ),
  },
  {
    id: "admin",
    label: "Admin",
    title: "Painel Administrativo",
    description: "Gestão de profissionais, especialidades e configuração de agendas.",
    placeholder: "admin@clinica.com.br",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
];

// Perfil devolvido pelo auth-service -> aba correspondente.
const ROLE_POR_PERFIL = {
  ADMIN: "admin",
  PROFISSIONAL: "doctor",
  ATENDENTE: "doctor",
  PACIENTE: "patient",
};

export default function Login() {
  const [role, setRole] = useState("doctor");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [carregando, setCarregando] = useState(false);

  const navigate = useNavigate();

  const activeRole =
    ROLE_OPTIONS.find((option) => option.id === role) || ROLE_OPTIONS[0];

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Preencha o e-mail e a senha para continuar.");
      return;
    }

    setCarregando(true);
    try {
      const sessao = await entrar(email, password);
      const perfil = sessao.usuario?.perfil;

      // A aba escolhida precisa corresponder ao perfil real da conta.
      if (ROLE_POR_PERFIL[perfil] !== role) {
        await sair();
        setError(
          `Esta conta é do perfil "${perfil ? perfil.toLowerCase() : "desconhecido"}". ` +
            "Selecione a aba correspondente e tente novamente."
        );
        return;
      }

      navigate(rotaPorPerfil(perfil));
    } catch (erro) {
      setError(
        erro instanceof ApiError
          ? erro.message
          : "Falha inesperada no login. Tente novamente."
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-visual">
        <div className="login-brand">
          <span className="brand-symbol brand-symbol-light">C</span>

          <div>
            <strong>Clínica</strong>
            <small>Plataforma de gestão em saúde</small>
          </div>
        </div>

        <div className="login-visual-content">
          <span className="login-kicker">CUIDADO CONECTADO</span>

          <h1>
            Tecnologia a serviço de um cuidado mais humano.
          </h1>

          <p>
            Uma experiência integrada para profissionais de saúde e
            pacientes, do agendamento ao acompanhamento terapêutico.
          </p>

          <div className="login-feature-list">
            <div>
              <span className="feature-check">✓</span>
              <span>Organização da rotina clínica</span>
            </div>

            <div>
              <span className="feature-check">✓</span>
              <span>Acompanhamento do tratamento</span>
            </div>

            <div>
              <span className="feature-check">✓</span>
              <span>Histórico clínico centralizado</span>
            </div>
          </div>
        </div>

        <p className="login-visual-footer">
          Plataforma demonstrativa de gestão clínica.
        </p>
      </section>

      <section className="login-panel">
        <div className="login-form-wrapper">
          <div className="login-mobile-brand">
            <span className="brand-symbol">C</span>
            <strong>Clínica</strong>
          </div>

          <span className="eyebrow">SEJA BEM-VINDO</span>

          <h2 className="login-heading">Acesse sua conta</h2>

          <p className="login-subtitle">
            Escolha seu perfil de acesso e informe suas credenciais para
            entrar na plataforma.
          </p>

          <form className="login-form" onSubmit={handleSubmit}>
            <fieldset className="role-fieldset">
              <legend>Perfil de acesso</legend>

              {/* Seletor Segmentado Elegante (Médico | Paciente | Admin) */}
              <div
                className="role-segmented"
                role="tablist"
                aria-label="Selecione o perfil de acesso"
              >
                {ROLE_OPTIONS.map((option) => {
                  const isActive = role === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={`role-segment ${
                        isActive ? "role-segment-active" : ""
                      }`}
                      onClick={() => setRole(option.id)}
                    >
                      <span className="role-segment-icon">{option.icon}</span>
                      <span className="role-segment-label">{option.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Resumo Contextual do Perfil Selecionado */}
              <div className="role-context-card" aria-live="polite">
                <span className="role-context-icon">{activeRole.icon}</span>
                <div className="role-context-copy">
                  <strong>{activeRole.title}</strong>
                  <small>{activeRole.description}</small>
                </div>
                <span className="role-context-badge">{activeRole.label}</span>
              </div>
            </fieldset>

            <label className="form-label" htmlFor="email">
              E-mail
            </label>

            <input
              id="email"
              className="form-input"
              type="email"
              autoComplete="username"
              placeholder={activeRole.placeholder}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            <label className="form-label" htmlFor="password">
              Senha
            </label>

            <input
              id="password"
              className="form-input"
              type="password"
              autoComplete="current-password"
              placeholder="Digite sua senha"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}

            <Btn type="submit" className="login-submit" disabled={carregando}>
              <span>
                {carregando ? "Entrando…" : `Entrar como ${activeRole.label}`}
              </span>
              <span aria-hidden="true">→</span>
            </Btn>
          </form>

          {/* Credenciais de desenvolvimento: só aparecem no `npm run dev`. */}
          {import.meta.env.DEV && (
            <div className="demo-notice">
              <span aria-hidden="true">ⓘ</span>
              <p>
                <strong>Contas de demonstração</strong> criadas pelo
                auth-service — administrador:{" "}
                <code>admin@clinica.dev</code> / <code>admin123</code>. Outros
                usuários precisam ser cadastrados por um administrador.
              </p>
            </div>
          )}

          <p className="login-legal">
            Ambiente acadêmico · Dados fictícios
          </p>
        </div>
      </section>
    </main>
  );
}

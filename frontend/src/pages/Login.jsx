import { useState } from "react";
import { useNavigate } from "react-router-dom";

import Btn from "../components/Btn.jsx";

export default function Login() {
  const [role, setRole] = useState("doctor");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();

  function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Preencha o e-mail e a senha para continuar.");
      return;
    }

    // Demonstração: não valida credenciais nem cria uma sessão.
    navigate(role === "patient" ? "/portal" : "/agenda");
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
            Escolha seu perfil e informe seus dados para visualizar
            a demonstração.
          </p>

          <form className="login-form" onSubmit={handleSubmit}>
            <fieldset className="role-fieldset">
              <legend>Como deseja acessar?</legend>

              <div className="role-selector">
                <button
                  type="button"
                  className={`role-option ${
                    role === "doctor" ? "role-option-active" : ""
                  }`}
                  onClick={() => setRole("doctor")}
                  aria-pressed={role === "doctor"}
                >
                  <span className="role-icon">✚</span>
                  <span>
                    <strong>Profissional</strong>
                    <small>Agenda e prontuários</small>
                  </span>
                </button>

                <button
                  type="button"
                  className={`role-option ${
                    role === "patient" ? "role-option-active" : ""
                  }`}
                  onClick={() => setRole("patient")}
                  aria-pressed={role === "patient"}
                >
                  <span className="role-icon">♡</span>
                  <span>
                    <strong>Paciente</strong>
                    <small>Tratamento e exercícios</small>
                  </span>
                </button>
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
              placeholder="voce@exemplo.com"
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

            <Btn type="submit" className="login-submit">
              Entrar na plataforma <span aria-hidden="true">→</span>
            </Btn>
          </form>

          <div className="demo-notice">
            <span aria-hidden="true">ⓘ</span>
            <p>
              <strong>Modo de demonstração.</strong> Qualquer e-mail e
              senha preenchidos permitem acessar as telas fictícias.
              Nenhuma autenticação real é realizada.
            </p>
          </div>

          <p className="login-legal">
            Ambiente de prototipação · Dados fictícios
          </p>
        </div>
      </section>
    </main>
  );
}
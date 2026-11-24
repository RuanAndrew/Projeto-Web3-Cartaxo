import { Link, NavLink, Outlet } from "react-router-dom";
import { sair } from "../../services/autenticacao.js";

export default function PatientLayout() {
  return (
    <div className="patient-shell">
      <header className="patient-header">
        <div className="patient-header-inner">
          <Link to="/portal" className="patient-brand">
            <span className="brand-symbol">C</span>

            <span>
              <strong>Clínica</strong>
              <small>Portal do paciente</small>
            </span>
          </Link>

          <nav className="patient-navigation" aria-label="Menu do paciente">
            <NavLink
              to="/portal"
              end
              className={({ isActive }) =>
                `patient-nav-link ${isActive ? "patient-nav-link-active" : ""}`
              }
            >
              Meu tratamento
            </NavLink>

            <NavLink
              to="/portal/receitas"
              className={({ isActive }) =>
                `patient-nav-link ${isActive ? "patient-nav-link-active" : ""}`
              }
            >
              Minhas receitas
            </NavLink>

            <NavLink
              to="/portal/exercicios"
              className={({ isActive }) =>
                `patient-nav-link ${isActive ? "patient-nav-link-active" : ""}`
              }
            >
              Meus exercícios
            </NavLink>

            <NavLink
              to="/perfil"
              className={({ isActive }) =>
                `patient-nav-link ${isActive ? "patient-nav-link-active" : ""}`
              }
            >
              Meu perfil
            </NavLink>

            <Link to="/" className="patient-logout" onClick={() => { sair(); }}>
              Sair <span aria-hidden="true">↗</span>
            </Link>
          </nav>

          <div className="patient-header-avatar" aria-label="Paciente João Silva">
            JS
          </div>
        </div>
      </header>

      <main className="patient-content">
        <Outlet />
      </main>

      <footer className="patient-footer">
        <span>Clínica · Portal do paciente</span>
        <span>Interface demonstrativa com dados fictícios</span>
      </footer>
    </div>
  );
}
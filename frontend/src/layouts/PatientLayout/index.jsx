import { Link, NavLink, Outlet } from "react-router-dom";

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
              className={({ isActive }) =>
                `patient-nav-link ${
                  isActive ? "patient-nav-link-active" : ""
                }`
              }
            >
              Meu tratamento
            </NavLink>

            <Link to="/" className="patient-logout">
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
import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useToast } from "../../components/ToastProvider.jsx";

const navigation = [
  {
    label: "Agenda",
    description: "Consultas e horários",
    path: "/agenda",
    icon: "◷",
    end: true,
  },
  {
    label: "Prontuários",
    description: "Buscar e consultar pacientes",
    path: "/prontuarios",
    icon: "▤",
    end: true,
  },
];

export default function DoctorLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { showToast } = useToast();
  const location = useLocation();

  const pageTitle = location.pathname.startsWith("/prontuario/")
  ? "Prontuário eletrônico"
  : location.pathname === "/prontuarios"
    ? "Prontuários"
    : "Agenda clínica";

  const formattedDate = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());

  return (
    <div className="doctor-shell">
      {menuOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Fechar menu"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside
        className={`doctor-sidebar ${menuOpen ? "sidebar-open" : ""}`}
      >
        <Link
          to="/agenda"
          className="brand"
          onClick={() => setMenuOpen(false)}
        >
          <span className="brand-symbol">C</span>

          <span className="brand-copy">
            <strong>Clínica</strong>
            <small>Gestão de saúde</small>
          </span>
        </Link>

        <div className="sidebar-section-label">ÁREA CLÍNICA</div>

        <nav className="doctor-navigation" aria-label="Navegação clínica">
          {navigation.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `nav-link ${isActive ? "nav-link-active" : ""}`
              }
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>

              <span className="nav-copy">
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-section-label sidebar-section-spaced">
          OUTROS MÓDULOS
        </div>

        <div className="sidebar-coming-soon">
          <span className="nav-icon" aria-hidden="true">
            ♧
          </span>

          <span>
            <strong>Pacientes</strong>
            <small>Em desenvolvimento</small>
          </span>
        </div>

        <div className="sidebar-coming-soon">
          <span className="nav-icon" aria-hidden="true">
            ▥
          </span>

          <span>
            <strong>Relatórios</strong>
            <small>Em desenvolvimento</small>
          </span>
        </div>

        <div className="sidebar-spacer" />

        <div className="sidebar-profile">
          <div className="profile-avatar">MS</div>

          <div className="profile-copy">
            <strong>Mariana Santos</strong>
            <small>Profissional de saúde</small>
          </div>
        </div>

        <Link className="sidebar-logout" to="/">
          <span aria-hidden="true">↪</span>
          Sair da demonstração
        </Link>
      </aside>

      <div className="doctor-main">
        <header className="doctor-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-menu-button"
              aria-label="Abrir menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              ☰
            </button>

            <div>
              <p className="topbar-context">Espaço de trabalho</p>
              <h1 className="topbar-title">{pageTitle}</h1>
            </div>
          </div>

          <div className="topbar-right">
            <span className="topbar-date">{formattedDate}</span>

            <button
              type="button"
              className="notification-button"
              aria-label="Notificações demonstrativas"
              onClick={() =>
                showToast("As notificações serão integradas posteriormente.")
              }
            >
              ♧
            </button>

            <div className="topbar-avatar">MS</div>
          </div>
        </header>

        <main className="doctor-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
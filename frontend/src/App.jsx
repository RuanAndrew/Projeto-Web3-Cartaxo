import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { Pacientes, PatientProfile } from "./pages/Pacientes.jsx";
import { ToastProvider } from "./components/ToastProvider.jsx";

import Login from "./pages/Login.jsx";
import Agenda from "./pages/Agenda.jsx";
import HistoricoAgenda from "./pages/HistoricoAgenda.jsx";
import Prontuario from "./pages/Prontuario.jsx";
import Prontuarios from "./pages/Prontuarios.jsx";
import Portal from "./pages/Portal.jsx";
import Receitas from "./pages/Receitas.jsx";
import EspecialidadesAdmin from "./pages/admin/EspecialidadesAdmin.jsx";
import ProfissionaisAdmin from "./pages/admin/ProfissionaisAdmin.jsx";
import AgendaConfigAdmin from "./pages/admin/AgendaConfigAdmin.jsx";
import AgendaCalendarioAdmin from "./pages/admin/AgendaCalendarioAdmin.jsx";

import AdminLayout from "./layouts/AdminLayout/index.jsx";
import DoctorLayout from "./layouts/DoctorLayout/index.jsx";
import PatientLayout from "./layouts/PatientLayout/index.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Login />} />

          <Route path="/admin" element={<AdminLayout />}>
            <Route
              index
              element={<Navigate to="/admin/profissionais" replace />}
            />
            <Route
              path="profissionais"
              element={<ProfissionaisAdmin />}
            />
            <Route
              path="especialidades"
              element={<EspecialidadesAdmin />}
            />
            <Route path="pacientes" element={<Pacientes />} />
            <Route path="agenda" element={<AgendaConfigAdmin />} />
            <Route
              path="agenda/calendario"
              element={<AgendaCalendarioAdmin />}
            />
          </Route>

          <Route element={<DoctorLayout />}>
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/historico" element={<HistoricoAgenda />} />
            <Route path="/agenda/historico" element={<HistoricoAgenda />} />
            <Route
              path="/prontuarios"
              element={<Prontuarios />}
            />
            <Route
              path="/prontuario/:id"
              element={<Prontuario />}
            />
          </Route>

          <Route
            path="/pacientes"
            element={<Navigate to="/admin/pacientes" replace />}
          />

          <Route element={<PatientLayout />}>
            <Route path="/portal" element={<Portal />} />
            <Route path="/portal/receitas" element={<Receitas />} />
            <Route path="/perfil" element={<PatientProfile />} />
          </Route>

          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
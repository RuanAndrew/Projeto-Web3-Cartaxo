import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { ToastProvider } from "./components/ToastProvider.jsx";

import Login from "./pages/Login.jsx";
import Agenda from "./pages/Agenda.jsx";
import Prontuario from "./pages/Prontuario.jsx";
import Prontuarios from "./pages/Prontuarios.jsx";
import Portal from "./pages/Portal.jsx";

import DoctorLayout from "./layouts/DoctorLayout/index.jsx";
import PatientLayout from "./layouts/PatientLayout/index.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Login />} />

          <Route element={<DoctorLayout />}>
            <Route path="/agenda" element={<Agenda />} />
            <Route
              path="/prontuarios"
              element={<Prontuarios />}
            />
            <Route
              path="/prontuario/:id"
              element={<Prontuario />}
            />
          </Route>

          <Route element={<PatientLayout />}>
            <Route path="/portal" element={<Portal />} />
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
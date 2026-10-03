import { useState } from 'react';
import { Btn } from '../components/Btn';

export default function Login({ onEnter }) {
  const [role, setRole] = useState('Profissional');
  return (
    <div className="min-h-[80vh] grid md:grid-cols-2 rounded-2xl overflow-hidden border border-petro-100 bg-white">
      <div className="bg-petro-800 text-white p-10 flex flex-col justify-between">
        <div className="text-lg font-semibold">Clínica Escuta</div>
        <div>
          <h1 className="text-4xl leading-tight">Ouvir bem começa com um bom cuidado.</h1>
          <p className="mt-4 text-petro-200 max-w-sm">Otorrinolaringologia e fonoaudiologia em um só lugar: prontuário, agenda e acompanhamento do paciente.</p>
        </div>
        <div className="text-sm text-petro-200">Seus dados são protegidos conforme a LGPD.</div>
      </div>
      <div className="p-10 flex items-center">
        <div className="w-full max-w-sm mx-auto">
          <h2 className="text-2xl">Entrar</h2>
          <div className="mt-5 flex rounded-lg bg-petro-50 p-1" role="tablist">
            {['Admin','Profissional','Paciente'].map(r =>
              <button key={r} onClick={() => setRole(r)} className={'flex-1 py-2 text-sm rounded-md font-semibold ' + (role === r ? 'bg-white text-petro-800 shadow-sm' : 'text-petro-600')}>{r}</button>
            )}
          </div>
          <label className="block mt-5 text-sm font-semibold">E-mail ou CPF
            <input className="mt-1 w-full border border-petro-200 rounded-lg px-3 py-2 font-normal" defaultValue="carlos.lima@escuta.com.br"/>
          </label>
          <label className="block mt-4 text-sm font-semibold">Senha
            <input type="password" className="mt-1 w-full border border-petro-200 rounded-lg px-3 py-2 font-normal" defaultValue="12345678"/>
          </label>
          <div className="mt-2 text-right">
            <a href="#" onClick={e => e.preventDefault()} className="text-sm text-petro-600 underline">Esqueci minha senha</a>
          </div>
          <Btn className="w-full mt-4" onClick={() => onEnter(role)}>Entrar como {role.toLowerCase()}</Btn>
        </div>
      </div>
    </div>
  );
}
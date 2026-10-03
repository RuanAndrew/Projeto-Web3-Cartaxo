import { useState } from 'react';
import { Card } from '../components/Card';
import { Btn } from '../components/Btn';

const PROS = ['Todos', 'Dr. Carlos Lima', 'Dra. Paula Reis'];
const INIT = [
 {t: '08:00', p: 'Ana Souza', pro: 'Dr. Carlos Lima', k: 'Consulta ORL', s: 'Finalizado'},
 {t: '08:40', p: 'Bruno Alves', pro: 'Dr. Carlos Lima', k: 'Audiometria', s: 'Em atendimento'},
 {t: '09:00', p: 'Marina Costa', pro: 'Dra. Paula Reis', k: 'Terapia vocal', s: 'Aguardando'},
 {t: '09:30', p: 'Lucas Pereira', pro: 'Dr. Carlos Lima', k: 'Retorno', s: 'Agendado'},
 {t: '10:00', p: 'Helena Duarte', pro: 'Dra. Paula Reis', k: 'Avaliação fonoaudiológica', s: 'Agendado'},
 {t: '11:00', p: 'Rafael Moura', pro: 'Dr. Carlos Lima', k: 'Timpanometria', s: 'Agendado'}
];
const SC = { Finalizado: 'bg-slate-100 text-slate-600', 'Em atendimento': 'bg-petro-700 text-white', Aguardando: 'bg-amber-100 text-amber-800', Agendado: 'bg-petro-100 text-petro-800', Cancelado: 'bg-red-100 text-red-700' };

export default function Agenda() {
  const [pro, setPro] = useState('Todos');
  const [list, setList] = useState(INIT);
  const rows = list.map((a, i) => ({ ...a, i })).filter(a => pro === 'Todos' || a.pro === pro);
  const cancel = i => setList(l => l.map((a, j) => j === i ? { ...a, s: 'Cancelado' } : a));
  
  return (
    <div className="grid lg:grid-cols-[220px_1fr] gap-6">
      <aside className="space-y-4">
        <Card className="p-4">
          <div className="text-sm font-semibold mb-2">Profissional</div>
          {PROS.map(p => <button key={p} onClick={() => setPro(p)} className={'block w-full text-left px-3 py-2 rounded-lg text-sm ' + (pro === p ? 'bg-petro-700 text-white' : 'hover:bg-petro-50')}>{p}</button>)}
        </Card>
        <Card className="p-4 text-sm">
          <div className="font-semibold mb-2">Resumo do dia</div>
          <div className="flex justify-between py-1"><span>Consultas</span><b>{list.length}</b></div>
          <div className="flex justify-between py-1"><span>Na sala de espera</span><b>{list.filter(a => a.s === 'Aguardando').length}</b></div>
          <div className="flex justify-between py-1"><span>Canceladas</span><b>{list.filter(a => a.s === 'Cancelado').length}</b></div>
        </Card>
      </aside>
      <section>
        <div className="flex items-center justify-between mb-4">
          <div><h2 className="text-2xl">Agenda de hoje</h2><p className="text-sm text-petro-600">Segunda-feira, 28 de setembro</p></div>
          <Btn>Novo agendamento</Btn>
        </div>
        <Card className="divide-y divide-petro-100">
          {rows.map(a =>
            <div key={a.i} className="flex items-center gap-4 p-4">
              <div className="w-14 font-semibold text-petro-700">{a.t}</div>
              <div className="flex-1"><div className="font-semibold">{a.p}</div><div className="text-sm text-petro-600">{a.k} · {a.pro}</div></div>
              <span className={'text-xs font-semibold px-2.5 py-1 rounded-full ' + SC[a.s]}>{a.s}</span>
              <Btn kind="ghost" className="!py-1">Remarcar</Btn>
              <Btn kind="danger" className="!py-1" disabled={a.s === 'Cancelado' || a.s === 'Finalizado'} onClick={() => cancel(a.i)}>Cancelar</Btn>
            </div>
          )}
          {!rows.length && <div className="p-6 text-petro-600">Nenhuma consulta para este profissional hoje.</div>}
        </Card>
      </section>
    </div>
  );
}
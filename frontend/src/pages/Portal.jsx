import { useState } from 'react';
import { Card } from '../components/Card';
import { Btn } from '../components/Btn';

const EX = [
  ['Vibração de lábios', '5 min · 3 séries'],
  ['Sirene com "u"', '3 min · 5 repetições'],
  ['Escala em "mi-mi-mi"', '4 min · 3 séries'],
  ['Respiração diafragmática', '5 min']
];

export default function Portal() {
  const [done, setDone] = useState([true, false, false, false]);
  const n = done.filter(Boolean).length;
  const streak = 4 + (n > 0 ? 1 : 0);
  const xp = 240 + n * 20;
  const days = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
  const week = [true, true, true, true, n > 0, false, false];
  
  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6">
      <section>
        <h2 className="text-2xl">Olá, Marina</h2>
        <p className="text-petro-600 mb-4">Seus exercícios de hoje, prescritos pela Dra. Paula Reis.</p>
        <Card className="divide-y divide-petro-100">
          {EX.map(([t, d], i) =>
            <label key={t} className="flex items-center gap-4 p-4 cursor-pointer">
              <input type="checkbox" className="w-5 h-5 accent-[#155764]" checked={done[i]} onChange={() => setDone(x => x.map((v, j) => j === i ? !v : v))} />
              <div className="flex-1">
                <div className={'font-semibold ' + (done[i] ? 'line-through text-petro-500' : '')}>{t}</div>
                <div className="text-sm text-petro-600">{d}</div>
              </div>
              <Btn kind="ghost" className="!py-1" onClick={e => e.preventDefault()}>Ver vídeo</Btn>
            </label>
          )}
        </Card>
        <p className="mt-3 text-sm text-petro-600">{n} de {EX.length} exercícios concluídos hoje.</p>
      </section>
      <aside className="space-y-4">
        <Card className="p-5 text-center">
          <div className="text-5xl">🔥</div>
          <div className="text-4xl font-semibold mt-1">{streak} dias</div>
          <div className="text-sm text-petro-600">de ofensiva seguida</div>
          <div className="flex justify-between mt-4">
            {days.map((d, i) => 
              <div key={i} className="text-xs">
                <div className={'w-8 h-8 rounded-full grid place-items-center mb-1 ' + (week[i] ? 'bg-petro-700 text-white' : 'bg-petro-50 text-petro-500')}>{week[i] ? '✓' : ''}</div>
                {d}
              </div>
            )}
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex justify-between text-sm font-semibold"><span>Nível 3</span><span>{xp}/400 pts</span></div>
          <div className="h-2.5 rounded-full bg-petro-100 mt-2">
            <div className="h-full rounded-full bg-petro-600" style={{ width: xp / 4 + '%' }}></div>
          </div>
          <div className="mt-4 text-sm font-semibold">Conquistas</div>
          <div className="flex gap-2 mt-2 text-sm flex-wrap">
            <span className="px-3 py-1 rounded-full bg-petro-100 text-petro-800">Primeira semana</span>
            <span className="px-3 py-1 rounded-full bg-petro-100 text-petro-800">3 dias seguidos</span>
            <span className="px-3 py-1 rounded-full bg-petro-50 text-petro-500 border border-dashed border-petro-200">7 dias seguidos</span>
          </div>
        </Card>
      </aside>
    </div>
  );
}
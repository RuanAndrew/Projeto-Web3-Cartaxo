import { useState, useEffect } from 'react';
import { Card } from '../components/Card';
import { Btn } from '../components/Btn';

const AI_TEXT = 'Paciente relata zumbido no ouvido esquerdo há cerca de três semanas, com piora à noite. Nega tontura e otorreia. Refere sensação de ouvido tapado após resfriado recente. Sem uso de medicamentos ototóxicos.';

export default function Prontuario() {
  const [rec, setRec] = useState('idle');
  const [sec, setSec] = useState(0);
  const [ai, setAi] = useState('');
  const [note, setNote] = useState('Queixa principal: ');
  const [saved, setSaved] = useState(false);
  
  useEffect(() => {
    if (rec !== 'rec') return;
    const id = setInterval(() => setSec(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [rec]);
  
  const stop = () => {
    setRec('proc');
    setTimeout(() => {
      setAi(AI_TEXT);
      setRec('idle');
      setSec(0);
    }, 1500);
  };
  
  const mm = String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
  
  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-6">
      <section className="space-y-4">
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-petro-100 text-petro-800 grid place-items-center font-semibold">BA</div>
          <div className="flex-1"><h2 className="text-xl">Bruno Alves</h2><p className="text-sm text-petro-600">42 anos · CPF 123.456.789-00 · Particular</p></div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-petro-700 text-white">Em atendimento</span>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg">Anamnese</h3>
            {rec === 'idle' && <Btn kind="ghost" onClick={() => { setRec('rec'); setSaved(false); }}>● Gravar consulta</Btn>}
            {rec === 'rec' && <Btn className="!bg-red-600 hover:!bg-red-700" onClick={stop}>■ Parar e transcrever ({mm})</Btn>}
            {rec === 'proc' && <span className="text-sm text-petro-600">Transcrevendo com Whisper…</span>}
          </div>
          <p className="text-xs text-petro-600 mb-3">A gravação só começa com o consentimento do paciente registrado na ficha.</p>
          {ai &&
            <div className="mb-3 rounded-lg border-2 border-dashed border-petro-500 bg-petro-50 p-4">
              <div className="text-xs font-semibold text-petro-700 mb-1">Sugerido pela IA — revise antes de salvar</div>
              <p className="text-sm">{ai}</p>
              <div className="mt-3 flex gap-2">
                <Btn onClick={() => { setNote(n => n + '\n\n' + ai); setAi(''); }}>Aprovar e inserir</Btn>
                <Btn kind="ghost" onClick={() => setAi('')}>Descartar</Btn>
              </div>
            </div>}
          <textarea value={note} onChange={e => { setNote(e.target.value); setSaved(false); }} rows={8} className="w-full border border-petro-200 rounded-lg p-3 text-sm"/>
          <div className="mt-3 flex items-center gap-3">
            <Btn onClick={() => setSaved(true)}>Salvar anamnese</Btn>
            {saved && <span className="text-sm text-petro-600">Anamnese salva.</span>}
          </div>
        </Card>
      </section>
      <aside>
        <Card className="p-5">
          <h3 className="text-lg mb-4">Histórico</h3>
          <ol className="border-l-2 border-petro-100 ml-2 space-y-5">
            {[['12/08/2026', 'Audiometria — perda leve em 4 kHz (OD)'], ['03/03/2026', 'Consulta ORL — otite externa tratada'], ['15/11/2025', 'Primeira consulta — queixa de zumbido']].map(([d, t]) =>
              <li key={d} className="pl-4 relative">
                <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-petro-600"></span>
                <div className="text-xs text-petro-600">{d}</div>
                <div className="text-sm">{t}</div>
              </li>
            )}
          </ol>
        </Card>
      </aside>
    </div>
  );
}
export const Btn = ({ kind = 'primary', className = '', ...p }) => (
  <button 
    {...p} 
    className={'px-4 py-2 rounded-lg text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-petro-500 ' + (kind === 'primary' ? 'bg-petro-700 text-white hover:bg-petro-800 ' : kind === 'ghost' ? 'border border-petro-200 text-petro-700 hover:bg-petro-50 ' : 'text-red-700 hover:bg-red-50 ') + className}
  />
);
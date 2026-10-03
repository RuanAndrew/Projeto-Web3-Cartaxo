export const Card = ({ className = '', children }) => (
  <div className={'bg-white rounded-xl border border-petro-100 ' + className}>
    {children}
  </div>
);
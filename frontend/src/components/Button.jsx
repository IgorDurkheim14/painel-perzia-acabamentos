export default function Button({ children, loading = false, disabled = false, ...props }) {
  return (
    <button className="button button-primary" disabled={loading || disabled} {...props}>
      {loading ? 'Salvando…' : children}
    </button>
  );
}

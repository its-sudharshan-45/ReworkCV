/** Visual separator between email/password and OAuth sections. */
export function OAuthDivider() {
  return (
    <div className="relative my-1 flex items-center" role="separator" aria-label="or continue with email">
      <div className="flex-1 border-t border-slate-200" />
      <span className="mx-3 text-[12px] text-slate-400">or continue with email</span>
      <div className="flex-1 border-t border-slate-200" />
    </div>
  );
}

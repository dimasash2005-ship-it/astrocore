export function ChatInput() {
    return (
      <div className="astro-elevated rounded-2xl border border-[var(--astro-border-dim)] p-4 mt-6">
        
        <div className="flex items-end gap-4">
          
          <textarea
            placeholder="Продовжуйте — AstroCore знає весь контекст..."
            className="min-h-[90px] flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-[var(--astro-text-muted)]"
          />
  
          <button className="rounded-xl bg-[var(--astro-red)] px-5 py-3 text-sm text-white transition hover:opacity-90">
            Надіслати
          </button>
        </div>
  
        <div className="mt-4 flex items-center justify-between">
          
          <p className="text-xs text-[var(--astro-text-muted)]">
            контекст novatech активний · 4 сесії в памʼяті
          </p>
  
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[var(--astro-red)] astro-pulse" />
  
            <span className="text-xs text-[var(--astro-red)]">
              AI online
            </span>
          </div>
        </div>
      </div>
    );
  }
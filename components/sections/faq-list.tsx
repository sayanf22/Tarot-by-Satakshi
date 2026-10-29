import { Plus } from "lucide-react";
import { faq } from "@/content/faq";

// Open, line-separated list (no boxes).
export function FaqList() {
  return (
    <div className="divide-y divide-line border-y border-line">
      {faq.map((item) => (
        <details key={item.q} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 font-display text-[1.3rem] text-ink transition-colors hover:text-gold-800 [&::-webkit-details-marker]:hidden">
            {item.q}
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line transition-colors duration-300 group-open:border-gold-700 group-open:bg-gold-700 group-open:text-white">
              <Plus
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-4 transition-transform duration-300 group-open:rotate-45"
              />
            </span>
          </summary>
          <p className="-mt-1 max-w-2xl pr-14 pb-7 text-[1.02rem] text-ink-muted">{item.a}</p>
        </details>
      ))}
    </div>
  );
}

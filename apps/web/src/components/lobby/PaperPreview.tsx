import { ArrowLeftRight, Lightbulb, PencilLine } from "lucide-react";

/** Drawing telephone's waiting room keeps the game's paper-and-ink medium. */
export function PaperPreview() {
  return <div className="relative mx-auto flex min-h-[260px] w-full max-w-xl items-center justify-center gap-3 py-10 sm:min-h-[360px] sm:gap-6" role="img" aria-label="传画猜词纸面预览：选词、画画、猜词接力">
    <div className="absolute inset-x-8 bottom-12 h-12 rounded-[50%] bg-[#181425]/25 blur-xl" />
    <div className="relative -rotate-6 rounded-xl bg-[#e4c4a5] px-4 py-7 text-center text-[#574537] shadow-[0_12px_25px_#211b3335] sm:px-8 sm:py-10"><Lightbulb className="mx-auto mb-4 size-9" strokeWidth={1.5} /><span className="text-base font-bold">一个词</span><span className="mt-2 block text-xs">脑洞的起点</span></div>
    <ArrowLeftRight className="relative size-5 shrink-0 text-[#dcc1d4]" />
    <div className="relative rotate-3 rounded-xl bg-[#fbefda] px-4 py-10 text-center text-[#805b56] shadow-[0_16px_35px_#211b3340] sm:px-8 sm:py-14"><PencilLine className="mx-auto mb-4 size-12" strokeWidth={1.3} /><span className="text-base font-bold">你的画</span><span className="mt-2 block text-xs">朋友来猜</span></div>
  </div>;
}

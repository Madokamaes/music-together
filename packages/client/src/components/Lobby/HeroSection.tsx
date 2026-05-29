import { Headphones } from 'lucide-react'
import { motion } from 'motion/react'

export function HeroSection() {
  return (
    <motion.section
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mt-hero mb-[18px] px-6 py-[46px] text-center sm:px-10"
    >
      <div className="relative z-10 mx-auto flex max-w-[650px] flex-col items-center">
        <span className="mb-5 inline-flex min-h-[30px] items-center gap-[9px] rounded-full border border-primary/20 bg-primary/[0.07] px-3 text-xs font-semibold tracking-[0.08em] text-[#f3d79e]">
          <span className="mt-sound-bars inline-flex h-[13px] items-end gap-0.5" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          实时同步音乐播放
        </span>
        <Headphones className="mb-4 h-7 w-7 text-primary sm:hidden" aria-hidden="true" />
        <h1 className="m-0 mt-5 text-[clamp(34px,7vw,70px)] font-bold leading-[0.96] tracking-[-0.074em] text-foreground">
          和朋友一起听歌
        </h1>
        <p className="mx-auto mt-[18px] max-w-[510px] text-[clamp(14px,2.4vw,17px)] leading-[1.8] text-muted-foreground">
          创建或加入一个房间，实时同步音乐播放
        </p>
      </div>
    </motion.section>
  )
}

import type { CSSProperties } from 'react'

interface CandyExplosionProps { colors: string[] }

// The explosion is a sibling of the candy: it stays full-size while the candy pops.
export function CandyExplosion({ colors }: CandyExplosionProps) {
  return (
    <span className="candy-explosion" data-explosion aria-hidden="true">
      <span className="burst-ring" style={{ '--burst-color': colors[0] } as CSSProperties} />
      {Array.from({ length: 12 }, (_, index) => {
        const spark = index >= 8
        const angle = index * Math.PI * 2 / (spark ? 4 : 8) + (spark ? Math.PI / 4 : 0)
        const distance = spark ? 24 : 30 + (index % 3) * 9
        return (
          <span key={index} className={spark ? 'burst-particle burst-spark' : 'burst-particle burst-shard'} style={{
            '--dx': `${Math.cos(angle) * distance}px`,
            '--dy': `${Math.sin(angle) * distance}px`,
            '--spin': `${(index % 2 ? 1 : -1) * (160 + index * 23)}deg`,
            '--delay': `${index % 4 * 9}ms`,
            '--size': `${spark ? 4 : 6 + index % 3 * 2}px`,
            '--burst-color': colors[index % colors.length],
          } as CSSProperties} />
        )
      })}
    </span>
  )
}

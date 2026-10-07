import { useId } from 'react';
import type { Artifact as ArtifactType, Palette } from '../model';
const colors = {
  bronze: { light: '#f2d7a9', mid: '#b78a51', dark: '#6c472e', shade: '#d5b487' },
  sage: { light: '#cfdbc5', mid: '#819787', dark: '#3f5f53', shade: '#9db2a1' },
  midnight: { light: '#c0d5e2', mid: '#738f9f', dark: '#324f65', shade: '#93adbd' },
};
export function Artifact({
  kind,
  palette = 'bronze',
  className = '',
}: {
  kind: ArtifactType;
  palette?: Palette;
  className?: string;
}) {
  const id = useId().replace(/:/g, '');
  const c = colors[palette];
  const paint = `url(#${id}-metal)`;
  const shadow = `url(#${id}-shadow)`;
  const glow = `url(#${id}-glow)`;
  // 渐变 ID 随组件实例唯一，避免同一页的多个藏品相互串色。
  return (
    <svg className={`artifact ${className}`} viewBox="0 0 400 320" fill="none" aria-hidden="true">
      <defs>
        <linearGradient
          id={`${id}-metal`}
          x1="100"
          y1="80"
          x2="310"
          y2="250"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={c.light} />
          <stop offset=".37" stopColor={c.mid} />
          <stop offset=".7" stopColor={c.dark} />
          <stop offset="1" stopColor={c.mid} />
        </linearGradient>
        <linearGradient
          id={`${id}-stone`}
          x1="150"
          y1="220"
          x2="210"
          y2="300"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#dedbd0" />
          <stop offset="1" stopColor="#a7a89c" />
        </linearGradient>
        <radialGradient id={`${id}-shadow`}>
          <stop stopColor="#20302a" stopOpacity=".36" />
          <stop offset="1" stopColor="#20302a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-glow`}>
          <stop stopColor="#ffe9b0" stopOpacity=".65" />
          <stop offset="1" stopColor="#ffe9b0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-beam`}>
          <stop stopColor="#ffe1a0" stopOpacity=".35" />
          <stop offset="1" stopColor="#ffe1a0" stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}-blur`}>
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      <ellipse cx="200" cy="278" rx="148" ry="23" fill={shadow} />
      {kind === 'bridge' && (
        <g>
          <path d="m55 235 150-22 145 23-145 29Z" fill="#d5d6c9" />
          <path d="m55 235 150 30v18L55 253Z" fill="#b5b8aa" />
          <path d="m205 265 145-29v18l-145 29Z" fill="#949e90" />
          <path d="m98 235 43-8 7 8-43 8Z" fill="#687d72" />
          <path d="m259 229 45 7-6 9-44-7Z" fill="#687d72" />
          <path
            d="M92 227c4-92 50-147 106-147 59 0 109 54 118 147l-23 5c-9-80-45-126-94-126-44 0-79 42-83 127Z"
            fill={paint}
          />
          <path
            d="M92 227c4-92 50-147 106-147 59 0 109 54 118 147"
            stroke={c.light}
            strokeWidth="3"
          />
          <path d="m79 216 128-19 120 21-126 22Z" fill={c.light} />
          <path d="m79 216 122 24v12L79 229Z" fill={c.mid} />
          <path d="m201 240 126-22v13l-126 21Z" fill={c.dark} />
          {[120, 148, 177, 226, 255, 282].map((x, i) => (
            <path
              key={x}
              d={`M${x} ${[151, 119, 105, 111, 130, 165][i]}v${[67, 96, 98, 91, 77, 47][i]}`}
              stroke={c.mid}
              strokeWidth="5"
            />
          ))}
          <path d="m80 208 122 23 123-21" stroke={c.light} strokeWidth="2" />
          <ellipse
            cx="200"
            cy="267"
            rx="49"
            ry="7"
            fill="#fff"
            opacity=".3"
            filter={`url(#${id}-blur)`}
          />
        </g>
      )}
      {kind === 'lighthouse' && (
        <g>
          <ellipse cx="200" cy="249" rx="99" ry="18" fill={c.dark} opacity=".15" />
          <path d="m104 240 96-20 96 20-96 23Z" fill="#d9dacf" />
          <path d="m104 240 96 23v18l-96-23Z" fill="#b8bcb0" />
          <path d="m200 263 96-23v18l-96 23Z" fill="#9fa99d" />
          <path d="m168 223 13-117h38l18 117-35 11Z" fill={paint} />
          <path d="m202 234-1-128h18l18 117Z" fill={c.dark} opacity=".35" />
          <path d="m176 108 24-8 25 8-25 9Z" fill={c.light} />
          <path d="m176 108 24 9v9l-24-9Z" fill={c.mid} />
          <path d="m200 117 25-9v9l-25 9Z" fill={c.dark} />
          <path d="m181 73 19-7 19 7v34l-19 6-19-6Z" fill="#f9d991" />
          <path d="M188 72v36m23-36v36" stroke={c.dark} strokeWidth="3" />
          <path d="m175 75 25-22 26 22-26 7Z" fill={paint} />
          <path d="M200 53V44" stroke={c.mid} strokeWidth="3" />
          <path d="m185 89-105-36v96Zm31 0 99-35v90Z" fill={`url(#${id}-beam)`} />
          <ellipse cx="200" cy="89" rx="65" ry="48" fill={glow} />
          <path d="M193 209v-20a7 7 0 0 1 14 0v22" fill={c.dark} />
          <path d="M195 143h8v14h-8Z" fill={c.light} opacity=".7" />
          <path
            d="M104 278q18-9 35 0t35 0m62-7q15-8 30 0t30 0"
            stroke={c.mid}
            strokeWidth="2"
            opacity=".4"
          />
        </g>
      )}
      {kind === 'crystal' && (
        <g>
          <ellipse cx="200" cy="264" rx="87" ry="17" fill="#d2d3c7" />
          <path d="M113 264v12c0 9 39 17 87 17s87-8 87-17v-12" fill={`url(#${id}-stone)`} />
          <ellipse cx="200" cy="264" rx="87" ry="17" fill="#e4e3d8" />
          <path d="m199 47 66 44 33 82-47 67-64 12-79-62 34-96Z" fill={paint} />
          <path d="m199 47 11 89-68-42Z" fill={c.light} opacity=".85" />
          <path d="m199 47 66 44-55 45Z" fill={c.mid} opacity=".75" />
          <path d="m142 94 68 42-102 54Z" fill={c.shade} />
          <path d="m265 91 33 82-88-37Z" fill={c.dark} />
          <path d="m210 136 88 37-47 67Z" fill={c.mid} />
          <path d="m210 136 41 104-64 12Z" fill={c.light} opacity=".65" />
          <path d="m108 190 102-54-23 116Z" fill={c.mid} opacity=".5" />
          <path
            d="m142 94 57-47 66 44 33 82-47 67-64 12-79-62 34-96 68 42 55-45m-55 45 41 104m-41-104-23 116"
            stroke={c.light}
            strokeWidth="1.4"
            opacity=".65"
          />
          <ellipse cx="201" cy="149" rx="49" ry="60" fill={glow} />
          <path d="M180 133h37m-18-18v38" stroke="#fff9dd" opacity=".6" strokeWidth="1" />
        </g>
      )}
      {kind === 'twin-stars' && (
        <g>
          <ellipse cx="200" cy="259" rx="113" ry="20" fill="#dfddd1" />
          <path d="M87 259v15c0 11 51 20 113 20s113-9 113-20v-15" fill={`url(#${id}-stone)`} />
          <ellipse cx="200" cy="259" rx="113" ry="20" fill="#e8e5db" />
          <ellipse cx="195" cy="151" rx="125" ry="106" fill={glow} />
          <path d="M146 196q36 67 123-28" stroke={c.mid} strokeWidth="4" />
          <path d="M147 192q38 58 120-28" stroke={c.light} strokeWidth="1.5" />
          <path d="m151 73 23 49 54 8-39 39 9 54-47-25-48 25 10-54-39-39 54-8Z" fill={paint} />
          <path
            d="m151 73 0 78-77-21 39 39-10 54 48-72 47 72-9-54 39-39-77 21 23-29Z"
            fill={c.light}
            opacity=".37"
          />
          <path d="m264 99 15 31 35 5-25 25 6 35-31-16-31 16 6-35-25-25 35-5Z" fill={paint} />
          <path
            d="m264 99 0 52-50-16 25 25-6 35 31-44 31 44-6-35 25-25-50 16 15-21Z"
            fill={c.light}
            opacity=".5"
          />
          <path d="m151 73 23 49 54 8m36-31 15 31 35 5" stroke={c.light} strokeWidth="2" />
          <circle cx="235" cy="81" r="2" fill={c.light} />
          <circle cx="95" cy="94" r="2" fill={c.mid} />
          <circle cx="318" cy="204" r="2" fill={c.light} />
        </g>
      )}
      {kind === 'mountain' && (
        <g>
          <path d="m78 251 114-21 132 21-124 26Z" fill="#dbddcf" />
          <path d="m78 251 122 26v19L78 270Z" fill="#b4bbab" />
          <path d="m200 277 124-26v19l-124 26Z" fill="#96a28f" />
          <path d="m85 238 74-108 61 113Z" fill={c.shade} />
          <path d="m159 130 19 102 42 11Z" fill={c.dark} opacity=".55" />
          <path d="m133 246 80-158 95 164-108 21Z" fill={paint} />
          <path d="m213 88-13 185 108-21Z" fill={c.dark} />
          <path d="m213 88-28 56 25-9 13 21 9-17 20 17Z" fill={c.light} />
          <path d="m133 246 62-71-15 43 20 55Z" fill={c.light} opacity=".25" />
          <path d="m246 254 36-58 46 61-36 15Z" fill={c.mid} />
          <path d="m282 196 10 76 36-15Z" fill={c.dark} />
          <ellipse cx="213" cy="89" rx="39" ry="36" fill={glow} />
          <path d="M213 69v-9m-16 19-7-4m38 4 7-4" stroke={c.light} opacity=".7" />
        </g>
      )}
    </svg>
  );
}

export type ScriptTrack = 'sanskrit' | 'siddham'

export const trackMeta: Record<
  ScriptTrack,
  { title: string; subtitle: string; scriptLabel: string }
> = {
  sanskrit: {
    title: '산스크리트',
    subtitle: '데바나가리 문자로 자모를 익힙니다.',
    scriptLabel: '데바나가리',
  },
  siddham: {
    title: '실담',
    subtitle: 'Siddhaṃ 문자로 자모를 익힙니다.',
    scriptLabel: 'Siddhaṃ',
  },
}

import './About.css'

type Props = {
  onBack: () => void
}

export function About({ onBack }: Props) {
  return (
    <main className="about">
      <header className="about__bar">
        <button type="button" className="about__back motion-press" onClick={onBack}>
          ← 홈
        </button>
        <h1>처음이신가요</h1>
      </header>

      <article className="about__body">
        <section className="about__section" aria-labelledby="about-app">
          <h2 id="about-app">이 앱은</h2>
          <p>
            <strong>삼뱌꾸샴붓다</strong>는 산스크리트와 실담(Siddhaṃ) 자모를 트랙별로
            보고, 쓰고, 익히는 학습 앱입니다. 문장·문법보다 먼저{' '}
            <strong>글자 모양과 쓰기 순서</strong>에 익숙해지는 것을 목표로 합니다.
          </p>
        </section>

        <section className="about__section" aria-labelledby="about-sa">
          <p className="about__sample about__sample--deva" lang="sa" aria-hidden="true">
            अ आ इ ई क ख ग
          </p>
          <h2 id="about-sa">산스크리트 · 데바나가리</h2>
          <p>
            <strong>산스크리트</strong>는 인도·남아시아의 고전 언어로, 힌두·불교·자이나
            문헌과 학문에 널리 쓰였습니다. 오늘날 배우는 산스크리트 글자는 보통{' '}
            <strong>데바나가리(Devanāgarī)</strong>로 씁니다.
          </p>
          <p>
            데바나가리는 가로 윗선(시로레카)과 모음·자음 기호가 특징입니다. 이 앱의
            「산스크리트」 트랙에서는 그 자모를 하나씩 익힙니다.
          </p>
        </section>

        <section className="about__section" aria-labelledby="about-si">
          <p className="about__sample about__sample--siddham" lang="sa" aria-hidden="true">
            अ आ इ ई क ख ग
          </p>
          <h2 id="about-si">실담 (Siddhaṃ)</h2>
          <p>
            <strong>실담(悉曇, Siddhaṃ)</strong>은 산스크리트·범어를 적기 위해 쓰인 옛
            문자입니다. 특히 동아시아 불교에서 진언·만트라를 적을 때 전해졌고, 한국·일본
            불교 전통에서도 만날 수 있습니다.
          </p>
          <p>
            글자 체계는 데바나가리와 뿌리가 비슷하지만, <strong>모양과 쓰는 감</strong>은
            다릅니다. 「실담」 트랙에서는 Siddhaṃ 자모를 따로 학습합니다.
          </p>
        </section>

        <section className="about__section" aria-labelledby="about-diff">
          <h2 id="about-diff">둘의 관계</h2>
          <ul className="about__list">
            <li>
              <strong>같은 점</strong> — 둘 다 산스크리트 소리를 적는 문자 전통입니다.
            </li>
            <li>
              <strong>다른 점</strong> — 쓰인 시대·지역·글자 모양이 달라, 읽기와 쓰기
              연습도 트랙을 나눕니다.
            </li>
            <li>
              <strong>이 앱에서</strong> — 산스크리트(데바나가리)와 실담을 각각 고른 뒤
              학습·연습합니다.
            </li>
          </ul>
        </section>

        <section className="about__section" aria-labelledby="about-how">
          <h2 id="about-how">어떻게 쓰면 되나요</h2>
          <ul className="about__list">
            <li>
              <strong>학습</strong> — 계열별로 글자를 보고, 쓰기 순서를 따라 익힙니다.
            </li>
            <li>
              <strong>연습</strong> — 글자·로마자(IAST)·한글 힌트를 맞히며 기억을
              굳힙니다.
            </li>
            <li>
              <strong>전체 문자 보기</strong> — 한 화면에서 자모 전체를 훑어봅니다.
            </li>
          </ul>
          <p className="about__note">
            발음 듣기는 녹음이 준비된 글자부터 켜집니다. 없어도 모양·쓰기 연습은 그대로
            할 수 있습니다.
          </p>
        </section>
      </article>

      <button type="button" className="about__cta motion-press" onClick={onBack}>
        홈으로 시작하기
      </button>
    </main>
  )
}

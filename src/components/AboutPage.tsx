import { useI18n } from '../i18n/I18nContext'

export function AboutPage() {
  const { t, lang } = useI18n()

  return (
    <section className="about-page" id="about">
      <h2>{t('aboutTitle')}</h2>
      {lang === 'hi' ? (
        <>
          <p>
            Nirpeksh स्वतंत्र भारतीय यूट्यूब समाचार चैनलों की सार्वजनिक सूची है —
            खासकर उन रिपोर्टर्स और छोटी टीमों की, जो पारंपरिक प्राइम-टाइम के बाहर
            ज़मीनी काम कर रहे हैं।
          </p>
          <h3>लिस्टिंग मानदंड</h3>
          <ul>
            <li>मुख्य रूप से समाचार, ग्राउंड रिपोर्ट, जाँच या पब्लिक-इंटरेस्ट फोकस</li>
            <li>यूट्यूब पर सक्रिय, सार्वजनिक चैनल</li>
            <li>कॉर्पोरेट/पार्टी प्रचार ब्यूरो की तरह न दिखना</li>
            <li>दर्शक रेटिंग और वैकल्पिक “मैं क्यों भरोसा करता हूँ” नोट्स से भरोसा बने</li>
          </ul>
          <p>
            सूची संपादकीय है और किसी चैनल से संबद्ध नहीं। सुझाव फीडबैक से भेजें।
          </p>
        </>
      ) : (
        <>
          <p>
            Nirpeksh is a public directory of independent Indian YouTube news
            channels — especially reporters and small teams doing ground work
            outside captive prime-time media.
          </p>
          <h3>Listing criteria</h3>
          <ul>
            <li>Primary focus on news, ground reports, investigation, or public interest</li>
            <li>Active, public YouTube channel</li>
            <li>Not primarily a party/corporate PR bureau</li>
            <li>Community trust grows through signed-in ratings and optional trust notes</li>
          </ul>
          <p>
            The list is editorial and not affiliated with any channel. Send
            suggestions via Feedback.
          </p>
        </>
      )}
    </section>
  )
}

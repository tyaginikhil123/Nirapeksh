import type { Channel } from '../data/channels'
import type { UiLang } from '../i18n/dictionary'

type DraftInput = {
  channel: Pick<Channel, 'name' | 'focus' | 'tags' | 'language' | 'founder'>
  userRating: number | null
  lang: UiLang
}

function pickTag(channel: DraftInput['channel']): string {
  return channel.tags[0] || channel.focus
}

function clampNote(text: string): string {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  return trimmed.length <= 280 ? trimmed : `${trimmed.slice(0, 277).trim()}…`
}

/**
 * Free local draft helper — template remix from channel metadata + rating.
 * No cloud / paid model. User should edit before saving.
 */
export function draftTrustNote(input: DraftInput): string {
  const { channel, userRating, lang } = input
  const tag = pickTag(channel)
  const name = channel.name
  const focus = channel.focus.toLowerCase()
  const rating = userRating && userRating >= 1 && userRating <= 5 ? userRating : null

  const enHigh = [
    `I trust ${name} for steady ${focus} — especially on ${tag}, without prime-time noise.`,
    `${name} earns trust for me: grounded ${focus} and clearer ${tag} coverage than TV panels.`,
    `I rate ${name} high because the ${focus} feels sourced, and ${tag} stories stay useful.`,
  ]
  const enMid = [
    `Mixed so far on ${name}, but the ${focus} on ${tag} is still worth following.`,
    `I trust parts of ${name}'s ${focus}; ${tag} episodes help, even when framing differs.`,
    `${name} is useful for ${tag}, though I don't buy every take — still rating mid.`,
  ]
  const enLow = [
    `Low trust for now: ${name}'s ${focus} on ${tag} often feels one-sided to me.`,
    `I watch ${name} for ${tag}, but the ${focus} tone doesn't earn a high trust score yet.`,
    `Not fully convinced by ${name} yet — ${focus} coverage of ${tag} needs more balance.`,
  ]
  const enNone = [
    `I follow ${name} for ${focus}, especially ${tag} — writing this while I decide my score.`,
    `${name} stands out for ${focus} outside studio TV; ${tag} is why I keep watching.`,
  ]

  const hiHigh = [
    `मैं ${name} पर भरोसा रखता/रखती हूँ — ${focus} और ${tag} कवरेज टीवी शोर से अलग लगता है।`,
    `${name} का ${focus} काम भरोसेमंद लगता है, खासकर ${tag} पर ज़मीनी/साफ़ बात।`,
    `${name} को ऊँचा रेट इसलिए — ${tag} पर ${focus} उपयोगी और स्पष्ट लगता है।`,
  ]
  const hiMid = [
    `${name} पर मिश्रित अनुभव है, पर ${tag} वाला ${focus} अभी भी देखने लायक है।`,
    `कुछ बातें जचती हैं, कुछ नहीं — फिर भी ${name} का ${focus}/${tag} काम फॉलो करता/करती हूँ।`,
    `${name} मददगार है ${tag} के लिए, लेकिन हर एंगल से सहमत नहीं — मिड रेटिंग।`,
  ]
  const hiLow = [
    `अभी कम भरोसा: ${name} का ${focus} (${tag}) कई बार एकतरफा लगता है।`,
    `${name} देखता/देखती हूँ ${tag} के लिए, पर ऊँचा ट्रस्ट स्कोर अभी नहीं।`,
    `${name} पर पूरी तरह यकीन नहीं — ${focus} में और संतुलन चाहिए।`,
  ]
  const hiNone = [
    `${name} को ${focus} के लिए फॉलो करता/करती हूँ, खासकर ${tag} — स्कोर सोचते हुए नोट।`,
    `${name} प्राइम-टाइम से अलग ${focus} देता है; ${tag} की वजह से देखना जारी है।`,
  ]

  let pool: string[]
  if (lang === 'hi') {
    if (rating === null) pool = hiNone
    else if (rating >= 4) pool = hiHigh
    else if (rating === 3) pool = hiMid
    else pool = hiLow
  } else if (rating === null) {
    pool = enNone
  } else if (rating >= 4) {
    pool = enHigh
  } else if (rating === 3) {
    pool = enMid
  } else {
    pool = enLow
  }

  const index = Math.floor(Math.random() * pool.length)
  return clampNote(pool[index] ?? pool[0]!)
}

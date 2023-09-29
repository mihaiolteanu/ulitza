import * as R from "ramda"
import { statistics } from "./eponyms.min.js"

// Remove country name and metadata
const skipNameAndMetadata = (country) =>
  R.chain(R.compose(R.tail, R.tail), country)

// Human-readable name
const eponymDisplay = R.replace(/_/g, " ")

// 
const wikiURL = l => `https://${l[0]}.wikipedia.org/wiki/${l[1]}`

export const eponyms = (country, n = -1) =>
  R.pipe(    
    R.filter(R.compose(R.equals(country.toLowerCase()), R.head)),    
    skipNameAndMetadata,
    R.take(n),
    R.map(e => [eponymDisplay(e[1][1]), e[0], wikiURL(e[1])])     
  )(statistics)

export const eponymName  = R.prop(0)
export const eponymCount = R.prop(1)
export const eponymURL   = R.prop(2)

const { p, div, a, sup, span, button, input } = van.tags

import regions from "./regions.js"

const statistics = await fetch("http://192.168.1.8:8085/out-statistics/statistics4.json")
  .then(s => s.json())

const regionsNames = R.map(R.head, regions)

// Returns true if `country` has at least one street name, false otherwise
const countryHasData = (country) =>
  R.pipe(
    R.map(R.head),
    R.find(R.equals(country)),
    R.complement(R.isNil)    
  )(statistics)

// All relevant country names for the given `region`
const regionCountryNames = region =>
  R.pipe(
    R.filter(R.compose(R.equals(region), R.head)),    
    R.flatten,
    // The first entry is the region name
    R.tail,
    // Keep only countries that have some persons
    R.filter(countryHasData),
  )(regions)

const countryDetails = country =>
  R.filter(R.compose(R.equals(country), R.head), statistics)[0]

const displayName = (link) =>
  R.compose(R.join(" "), R.split("_"), R.last, R.split("/"), decodeURI)(link)

const worldFrequency = () =>
  R.pipe(
    R.chain(R.prop(3)),
    R.map(R.prop(2)),
    R.groupBy(R.identity),
    R.mapObjIndexed(R.length),
    R.toPairs,
    // Keep persons appearing at least three or more times
    R.reject(R.compose(R.gt(3), R.prop(1))),
    R.sortWith([R.descend(R.prop(1))]),    
  )(statistics)

const worldTotal = 
  R.pipe(
    R.map(R.props([1, 2])),
    R.reduce((acc, elem) => [acc[0] + elem[0], acc[1] + elem[1]], [0, 0]),
  )(statistics)


const L = {
  country: {
    name: R.lensIndex(0),
    peopleCount: R.lensIndex(1),
    streetsCount: R.lensIndex(2),
    persons: R.lensIndex(3)
  }
}

// Country lenses
const name         = R.lensIndex(0)
const peopleCount  = R.lensIndex(1)
const streetsCount = R.lensIndex(2)
const persons      = R.lensIndex(3)

const selectedRegion = van.state("")
const selectedCountry = van.state("")


// display persons
document.getElementById("persons").appendChild(
  van.bind(selectedCountry, (selectedCountry) => {
    const country = countryDetails(selectedCountry)
    if (country)
      return span(
        div(R.view(name, country)),
        div(          
          span("👥 " + R.view(peopleCount, country)),
          span(" 🛣 " + R.view(streetsCount, country)),
        ),
        
        R.map(person =>
          span({ class: "person" },
            a({
              href: person[2],
              target: "_blank"
            }, displayName(person[2])),
            sup(person[1] + " ")),
          R.view(persons, country)
        ))
    return span(
      div(
        span("👥 " + worldTotal[0]),
        span(" 🛣 " + worldTotal[1]),
      ),
      R.map(person =>
        span({ class: "person" },
          a({
            href: person[0],
            target: "_blank"
          }, displayName(person[0])),
          sup(person[1] + " ")),
        worldFrequency()
      )
    )
  }))


// display countries
document.getElementById("countries").appendChild(
  van.bind(selectedRegion, (selectedRegion) =>
    span(
      R.map(country =>
        span({ class: "country" },
          a({
            onclick: () => selectedCountry.val = country,
            href: `#${country}`,
            id: {
              deps: [selectedCountry],
              f: R.ifElse(
                R.equals(country), R.always("selected-country"), R.always("")
              )
            }
          }, country + " ")),
        regionCountryNames(selectedRegion)))))


// display regions
document.getElementById("regions").appendChild(
  span(
    R.map(region =>
      a({
        href: `#${region}`,
        onclick: () => {
          if (selectedRegion.val === region) {
            selectedRegion.val = ""
            selectedCountry.val = ""
          }
            
          else
            selectedRegion.val = region
        },
        id: {
          deps: [selectedRegion],
          f: R.ifElse(
            R.equals(region), R.always("selected-region"), R.always("")
          )
        }
      }, region),
    regionsNames)))

// display search
document.getElementById("search").appendChild(
  input({
    type: "search",    
    oninput: t => console.log(t.target.value)
  })
)

document.getElementById("ulitsa").appendChild(
  a({
    href: "#",
    onclick: () => {
      selectedRegion.val = ""
      selectedCountry.val = ""      
    }
  }, "ulitza")
)

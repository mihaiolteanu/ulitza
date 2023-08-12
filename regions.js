import * as R from "./ramda.js"

export const regionsNames = () => R.map(R.head, regions)

// Return all the countries in the given `region`
export const regionCountries = R.memoizeWith(R.identity, region =>
  R.pipe(
    R.filter(R.propEq(0, region)),
    R.chain(R.tail),              // get sub-regions  
    R.chain(R.tail),              // get countries
    R.reduce(R.concat, []),                    
    R.sortWith([(R.ascend(R.prop(1)))])    
  )(regions))

export const osmDownloadLink = (country) =>
  R.pipe(
    // Get all raw-regions, as they appear on geofabrik
    R.chain(R.tail),
    // Keep only the region containing the given country
    R.find(R.find(R.find(R.propEq(0, country)))),
    // ...if it exists
    R.propOr("", 0),    
    region => region === ""
      ? ""
      : `http://download.geofabrik.de/${region}/${country}-latest.osm.pbf`,    
  )(regions)

export const allCountryEntries = () => R.pipe(
  R.chain(R.tail),
  R.chain(R.tail),  
  R.reduce(R.concat, [])
)(regions)

const countryEntry = country => R.find(R.propEq(0, country), allCountryEntries())

export const allCountries = R.compose(R.map(R.head), allCountryEntries)
export const countryDisplayName = R.compose(R.prop(1), countryEntry)
export const countryEponymFrequency = R.compose(R.prop(2), countryEntry)
export const countryStreetLength = R.compose(R.prop(3), countryEntry)


export const regions = [
  // Region (display name)
  ["Africa",
    // Sub-Region (osm download site name),
    ["africa", [
      // Raw Name                                      Display Name
      ["algeria",                                      "Algeria"],
      ["angola",                                       "Angola"],
      ["benin",                                        "Benin"],
      ["botswana",                                     "Botswana"],
      ["burkina-faso",                                 "Burkina Faso"],
      ["burundi",                                      "Burundi"],
      ["cameroon",                                     "Cameroon"],
      ["canary-islands",                               "Canary Islands"],
      ["cape-verde",                                   "Cape Verde"],
      ["central-african-republic",                     "Central African Republic"],
      ["chad",                                         "Chad"],
      ["comores",                                      "Comores"],
      ["congo-brazzaville",                            "Republic of the Congo"],
      ["congo-democratic-republic",                    "Democratic Republic of the Congo"],
      ["djibouti",                                     "Djibouti"],
      ["egypt",                                        "Egypt"],
      ["equatorial-guinea",                            "Equatorial Guinea"],
      ["eritrea",                                      "Eritrea"],
      ["ethiopia",                                     "Ethiopia"],
      ["gabon",                                        "Gabon"],
      ["ghana",                                        "Ghana"],
      ["guinea",                                       "Guinea"],
      ["guinea-bissau",                                "Guinea Bissau"],
      ["ivory-coast",                                  "Ivory Coast"],
      ["kenya",                                        "Kenya"],
      ["lesotho",                                      "Lesotho"],
      ["liberia",                                      "Liberia"],
      ["libya",                                        "Libya"],
      ["madagascar",                                   "Madagascar"],
      ["malawi",                                       "Malawi"],
      ["mali",                                         "Mali"],
      ["mauritania",                                   "Mauritania"],
      ["mauritius",                                    "Mauritius"],
      ["morocco",                                      "Morocco"],
      ["mozambique",                                   "Mozambique"],
      ["namibia",                                      "Namibia"],
      ["niger",                                        "Niger"],
      ["nigeria",                                      "Nigeria"],
      ["rwanda",                                       "Rwanda"],
      ["saint-helena-ascension-and-tristan-da-cunha",  "Saint Helena"],
      ["sao-tome-and-principe",                        "Sao Tome and Principe"],
      ["senegal-and-gambia",                           "Senegal and Gambia"],
      ["seychelles",                                   "Seychelles"],
      ["sierra-leone",                                 "Sierra Leone"],
      ["somalia",                                      "Somalia"],
      ["south-africa",                                 "South Africa"],
      ["south-sudan",                                  "South Sudan"],
      ["sudan",                                        "Sudan"],
      ["swaziland",                                    "Swaziland"],
      ["tanzania",                                     "Tanzania"],
      ["togo",                                         "Togo"],
      ["tunisia",                                      "Tunisia"],
      ["uganda",                                       "Uganda"],
      ["zambia",                                       "Zambia"],
      ["zimbabwe",                                     "Zimbabwe"]
    ]]
  ],

  
  ["Americas",
    ["central-america", [
      ["bahamas",           "Bahamas"],
      ["belize",            "Belize"],
      ["costa-rica",        "Costa Rica"],
      ["cuba",              "Cuba"],    
      ["el-salvador",       "El Salvador"],
      ["guatemala",         "Guatemala"],
      ["haiti-and-domrep",  "Haiti and Dominican Republic"],
      ["honduras",          "Honduras"],
      ["jamaica",           "Jamaica"],
      ["nicaragua",         "Nicaragua"],
      ["panama",            "Panama"],      
    ]],   
    ["north-america", [
      ["canada",            "Canada"],
      ["greenland",         "Greenland"],
      ["mexico",            "Mexico"],
      ["us",                "United States"]
    ]],   
    ["south-america", [
      ["argentina",         "Argentina"],
      ["bolivia",           "Bolivia"],
      ["brazil",            "Brazil"],
      ["chile",             "Chile"],
      ["colombia",          "Colombia"],
      ["ecuador",           "Ecuador"],
      ["guyana",            "Guyana"],
      ["paraguay",          "Paraguay"],
      ["peru",              "Peru"],
      ["suriname",          "Suriname"],
      ["uruguay",           "Uruguay"],
      ["venezuela",         "Venezuela"]
    ]],
  ],

  
  ["Asia",
    ["asia", [
      ["afghanistan",                "Afghanistan",               2],
      ["armenia",                    "Armenia",                   3],
      ["azerbaijan",                 "Azerbaijan",                2],
      ["bangladesh",                 "Bangladesh",                3],
      ["bhutan",                     "Bhutan",                    2],
      ["cambodia",                   "Cambodia",                  2],
      ["china",                      "China",                     3],
      ["gcc-states",                 "GCC States",                3],
      ["india",                      "India",                     3],
      ["indonesia",                  "Indonesia",                 3],
      ["iran",                       "Iran",                      3],
      ["iraq",                       "Iraq",                      3],
      ["israel-and-palestine",       "Israel and Palestine",      3],
      ["japan",                      "Japan",                     3],
      ["jordan",                     "Jordan",                    3],
      ["kazakhstan",                 "Kazakhstan",                3],
      ["kyrgyzstan",                 "Kyrgyzstan",                2],
      ["laos",                       "Laos",                      2],
      ["lebanon",                    "Lebanon",                   2],
      ["malaysia-singapore-brunei",  "Malaysia Singapore Brunei", 3],
      ["mongolia",                   "Mongolia",                  3],
      ["myanmar",                    "Myanmar",                   3],
      ["nepal",                      "Nepal",                     3],
      ["north-korea",                "North Korea",               3],
      ["pakistan",                   "Pakistan",                  3],
      ["philippines",                "Philippines",               3],
      ["russia",                     "Russia",                    3],
      ["south-korea",                "South Korea",               3],
      ["sri-lanka",                  "Sri Lanka",                 3],
      ["syria",                      "Syria",                     3],
      ["taiwan",                     "Taiwan",                    3],
      ["tajikistan",                 "Tajikistan",                2],
      ["thailand",                   "Thailand",                  3],
      ["turkmenistan",               "Turkmenistan",              3],
      ["uzbekistan",                 "Uzbekistan",                3],
      ["vietnam",                    "Vietnam",                   3],
      ["yemen",                      "Yemen",                     2],
    ]]
  ],

  ["Europe",
    ["europe", [
      ["albania",                       "Albania",             2],
      ["andorra",                       "Andorra",             2],
      ["austria",                       "Austria",             3],
      ["azores",                        "Azores",              2],
      ["belarus",                       "Belarus",             3],
      ["belgium",                       "Belgium",             2],
      ["bosnia-herzegovina",            "Bosnia Herzegovina",  2],
      ["bulgaria",                      "Bulgaria",            3],
      ["croatia",                       "Croatia",             3],
      ["cyprus",                        "Cyprus",              2],
      ["czech-republic",                "Czech Republic",      3],
      ["denmark",                       "Denmark",             3],
      ["estonia",                       "Estonia",             3],
      ["faroe-islands",                 "Faroe Islands",       2],
      ["finland",                       "Finland",             3],
      ["france",                        "France",              3],
      ["georgia",                       "Georgia",             3],
      ["germany",                       "Germany",             3],
      ["great-britain",                 "Great Britain",       3],
      ["greece",                        "Greece",              3],
      ["guernsey-jersey",               "Guernsey Jersey",     2],
      ["hungary",                       "Hungary",             2],
      ["iceland",                       "Iceland",             2],
      ["ireland-and-northern-ireland",  "Ireland",             2],
      ["isle-of-man",                   "Isle of Man",         2],
      ["italy",                         "Italy",               3],
      ["kosovo",                        "Kosovo",              2],
      ["latvia",                        "Latvia",              3],
      ["liechtenstein",                 "Liechtenstein",       2],
      ["lithuania",                     "Lithuania",           3],
      ["luxembourg",                    "Luxembourg",          2],
      ["macedonia",                     "Macedonia",           2],
      ["malta",                         "Malta",               2],
      ["moldova",                       "Moldova",             2],
      ["monaco",                        "Monaco",              2],
      ["montenegro",                    "Montenegro",          2],
      ["netherlands",                   "Netherlands",         3],
      ["norway",                        "Norway",              3],
      ["poland",                        "Poland",              3],
      ["portugal",                      "Portugal",            3],
      ["romania",                       "Romania",             2],
      ["russia",                        "Russia",              2],
      ["serbia",                        "Serbia",              2],
      ["slovakia",                      "Slovakia",            2],
      ["slovenia",                      "Slovenia",            3],
      ["spain",                         "Spain",               3],
      ["sweden",                        "Sweden",              3],
      ["switzerland",                   "Switzerland",         3],
      ["turkey",                        "Turkey",              3],
      ["ukraine",                       "Ukraine",             3]
    ]]
  ],

  ["Oceania",
    ["australia-oceania", [
      ["american-oceania",     "American Oceania",     2],
      ["australia",            "Australia",            3],      
      ["fiji",                 "Fiji",                 2], 
      ["new-caledonia",        "New Caledonia",        2],
      ["new-zealand",          "New Zealand",          3],      
      ["papua-new-guinea",     "Papua New Guinea",     2],
      ["polynesie-francaise",  "Polynesie Francaise",  2],      
    ]]
  ]
]

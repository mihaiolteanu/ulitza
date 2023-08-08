import * as R from "./ramda.js"
import S from "sanctuary"

export const regionsNames = () => R.map(R.head, regions)

export const countryDisplayName = R.memoizeWith(R.identity, country =>
  R.pipe(
    R.chain(R.tail),              // get sub-regions  
    R.chain(R.tail),              // get countries
    R.reduce(R.concat, []),
    R.find(R.propEq(0, country)),
    R.last,
  )(regions)) 

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
    // Return Just the url or Nothing, if country was spelled wrong, for example
    v => v === "" ? S.Nothing : S.Just(v),    
    R.map(r => `http://download.geofabrik.de/${r}/${country}-latest.osm.pbf`),    
  )(regions)

export const allCountries = () => R.pipe(
  R.chain(R.tail),
  R.chain(R.tail),
  R.chain(R.tail),
  R.map(R.head),  
)(regions)


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
      ["afghanistan",                "Afghanistan"],
      ["armenia",                    "Armenia"],
      ["azerbaijan",                 "Azerbaijan"],
      ["bangladesh",                 "Bangladesh"],
      ["bhutan",                     "Bhutan"],
      ["cambodia",                   "Cambodia"],
      ["china",                      "China"],
      ["east-timor",                 "East Timor"],
      ["gcc-states",                 "GCC States"],
      ["india",                      "India"],
      ["indonesia",                  "Indonesia"],
      ["iran",                       "Iran"],
      ["iraq",                       "Iraq"],
      ["israel-and-palestine",       "Israel and Palestine"],
      ["japan",                      "Japan"],
      ["jordan",                     "Jordan"],
      ["kazakhstan",                 "Kazakhstan"],
      ["kyrgyzstan",                 "Kyrgyzstan"],
      ["laos",                       "Laos"],
      ["lebanon",                    "Lebanon"],
      ["malaysia-singapore-brunei",  "Malaysia Singapore Brunei"],
      ["maldives",                   "Maldives"],
      ["mongolia",                   "Mongolia"],
      ["myanmar",                    "Myanmar"],
      ["nepal",                      "Nepal"],
      ["north-korea",                "North Korea"],
      ["pakistan",                   "Pakistan"],
      ["philippines",                "Philippines"],
      ["russia",                     "Russia"],
      ["south-korea",                "South Korea"],
      ["sri-lanka",                  "Sri Lanka"],
      ["syria",                      "Syria"],
      ["taiwan",                     "Taiwan"],
      ["tajikistan",                 "Tajikistan"],
      ["thailand",                   "Thailand"],
      ["turkmenistan",               "Turkmenistan"],
      ["uzbekistan",                 "Uzbekistan"],
      ["vietnam",                    "Vietnam"],
      ["yemen",                      "Yemen"],
    ]]
  ],

  ["Europe",
    ["europe", [
      ["albania",                       "Albania"],
      ["andorra",                       "Andorra"],
      ["austria",                       "Austria"],
      ["azores",                        "Azores"],
      ["belarus",                       "Belarus"],
      ["belgium",                       "Belgium"],
      ["bosnia-herzegovina",            "Bosnia Herzegovina"],
      ["bulgaria",                      "Bulgaria"],
      ["croatia",                       "Croatia"],
      ["cyprus",                        "Cyprus"],
      ["czech-republic",                "Czech Republic"],
      ["denmark",                       "Denmark"],
      ["estonia",                       "Estonia"],
      ["faroe-islands",                 "Faroe Islands"],
      ["finland",                       "Finland"],
      ["france",                        "France"],
      ["georgia",                       "Georgia"],
      ["germany",                       "Germany"],
      ["great-britain",                 "Great Britain"],
      ["greece",                        "Greece"],
      ["guernsey-jersey",               "Guernsey Jersey"],
      ["hungary",                       "Hungary"],
      ["iceland",                       "Iceland"],
      ["ireland-and-northern-ireland",  "Ireland"],
      ["isle-of-man",                   "Isle of Man"],
      ["italy",                         "Italy"],
      ["kosovo",                        "Kosovo"],
      ["latvia",                        "Latvia"],
      ["liechtenstein",                 "Liechtenstein"],
      ["lithuania",                     "Lithuania"],
      ["luxembourg",                    "Luxembourg"],
      ["macedonia",                     "Macedonia"],
      ["malta",                         "Malta"],
      ["moldova",                       "Moldova"],
      ["monaco",                        "Monaco"],
      ["montenegro",                    "Montenegro"],
      ["netherlands",                   "Netherlands"],
      ["norway",                        "Norway"],
      ["poland",                        "Poland"],
      ["portugal",                      "Portugal"],
      ["romania",                       "Romania"],
      ["russia",                        "Russia"],
      ["serbia",                        "Serbia"],
      ["slovakia",                      "Slovakia"],
      ["slovenia",                      "Slovenia"],
      ["spain",                         "Spain"],
      ["sweden",                        "Sweden"],
      ["switzerland",                   "Switzerland"],
      ["turkey",                        "Turkey"],
      ["ukraine",                       "Ukraine"],
    ]]],

  ["Oceania",
    ["australia-oceania", [
      ["american-oceania",     "American Oceania"],
      ["australia",            "Australia"],
      ["cook-islands",         "Cook Islands"],
      ["fiji",                 "Fiji"],
      ["ile-de-clipperton",    "Clipperton Island"],
      ["kiribati",             "Kiribati"],
      ["marshall-islands",     "Marshall Islands"],
      ["micronesia",           "Micronesia"],
      ["nauru",                "Nauru"],
      ["new-caledonia",        "New Caledonia"],
      ["new-zealand",          "New Zealand"],
      ["niue",                 "Niue"],
      ["palau",                "Palau"],
      ["papua-new-guinea",     "Papua New Guinea"],
      ["pitcairn-islands",     "Pitcairn Islands"],
      ["polynesie-francaise",  "Polynesie Francaise"],
      ["samoa",                "Samoa"],
      ["solomon-islands",      "Solomon Islands"],
      ["tokelau",              "Tokelau"],
      ["tonga",                "Tonga"],
      ["tuvalu",               "Tuvalu"],
      ["vanuatu",              "Vanuatu"],
      ["wallis-et-futuna",     "Wallis and Futuna"]
    ]]
  ]
]

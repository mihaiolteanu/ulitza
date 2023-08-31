# About

Ulitza is a list of the most popular street names of every country. All the
streets included are named after persons. So a list of eponyms, in short. See
additional info at [about](https://www.ulitza.com/about)

# Contributions

The easiest way to contribute to the project is to add a new eponym. Check out
`eponyms/country-of-choice.json`, and in case you spot a person name that
doesn't have a wikipedia link, add it. Alternatively, if a link points to a
wrong person or no person at all (it can happen) you can edit or remove
it. Create a new PR and that's it. If it gets accepted, everything else it taken
care of.

There is usually more than one way a given person has been imortalized on street
signs, sometimes the name also includes "Poet" or "President", sometimes the
spelling is different.. All such variants are captured in the `equivalents.js`
file, for each country. If you find a new possible entry, add it here.

All affixes, like "street", "boulevard", "square", etc. must be removed. They
are not really a part of a person name. The `affixes.js` file stores all these
extra words that we must get rid of.

# Definitions

# Usage and workflow

## Update a given country to the latest osm data
1. node ./ulitza.js download mycountry
2. node ./ulitza.js extract mycountry
3. node ./ulitza.js update mycountry


```
Usage: node ./ulitza.js [options] [command]

Commands:
  download <country>         Download the <country>-latest.osm.pbf file from
                             geofabrik.de to "osm_data". This file contains all
                             the unprocessed street data.
  extract <country>          Parse and extract street data from an already
                             existing <country>-latest.osm.pbf file. This
                             extracted data is still in raw form and is used to
                             manually inspect it for possible affixes before
                             generating the eponyms file. The output is saved
                             to "raw/<country>.json"
  update [country]           Parse the raw/[country].json file and generate a
                             list of street names together with their number of
                             occurences. The output of this command is saved
                             to`eponyms/[country].json`. If this file already
                             exist, the command adds, as a final step, all the
                             existing wikipedia links to the newly generated
                             one. The generated file can be manually modified
                             to add new wikipedia links. If the [country] is
                             not specified, generate the eponyms.json and
                             eponyms.min.json files containing all the eponyms
                             for all the countries.
  check [country]            Verify if [country] has duplicate equivalent
                             entries, duplicate urls or consistent urls. If the
                             [country] is not specified, return a list of all
                             the countries where such checks fail. You can then
                             rerun the command for every listed country.
  inspect <country> <regex>  Inspect the <country> raw osm data. Useful in
                             finding new osm tags containing possible eponyms.
                             Only needed if we're going to modify the
                             generator.
  help [command]             display help for command
```


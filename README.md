# About

[https://www.ulitza.com/about](https://www.ulitza.com/about)

# Usage 

```
Usage: node ./ulitza.js [command]

Commands:
  download <country>         Download the latest osm data for the given
                             <country>.
  extract <country>          Extract a first, raw, version of all the street
                             names for the given <country>.
  update [country]           Generate the eponym file for the given [country].
                             If [country] is not specified, generate the eponym
                             file containing the data for all countries.
  check [country]            Verify if [country] has duplicate equivalent
                             entries, duplicate urls or consistent urls. If the
                             [country] is not specified, return a list of all
                             the countries where such checks fail.
  inspect <country> <regex>  Inspect the <country> raw osm data. Useful in
                             finding new osm tags containing possible eponyms.
                             Only needed if we're going to modify the
                             generator.
  help [command]             display help for command
```

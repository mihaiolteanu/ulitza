# About

Most popular street names of every country worldwide named after persons
(eponyms). See additional info at [about](https://www.ulitza.com/about)

# Usage

```
Usage: node ./ulitza.js [options] [command]

Options:
  -V, --version              output the version number
  -h, --help                 display help for command

Commands:
  download <country>         Download the latest osm pbf file for the given
                             country. This action is only needed if you're
                             updating to the latest data or if you're modifing
                             the affixes or equivalent files.
  extract <country>          Extract a first version of <country> osm data.
                             Useful for manual inspection of streets, affixes,
                             etc.
  update [country]           Update the eponyms links and counts for [country].
                             If [country] is not given, update the statistics
                             file for all the countries.
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


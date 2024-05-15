# ulitza
The feel-good summary is available at [mihaiolteanu.me/ulitza/about](https://mihaiolteanu.me/ulitza/about).

On the technical side, I've used the functional ramda.js library throughout and
implemented everything with the ease of adding or editing new data from
openstreetmap in mind. The cmdline tool is meant to help with that. Below is
an example from start to finish.

## 1. Download the latest osm pbf data for a country
```
$ node ulitza.js download <country>
```

The [openstreetmap](http://download.geofabrik.de/index.html) data is in an
xml-like format called pbf.

Bring in the latest [openstreetmap](http://download.geofabrik.de/index.html)
data for the given <country> into the data/osm_pbf folder. There is no data
handling or processing of any kind at this point. I haven't made this process
automatically since, if there is no file downloaded I could download one in any
of the following steps, but if one wants bring in the latest osm data, there
would still need to be a command to do just that.


## 2. Extract a raw list of street names

```
$ node ulitza.js extract <country>
```
The prevously downloaded pbf file has tags from which I can figure out what are
the entries containing street names. This creates a gigantic json file in
data/osm_raw folder where each entry is the city name and the street name. This
is the place 


Parse the previously downloaded pbf file and build an array where each entry is
a tuple of city_name and street_name based on osm tags such as `"addr:street"`
and `"is_in:city"` and save this huge array in the data/osm_raw folder. Some of
the entries are clearly duplicates, like the same city name and same street
name. Here is the place to check for affixes.


Here is an snapshot output from my own country that I know, if not perfectly, at
least better than all the other countries,
```
...
["Focșani",   "Strada Cuza-Vodă"],
["Focșani",   "Strada Cuza-Vodă"],
["Focșani",   "Strada Cuza-Vodă"],
["Domnești",  "Șoseaua Alexandru Ioan Cuza"],
["Craiova",   "Strada Alexandru Ioan Cuza"],
["București", "Bulevardul Alexandru Ioan Cuza"],
["București", "Strada Cuza Vodă"],
["Constanța", "Strada Cuza Vodă"],
["Galați",    "Strada Alexandru Ioan Cuza"],
["Galați",    "Strada A. I. Cuza"]
...
```

These entries are for Alexandru Ioan Cuza, the first ruler of the Romanian
principalities in 1859. What is more interesting for our purposes here is that
for the city Focșani there are duplicate entries which we'll filter out in the
next step. Secondly, there is the `Strada`, `Bulevardul` and `Șoseaua` prefixes
which all basically mean `Street`. So those we strip off. Each country has
different such prefixes or suffixes (not in our case here). These are all
gathered in the [affixes.js](affixes.js) file. If you find a new affixes for a
given country, add it here. 

Next, with the prefixes and duplicates removed, we are left with,
```
Cuza-Vodă,
Alexandru Ioan Cuza,
Cuza Vodă
A. I. Cuza
```

which all refer back to the same person. In [equivalents.js](equivalents.js),
each country has a set of such affixes. In writing this I've actually discovered
the last one, `A. I. Cuza`, so I've added this entry, as well,
```
["Cuza Vodă", "Alexandru Ioan Cuza",
              "Cuza-Vodă", 
              "A. I. Cuza"]
```


After such edits, continue with the next steps to make sure the changes are
reflected to the final country's page.

## 2.1 Inspect the raw data
```
$ node ulitza.js inspect <country> <regex>
```

Let's see an output from,
```
$ node ulitza.js inspect romania "cuza vodă"
```

and the output,
```
{
  "type": "node",
  "tags": {
    "addr:city": "Cluj-Napoca",
    "addr:housenumber": "16",
    "addr:postcode": "400107",
    "addr:street": "Strada Cuza Vodă",
    "amenity": "restaurant",
    "delivery": "yes",
    "diet:vegan": "yes",
    "name": "Bistro Lovegan",
    "opening_hours": "Mo-Fr 12:00-17:00",
    "phone": "+40723698654",
    "website": "https://www.meniudigital.ro/bistrolovegan"
    }
  }
```

## 3. Generate a list of street frequencies
```
$ node ulitza.js update <country>
```

For a brand new country, this is a list of street names and their
frequencies. The taks is now to find which of the entries are person names, 
find a wikipedia link to them and manually add it (see other countries as
examples). For an existing country, the previous wikipedia links are
preserved. This is the step to rerun if the [equivalents.js](equivalents.js) or
the [affixes.js](affixes.js) entries for <country> are updated. This will
increase or decrease the street counts, add new streets or remove some of them. 

Here is a snapshot output from the output step in data/countries/romania.json,

```
["Ștefan cel Mare",                         96, ""],
["Cuza Vodă",                               95, ""],
["Nicolae Bălcescu",                        92, ""],
["Florilor",                                87, ""],
["Școlii",                                  84, ""],
["Avram Iancu",                             83, ""],
["Traian",                                  83, ""],
["Trandafirilor",                           82, ""],
["Primăverii",                              80, ""],
["1 Mai",                                   78, ""],
["Victoriei",                               75, ""],
```

At this point we're just having street names, be them of persons or of flowers
and landmarks. If the entry looks like a person's name there there must be
either an English wikipedia article or an article in the country's own language
(Romanian, in this case) about them. If neither, or the entry is not a person's
name, then the third field is left empty,

```
["Ștefan cel Mare",                         96, "https://en.wikipedia.org/wiki/Stephen_the_Great"],
["Cuza Vodă",                               95, "https://en.wikipedia.org/wiki/Alexandru_Ioan_Cuza"],
["Nicolae Bălcescu",                        92, "https://en.wikipedia.org/wiki/Nicolae_Bălcescu"],
["Florilor",                                87, ""],
["Școlii",                                  84, ""],
["Avram Iancu",                             83, "https://en.wikipedia.org/wiki/Avram_Iancu"],
["Traian",                                  83, "https://en.wikipedia.org/wiki/Trajan"],
["Trandafirilor",                           82, ""],
["Primăverii",                              80, ""],
["1 Mai",                                   78, ""],
["Victoriei",                               75, ""],
```

The filtering, with the stripping of affixes and the replacement of equivalents
has worked out. Now Cuza Vodă has 95 towns or villages in which he's in at least
a street name. The name used in equivalents, "Cuza Vodă" in this case, is not
that important, since we will use the name from the wikipedia article when the
name for that person is needed. This makes is consistent across countries in
cases where a certain person appears in more than one country.

This is also a place where you can nicely contribute without touching any
code. That is, adding new links for streets representing person names, remove
them where they are plain wrong (it happens!) or update/edit them if you know
the country better than I do and are confident in your expertise regarding your
heroes and poets. 

## 3.1 Check duplicate equivalent names
```
$ node ulitza.js check <country>
```

With so many persons, as a safety against errors, the check command finds
equivalent names that are specified more than once for the given <country>. So,
if we would have both these entries for the same country (Romania, in this case),
```
["Cuza Vodă", "Alexandru Ioan Cuza",
              "Cuza-Vodă", 
              "A. I. Cuza"]
...
["Alexandru Ioan Cuza", "Cuza Vodă"]
```

the above command will output,
```
$ node ulitza.js check romania
Duplicate Equivalents:
Cuza Vodă
Alexandru Ioan Cuza
```
Just make sure all equivalents are under a single entry and that there are no
duplicate entries. This commands helps in that regard


## 3.2 Check duplicate links and link consistencies
```
$ node ulitza.js check <country>
```
If in the `data/countries/<country>.json` we have duplicate links or not valid
entries for the link field or not wikipedia links, that should be fixed. For
example, assuming these entries somehwere in Romania's json file,
```
["Cuza Vodă",         95, "https://en.wikipedia.org/wiki/Alexandru_Ioan_Cuza"],
...
["Nicolae Balcescu",  15, "https://en.wikipedia.org/wiki/Alexandru_Ioan_Cuza"],
["Titu Maiorescu",    15, "https://news.ycombinator.com/"],
```

the above command will output,
```
$ node ulitza.js check romania
Duplicate Links:
https://en.wikipedia.org/wiki/Alexandru_Ioan_Cuza,2

Inconsistent Links:
https://news.ycombinator.com/
```

This is helpful, as "Nicolae Balcescu" is a different person and you might want
to assign a different link to them. Also, the hacker news website is useful but
not in extracting wiki sumaries nor linking the person to their wikipedia pages
(next steps) so that should also be remedied.

## 3.3 Check everything for consistency or errors
```
$ node ulitza.js check-all
```

Finally, there is an additional helpful command that checks all countries for
such inconsistencies as mentioned above and outputs their names. You should use
the `check` command for the respective country to dig in for further details. As
an example,

```
$ node ulitza.js check-all
Countries with duplicate equivalents:
spain

Countries with duplicate links:
gcc-states
iran
iraq
morocco
romania
tunisia

Countries with inconsistent links:
romania
```


## 4. Generate the html pages
```
$ node ulitza.js html <country>
$ node ulitza.js html-all-countries
$ node ulitza.js html-worldwide
```



# How

All data is taken from
[openstreetmap](http://download.geofabrik.de/index.html).

Only one occurence is allowed per city. This makes the data a bit unrealistic,
since big cities usually have schools, monuments, squares and streets all named
after that same person. But it's also a way to defend against duplicate entries
in the osm file, where a single street is sometimes tagged dozens of times.

I've only considered eponym frequencies greater than one. This defends primarly
against garbage data and also against large output files.

All wikipedia links have been added manually.

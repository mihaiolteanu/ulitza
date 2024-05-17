# ulitza
Famous persons on street names worldwide.

For the feel-good summary check the [ulitza/about](https://mihaiolteanu.me/ulitza/about) page.

On the technical side, the street names are taken from
[openstreetmap](http://download.geofabrik.de/index.html) (osm), wikipedia links
are manually added, street prefixes and suffixes are removed and equivalent
streets are merged into a standard name and their frequencies counted. Each
person has a summary extracted from wikipedia, together with a list of
occupations and a pretty picture. The last step is the generation of a html page
for each country and a worldwide summary with the above data.

The central part of the project is the list of [street
names](data/persons/countries) for each country, the list of
[persons](data/persons/persons.json) and their occupations and the json
structures affecting the way the data is extracted and parsed from osm. That is, the
[affixes](affixes.js) and [equivalents](equivalents.js) files. All these can be easily
modified with any text editor without the need to touch code. All else is
composed of point-free [ramda](https://ramdajs.com/) pipelines that transform,
evolve, extract and compose this data in new ways. A mere 600 lines of code in all.

I've skipped unit tests and typescript and kept the speed of implementation with
the idea that what I've started with initially will not be what I'll have
implemented at the end. That assumption proved correct.

## 1. Download the latest data for a country
```
$ node ulitza.js download <country>
```
The original osm data is in an xml-like format called pbf.

This step saves the latest pbf file to `data/osm/pbf/<country>.osm.pbf`. There
is no data handling or processing of any kind at in this step.


## 2. Extract a raw list of street names
```
$ node ulitza.js extract <country>
```
The previously downloaded pbf file contains all kinds of data that a map usually
does, like lakes, restaurants and you lover's favorite place to watch the city
lights at night. This step figures out what entries are actually street names
and saves them locally (not git-commited) to `data/osm/raw/<country>.json` as
city and street name pairs without any other parsing or filtering.

As an example, here a few entries from one of the countries better known to me,
```
["Constanța",   "Strada Mihai Viteazu"],
["Constanța",   "Strada Mihai Viteazu"],
["Constanța",   "Strada Mihai Viteazu"],
["Cluj-Napoca", "Piața Mihai Viteazu"],
["Cluj-Napoca", "Piața Mihai Viteazul"],
["București",   "Șoseaua Mihai Bravu"],
["București",   "Strada Mihai Viteazul"],
["București",   "Strada Mihai Vodă"],
```
I'll be coming back to this sample list in the next section.

## 3. Generate a list of street frequencies
```
$ node ulitza.js update <country>
```

The entries from the previous simplified example are all referring to the same
person, [Mihai
Viteazul](https://en.wikipedia.org/wiki/Michael_the_Brave). First, for
Constanța, there is just one entry, the other two are duplicates. We get rid of
those in the current step. Secondly, `Piața` refers to a city square, while
`Șoseaua` and `Strada` both mean `Street`. These prefixes also go the way of the
waste dump at this point. How? They are specified as regexes in the
[affixes.js](affixes.js) file and each country has a different set of them. With
these out of the way, there is still the fact that all these names refer to the
same person. In [equivalents.js](equivalents.js), each country has a list of
persons' names that have different spellings but refer back to the same
person. This step replaces all such names with a standard name (the first item
in the next list) and filters out the duplicates. For our example,

```
["Mihai Viteazul", "Mihai Viteazu",
                   "Mihai Vodă",
                   "Mihai Vodă Viteazul",
                   "Mihai Bravu"]
```

After removing duplicates, affixes and reducing all the names to the standard
one, we're left with three instances of `Mihai Viteazul` from the initial list
(you do the math).

The output of the current step is saved in
[data/persons/countries/](data/persons/countries) and includes the
standard name, the frequency and a wikipedia link, initially empty, but filled
in in cases where this step has run before and some links are available,

```
["Mihai Eminescu",     116, ""],
["Tudor Vladimirescu", 114, ""],
["Unirii",             112, ""],
["Mihai Viteazul",     105, ""],
["Libertății",         99,  ""],
["Republicii",         97,  ""],
```

At this point we're just having street names, be them of persons or of flowers
and trees. The last ones we ignore. For the persons we manually add the English
wikipedia entry, if it exists, or the native language one, otherwise. If none,
we leave it empty. Take a look at one of the countries in
[data/persons/country](data/persons/country) for a concrete example.

I've only considered street frequencies greater than one. This defends primarily
against garbage data and also against large output files.

This is also a ripe area of continuous updates and improvements. That is, adding
new links for streets representing person names, remove them where they are
plain wrong (it happens!) or update/edit them if you know the country better
than I do and are confident in your expertise regarding your heroes and poets.

## 4. Add all persons' details in one place
```
$ node ulitza.js wiki <country>
```
Extract a summary, image and a list of occupations for each person from
`data/persons/country/<country>.json` based on their wikipedia links and add them
to [persons.json](data/persons/persons.json), if they don't already exist. This file is a sort of common
database for persons from all countries.

Not all entries have a meaningful summary from which to extract occupations, the
occupations might not be complete, or the summary might be in the native
language. For these cases, I've manually added an `occupations-extra`
key. Ideally, I would go through each person and fill in the occupation
manually. But this is a good-enough temporary solution until that happens for
all persons.


## 5. Generate the html pages
```
$ node ulitza.js html <country>
$ node ulitza.js html-worldwide
$ node ulitza.js html-all-countries
```
Last step, generate html pages for each country and a worldwide summary and save
them in `data/html/countries/<country>.html`. You can also generate all
countries at once, useful when some change affects everything, like the
[template.html](data/html/template.html) file. This one takes some time to
finish.


# Extra utilities commands

Slips happen. While developing this project, these utilities have come in handy.

## Inspect the raw data
```
$ node ulitza.js inspect <country> <regex>
```

Probably the least used, but to extract only the elements containing street
names requires knowing what tags contain them

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

This happens to be a tag for a cheap bodega, but the interesting parts are it's
type ("node") and tags. From its tags it is clear this is a city and on a street.

For countries that are least represented, like China, India, Japan, etc, there
might be different tags. Search your favorite poet and let me know if you
discover anything new.

## Check duplicate equivalent names
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


## Check duplicate links and link consistencies
```
$ node ulitza.js check <country>
```
If in the `data/countries/<country>.json` we have duplicate links or not valid
entries for the link field or not wikipedia links, that should be fixed. For
example, assuming these entries somewhere in Romania's json file,
```
["Cuza Vodă",         95, "https://en.wikipedia.org/wiki/Alexandru_Ioan_Cuza"],
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
not in extracting wiki summaries nor linking the person to their wikipedia pages
(next steps) so that should also be remedied.

## Check everything for consistency or errors
```
$ node ulitza.js check-all
```

Check all countries for such inconsistencies as mentioned above and output their
names. You should use the `check` command for the respective country to dig in
for further details. As an example,

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

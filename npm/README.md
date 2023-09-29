# What

Lists of streets and landmarks named after a person (eponyms) for all countries
worldwide. All data is extracted from openstreetmap, parsed, cleaned and
carefully edited by hand.

# Usage (API)

- **eponyms(country: string, n?: number): [][]**

Get the `n` most frequent eponyms for the given `country`. If `n` is not
specified, get the complete list of known eponyms.

It returns a list of eponyms, where each eponym is a list containing a `Name`,
`Frequency` and `WikipediaURL`.

```
eponyms("france", 3)
=> 
[
  ['Charles de Gaulle', 1151, 'https://en.wikipedia.org/wiki/Charles_de_Gaulle'],
  ['Jean Moulin', 666, 'https://en.wikipedia.org/wiki/Jean_Moulin' ],
  ['Jean Jaurès', 598, 'https://en.wikipedia.org/wiki/Jean_Jaurès' ],
]

eponyms("france").length
=> 
1046
```


- **eponymName(eponym: []): String**

Takes an eponym as returned from the `eponyms` command, and returns it's name.
```
R.map(eponymName, eponyms("france", 3))
=>
[ 'Charles de Gaulle', 'Jean Moulin', 'Jean Jaurès' ]
```


- **eponymCount(eponym: []): number**

Takes an eponym as returned from the `eponyms` command, and returns it's
count.
```
R.map(eponymCount, eponyms("france", 3))
=>
[ 1151, 666, 598 ]
```


- **eponymURL(eponym: []): String**

Takes an eponym as returned from the `eponyms` command, and returns it's
wikipedia url.
```
R.map(eponymURL, eponyms("france", 3))
=>
[
  'https://en.wikipedia.org/wiki/Charles_de_Gaulle',
  'https://en.wikipedia.org/wiki/Jean_Moulin',
  'https://en.wikipedia.org/wiki/Jean_Jaurès'
]
```

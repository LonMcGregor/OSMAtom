# OSM History Feed

Get the history of changes to an OSM region as a feed.

OSM serves us history items as an HTML list, this extension extracts them

Use the extension background page inspect console to set the location preferences, I can't be bothered making a settings page:

```
/* open dev console and use this to force set the location the first time, add your coords in */
chrome.storage.local.set({
    "w":-1,
    "n":1,
    "e":1,
    "s":-1,
    "lim":1,
    "lastrun": 99999999
})
```

There's probably a limit to what osm will give you, so be nice and make it a small area

Related:
https://github.com/LonMcGregor/PatreonATOM
https://github.com/LonMcGregor/itchATOM

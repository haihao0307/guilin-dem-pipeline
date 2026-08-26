[out:json][timeout:300][maxsize:1073741824];

// OpenHistoricalMap hydrology candidates for the clean Kunming crop.
// Preserve start_date, end_date, source and all metadata. Do not merge epochs.
(
  nwr["waterway"~"^(river|stream|canal|ditch|drain|tidal_channel|flowline)$"]
    (24.572710196159,102.452264770003,25.496535815227,103.197928742950);
  nwr["natural"="water"]
    (24.572710196159,102.452264770003,25.496535815227,103.197928742950);
  nwr["landuse"="reservoir"]
    (24.572710196159,102.452264770003,25.496535815227,103.197928742950);
  nwr["waterway"="riverbank"]
    (24.572710196159,102.452264770003,25.496535815227,103.197928742950);
  nwr["natural"="spring"]
    (24.572710196159,102.452264770003,25.496535815227,103.197928742950);
  nwr["waterway"~"^(dam|weir|waterfall|lock_gate|rapids)$"]
    (24.572710196159,102.452264770003,25.496535815227,103.197928742950);
  relation["type"="waterway"]
    (24.572710196159,102.452264770003,25.496535815227,103.197928742950);
);
out meta geom;

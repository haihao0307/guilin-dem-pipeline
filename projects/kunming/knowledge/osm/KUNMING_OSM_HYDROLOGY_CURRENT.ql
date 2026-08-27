[out:json][timeout:300][maxsize:1073741824];

// Kunming clean-crop hydrology extraction
// bbox order: south, west, north, east
// 24.572710196159,102.452264770003,25.496535815227,103.197928742950

(
  // Linear waterways. Way direction should point downstream.
  nwr["waterway"~"^(river|stream|canal|ditch|drain|tidal_channel|flowline)$"]
    (24.572710196159,102.452264770003,25.496535815227,103.197928742950);

  // Inland water areas: lakes, reservoirs, wide rivers, ponds and related classes.
  nwr["natural"="water"]
    (24.572710196159,102.452264770003,25.496535815227,103.197928742950);

  // Legacy reservoir and riverbank tagging retained for completeness.
  nwr["landuse"="reservoir"]
    (24.572710196159,102.452264770003,25.496535815227,103.197928742950);
  nwr["waterway"="riverbank"]
    (24.572710196159,102.452264770003,25.496535815227,103.197928742950);

  // Springs, barriers and hydraulic features.
  nwr["natural"="spring"]
    (24.572710196159,102.452264770003,25.496535815227,103.197928742950);
  nwr["waterway"~"^(dam|weir|waterfall|lock_gate|rapids)$"]
    (24.572710196159,102.452264770003,25.496535815227,103.197928742950);

  // Unified waterway relations with main/side stream topology.
  relation["type"="waterway"]
    (24.572710196159,102.452264770003,25.496535815227,103.197928742950);
);

out body geom;

[out:json][timeout:180];
(
  way["natural"="coastline"](29.14700000,120.46101184,29.28651969,120.78402368);
  way["waterway"~"^(river|stream|canal|tidal_channel)$"](29.14700000,120.46101184,29.28651969,120.78402368);
);
out tags geom qt;

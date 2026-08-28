[out:json][timeout:180];
(
  way["natural"="coastline"](29.14700000,121.09503551,29.28651969,121.41804735);
  way["waterway"~"^(river|stream|canal|tidal_channel)$"](29.14700000,121.09503551,29.28651969,121.41804735);
);
out tags geom qt;

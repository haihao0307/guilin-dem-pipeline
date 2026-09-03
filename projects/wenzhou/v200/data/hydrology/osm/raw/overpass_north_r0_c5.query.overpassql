[out:json][timeout:180];
(
  way["natural"="coastline"](29.14700000,121.72905919,29.28651969,122.04907103);
  way["waterway"~"^(river|stream|canal|tidal_channel)$"](29.14700000,121.72905919,29.28651969,122.04907103);
);
out tags geom qt;

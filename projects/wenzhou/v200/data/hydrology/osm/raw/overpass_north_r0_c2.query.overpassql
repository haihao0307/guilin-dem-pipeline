[out:json][timeout:180];
(
  way["natural"="coastline"](29.14700000,120.77802368,29.28651969,121.10103551);
  way["waterway"~"^(river|stream|canal|tidal_channel)$"](29.14700000,120.77802368,29.28651969,121.10103551);
);
out tags geom qt;

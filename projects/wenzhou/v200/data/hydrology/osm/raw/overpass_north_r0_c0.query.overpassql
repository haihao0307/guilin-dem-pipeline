[out:json][timeout:180];
(
  way["natural"="coastline"](29.14700000,120.14700000,29.28651969,120.46701184);
  way["waterway"~"^(river|stream|canal|tidal_channel)$"](29.14700000,120.14700000,29.28651969,120.46701184);
);
out tags geom qt;

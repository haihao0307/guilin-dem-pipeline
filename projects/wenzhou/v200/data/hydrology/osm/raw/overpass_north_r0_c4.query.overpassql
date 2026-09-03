[out:json][timeout:180];
(
  way["natural"="coastline"](29.14700000,121.41204735,29.28651969,121.73505919);
  way["waterway"~"^(river|stream|canal|tidal_channel)$"](29.14700000,121.41204735,29.28651969,121.73505919);
);
out tags geom qt;

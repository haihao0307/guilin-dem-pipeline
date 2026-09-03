[out:json][timeout:180];
(
  way["natural"="coastline"](27.29379747,121.41204735,27.40300000,121.73505919);
  way["waterway"~"^(river|stream|canal|tidal_channel)$"](27.29379747,121.41204735,27.40300000,121.73505919);
);
out tags geom qt;

[out:json][timeout:180];
(
  way["natural"="coastline"](27.29379747,121.72905919,27.40300000,122.04907103);
  way["waterway"~"^(river|stream|canal|tidal_channel)$"](27.29379747,121.72905919,27.40300000,122.04907103);
);
out tags geom qt;

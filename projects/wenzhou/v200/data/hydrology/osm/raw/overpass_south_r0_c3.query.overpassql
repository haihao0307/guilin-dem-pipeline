[out:json][timeout:180];
(
  way["natural"="coastline"](27.29379747,121.09503551,27.40300000,121.41804735);
  way["waterway"~"^(river|stream|canal|tidal_channel)$"](27.29379747,121.09503551,27.40300000,121.41804735);
);
out tags geom qt;

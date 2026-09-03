[out:json][timeout:180];
(
  way["natural"="coastline"](27.29379747,120.77802368,27.40300000,121.10103551);
  way["waterway"~"^(river|stream|canal|tidal_channel)$"](27.29379747,120.77802368,27.40300000,121.10103551);
);
out tags geom qt;

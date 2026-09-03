[out:json][timeout:180];
(
  way["natural"="coastline"](27.29379747,120.14700000,27.40300000,120.46701184);
  way["waterway"~"^(river|stream|canal|tidal_channel)$"](27.29379747,120.14700000,27.40300000,120.46701184);
);
out tags geom qt;

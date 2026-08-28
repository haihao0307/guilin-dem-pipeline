[out:json][timeout:180];
(
  way["natural"="coastline"](27.29379747,120.46101184,27.40300000,120.78402368);
  way["waterway"~"^(river|stream|canal|tidal_channel)$"](27.29379747,120.46101184,27.40300000,120.78402368);
);
out tags geom qt;

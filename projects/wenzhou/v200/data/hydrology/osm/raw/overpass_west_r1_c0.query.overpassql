[out:json][timeout:180];
(
  way["natural"="coastline"](27.62291784,119.84414554,27.96103821,120.15300000);
  way["waterway"~"^(river|stream|canal|tidal_channel)$"](27.62291784,119.84414554,27.96103821,120.15300000);
);
out tags geom qt;

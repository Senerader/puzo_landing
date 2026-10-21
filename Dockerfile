FROM caddy:2.10-alpine

COPY Caddyfile /etc/caddy/Caddyfile
COPY index.html styles.css script.js theme-init.js robots.txt sitemap.xml /srv/
COPY public/ /srv/

EXPOSE 80 443 443/udp

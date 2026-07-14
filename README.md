# VDRONE Track Downloader

An unofficial, read-only directory for searching and downloading VelociDrone's
public official tracks. The React interface runs on Cloudflare Pages, metadata is
indexed in D1, Pages Functions proxy downloads from VelociDrone, and a scheduled
Worker refreshes the catalogue daily.

## Local development

```bash
npm install
npx wrangler d1 migrations apply vdrone-tracks-db --local
npm run build
npx wrangler pages dev dist
```

Run tests with `npm test`. The legacy standalone catalogue/downloader utility is
still available as `vd_track_scraper.py`. VelociDrone's catalogue can retain
historical metadata after a `.trk` file has been removed; the utility reports
those entries as unavailable and continues downloading the remaining tracks.

## Cloudflare resources

- Pages project: `vdrone-tracks`
- D1 database: `vdrone-tracks-db`
- Scheduled Worker: `vdrone-tracks-sync`
- Schedule: `17 3 * * *` UTC

Deploy with `npm run deploy:sync` and `npm run deploy:pages`. The sync Worker
requires a `SYNC_TOKEN` secret; an authorized `POST /sync` performs a manual refresh.

Only metadata exposed by the official public catalogue is indexed: track name,
online ID, scenery, version, date, numeric type, rating, and rating count. Creator
identity is not exposed by that endpoint.

# Together Room sample sandbox

## Entry point

Open `/demo`, or choose **Try it with sample data** on the first screen.

The sample contains a two-player room for Alex and Sam. Star Signal starts at
four of six symbols. Patchwork Pair and Firefly Ferry appear as completed
rounds with realistic turn counts. Choosing the sample move completes the
current round.

## Isolation

`GET /api/demo` creates a random, 24-hour sample workspace identifier and
returns read-only sample data from server memory. It does not query or mutate
the SQLite room tables. The browser keeps sample progress only in JavaScript
memory. Demo mode never reads or writes `localStorage`, `sessionStorage`, or a
real room endpoint.

The persistent banner says **Demo — sample data, nothing is saved**. **Reset
demo** requests a fresh in-memory sample. **Start for real** discards the sample
and returns to the normal entry screen.

When the network is unavailable after the first visit, `/demo` uses the same
bundled sample data from the cached app shell. It still uses no browser storage.

## Verification

```bash
npm run test:claims -- --grep "@claim:demo-sandbox"
npm run test:claims -- --grep "@claim:privacy-boundary"
npm run test:claims -- --grep "@claim:offline-sample"
```

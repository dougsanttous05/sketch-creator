# Sketch Creator

A browser-based React/TypeScript generator for UB/UC member sketches with top and base plates, hole grids and an A4 SVG drawing.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm ci
npm run dev
```

`npm run build` type-checks and builds to `dist/`. `npm test` exercises catalogue lookup, section geometry, CSV validation and hole layouts.

## Usage

Select a profile, enter the member length and plate dimensions, then configure holes. Export SVG, use Quick view for PNG, or Print / Save PDF. All dimensions are millimetres. The drawing uses actual section depth h and flange width b; member length is a separate value. Elevation is schematic, not to scale. Section traces omit root radii; this is a sketch tool, not structural connection design or approval. Hole validation checks geometric fit, not code-required edge distances, bolt capacity or weld capacity.

Invalid profiles clear prior dimensions. Invalid geometry or hole layouts disable export. CSV imports update the selected profile immediately and are kept only for the current browser session.

## CSV

Required header: `size,h,b,tf,tw`. Use comma separators with decimal points, or semicolon separators with decimal points/commas. LF and CRLF line endings are accepted. Empty, non-positive, impossible or duplicate rows reject the entire import before catalogue mutation. Legacy `size,b,tf,tw` files need a real section depth; nominal names must not be used as actual dimensions. See `public/example-profiles.csv`.

## Catalogue sources

The 16 built-in profiles were checked against manufacturer tables:

- [British Steel UC datasheet 100723](https://www.britishsteel.co.uk/wp-content/uploads/2026/02/british-steel-universal-columns-datasheet-100723.pdf)
- [British Steel UB datasheet 190724](https://www.britishsteel.co.uk/wp-content/uploads/2026/02/british-steel-universal-beams-datasheet-190724.pdf)

`305x165x36` from the original sample is omitted because it was not verified in these tables. Additional profiles can be imported with verified dimensions. The catalogue is a subset, not the complete Blue Book. Imported entries may replace existing profiles; verify their source before use.

## Issue #1

The previous README contained an unfinished TSX application, an invalid newline regex, rounded section values and a square section trace using b for both axes. The runnable source now lives in `src/`; the original is preserved in `original-README.md` for traceability. This change restores the application, corrects the dimensional model and adds validation. The issue's original intent was not described beyond a README link.

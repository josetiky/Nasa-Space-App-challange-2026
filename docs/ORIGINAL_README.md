# Mars Survival Map

I want to make a website for nasa space app challange our challange is Interplanetary Survival Guide: Martian Map

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://mars-guide-buddy.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ab2f2311-524f-4f1a-b83b-1182f8126890).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```


## Interplanetary Survival Guide — NASA Space Apps 2026

This build combines the Lovable/TanStack application, the local Mars 3D asset, and the NASA dataset pages supplied in the project bundle.

### Data pipeline

`NASA Open Data metadata → provenance registry → planning layers → interactive Mars explorer → survival simulator`

The UI exposes four planning layers:
- Terrain classification
- Thermal environment
- Radiation environment
- Mineralogy / spectroscopy

The uploaded NASA archive contains dataset web pages/metadata rather than the complete raw instrument archives. For that reason, the current planning metrics are explicitly labeled as demo/model values. The source links in **NASA Data** open the corresponding NASA Open Data Portal records.

### Run

```bash
npm install
npm run dev
```

### Build

```bash
npm run build
```

### Main demo flow

1. Open **Mission Map**.
2. Rotate the 3D Mars model and select a candidate sector.
3. Toggle terrain / hazard / resource / rover / route layers.
4. Open **NASA Data** to show provenance and the data-fusion pipeline.
5. Open **Survival Simulator** and change crew, duration, water, power, shielding and dust conditions.
6. Use the existing **Marswalk** presentation mode for the final judging story.

### Asset provenance

The bundled Mars model comes from the supplied `mars.zip` package. Its GLTF metadata identifies Nestaeric as the author and CC BY 4.0 as the model license. Keep the attribution visible in the project if you redistribute the asset.

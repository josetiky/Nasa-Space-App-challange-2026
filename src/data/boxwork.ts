import { planRoverTraverseEva, type RoverEvaOptions, type RoverEvaResult, type RoverWaypoint, type TraverseStop } from "@/core/science/roverTraverse";

/**
 * Curiosity's boxwork campaign on Mount Sharp, Gale crater (sols 4530–4711, May–November 2025).
 *
 * REAL — end-of-drive waypoints from NASA/JPL MMGIS (MSL_waypoints.json, fields sol, site, drive, lat,
 * lon, elev_geoid, tilt, dist_m, dist_total_m), retrieved 2026-11-09 and checked against the source
 * with column checksums. Coordinates are planetocentric degrees (east-positive); elevations are metres
 * above the areoid; tilt is the rover's attitude at the end of each drive.
 * Science stops: NASA's Curiosity mission blog and Photojournal (one link per stop). Stop texts are
 * summaries written for this app; the science weights are MODEL ASSUMPTIONS for EVA planning.
 */
export const BOXWORK_META = {
  waypointsUrl: "https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json",
  retrieved: "2026-11-09",
  credit: "NASA/JPL-Caltech (MSL MMGIS)",
  basemap: {
    layer: "curiosity_hirise_mosaic",
    label: "MRO HiRISE · Curiosity roving-site mosaic",
    template: "https://trek.nasa.gov/tiles/Mars/EQ/curiosity_hirise_mosaic/1.0.0/default/default028mm/{z}/{y}/{x}.png",
    /** Highest zoom Trek serves for this area (≈0.64 m per pixel at the equator). */
    maxNativeZoom: 16,
    bounds: [
      [-4.9254743, 137.1224669],
      [-4.2489588, 137.7298129],
    ] as [[number, number], [number, number]],
    credit: "NASA/JPL/University of Arizona (MRO HiRISE) via NASA Mars Trek",
  },
} as const;

// [sol, site, drive, lat, lon, elevation (m), tilt (deg), drive length (m), odometer (m)]
const RAW: Array<[number, number, number, number, number, number, number, number, number]> = [
  [4530, 115, 2436, -4.7974089, 137.3870676, -3659.8, 6.64, 28.55, 34995],
  [4532, 115, 2616, -4.7974970, 137.3866494, -3658.3, 8.25, 26.25, 35021],
  [4534, 116, 0, -4.7976176, 137.3864361, -3657.6, 9.01, 25.42, 35047],
  [4537, 116, 156, -4.7977868, 137.3862000, -3655.6, 9.84, 18.62, 35065],
  [4539, 116, 408, -4.7978160, 137.3859207, -3655.0, 7.05, 22.43, 35088],
  [4541, 116, 414, -4.7978159, 137.3859258, -3655.0, 5.98, 0.31, 35088],
  [4544, 116, 576, -4.7979600, 137.3856636, -3654.5, 2.32, 19.9, 35108],
  [4546, 116, 870, -4.7982652, 137.3850097, -3653.5, 9.98, 45.44, 35153],
  [4548, 116, 1260, -4.7987929, 137.3840451, -3650.8, 6.61, 69.18, 35223],
  [4552, 116, 1596, -4.7992700, 137.3835727, -3648.4, 7.2, 42.5, 35265],
  [4554, 116, 1806, -4.7997141, 137.3834371, -3645.7, 8.39, 29.31, 35294],
  [4558, 116, 1890, -4.7998116, 137.3834991, -3646.6, 5.85, 7.3, 35302],
  [4560, 116, 1944, -4.7998472, 137.3835414, -3647.2, 8.33, 3.84, 35305],
  [4571, 116, 2214, -4.8004069, 137.3829870, -3643.9, 2.22, 48, 35353],
  [4573, 116, 2562, -4.8011638, 137.3825170, -3644.2, 4.5, 53.49, 35407],
  [4575, 117, 0, -4.8019084, 137.3821132, -3644.4, 4.85, 55.11, 35462],
  [4578, 117, 168, -4.8019306, 137.3817054, -3645.5, 5.3, 24.46, 35487],
  [4580, 117, 420, -4.8023264, 137.3812512, -3643.9, 3.5, 37.15, 35524],
  [4582, 117, 492, -4.8023463, 137.3812526, -3643.8, 3.18, 4.02, 35528],
  [4585, 117, 702, -4.8025677, 137.3810530, -3644.1, 4.36, 21.58, 35549],
  [4587, 117, 840, -4.8027362, 137.3807901, -3643.5, 7.87, 18.51, 35568],
  [4588, 117, 1008, -4.8024296, 137.3805951, -3645.3, 6.97, 23.41, 35591],
  [4591, 117, 1122, -4.8025097, 137.3804498, -3644.6, 13.9, 10.63, 35602],
  [4594, 117, 1434, -4.8029630, 137.3804319, -3642.4, 6.9, 34.6, 35636],
  [4596, 117, 1890, -4.8036058, 137.3800743, -3640.5, 6.54, 60.64, 35697],
  [4598, 117, 2166, -4.8040160, 137.3797556, -3635.9, 9.21, 34.72, 35732],
  [4600, 117, 2370, -4.8041890, 137.3796858, -3632.9, 16.96, 21.22, 35753],
  [4602, 117, 2490, -4.8043668, 137.3796237, -3630.8, 6.81, 13.06, 35766],
  [4605, 117, 2538, -4.8044334, 137.3795572, -3631.5, 3.96, 5.27, 35771],
  [4609, 117, 2730, -4.8047401, 137.3793204, -3624.3, 13.43, 24.06, 35795],
  [4612, 117, 2850, -4.8049451, 137.3792959, -3623.5, 10.04, 13.25, 35809],
  [4614, 118, 0, -4.8052060, 137.3794477, -3622.4, 6.59, 26.33, 35835],
  [4616, 118, 162, -4.8054528, 137.3795247, -3620.6, 7.41, 15.83, 35851],
  [4618, 118, 198, -4.8054951, 137.3795358, -3620.5, 9.85, 3.61, 35854],
  [4621, 118, 372, -4.8054139, 137.3795125, -3620.1, 4.8, 14.62, 35869],
  [4623, 118, 534, -4.8054839, 137.3799173, -3621.6, 7.41, 24.52, 35894],
  [4625, 118, 762, -4.8058591, 137.3797583, -3617.7, 9.83, 25.51, 35919],
  [4628, 118, 924, -4.8059902, 137.3794602, -3613.9, 11.82, 19.67, 35939],
  [4629, 118, 1194, -4.8061668, 137.3797230, -3614.0, 12.08, 32.38, 35971],
  [4633, 118, 1350, -4.8064580, 137.3796739, -3611.2, 13.64, 19.43, 35991],
  [4634, 118, 1608, -4.8063562, 137.3791167, -3609.9, 17.53, 34.97, 36026],
  [4636, 118, 1752, -4.8065382, 137.3793381, -3607.1, 13.27, 18.32, 36044],
  [4639, 118, 1776, -4.8065533, 137.3793171, -3606.7, 15.04, 1.78, 36046],
  [4641, 118, 1944, -4.8066905, 137.3793537, -3608.1, 13.3, 15.68, 36061],
  [4643, 118, 2028, -4.8067965, 137.3794121, -3604.7, 13.24, 8.23, 36070],
  [4647, 118, 2268, -4.8068906, 137.3798121, -3610.5, 8.33, 27.48, 36097],
  [4650, 118, 2304, -4.8068928, 137.3798418, -3610.5, 11.93, 1.9, 36099],
  [4653, 118, 2466, -4.8070803, 137.3798962, -3608.0, 10, 17.26, 36116],
  [4655, 118, 2538, -4.8071683, 137.3798956, -3607.7, 4.71, 5.19, 36121],
  [4660, 118, 2742, -4.8074521, 137.3800604, -3605.5, 8.2, 21.24, 36143],
  [4662, 118, 2832, -4.8076276, 137.3801893, -3606.1, 8.63, 12.75, 36155],
  [4664, 118, 3156, -4.8079252, 137.3802489, -3605.2, 5.63, 35.69, 36191],
  [4667, 119, 0, -4.8080233, 137.3805074, -3604.8, 8.16, 17.47, 36209],
  [4669, 119, 198, -4.8080522, 137.3808830, -3606.5, 7.37, 26.48, 36235],
  [4671, 119, 486, -4.8082710, 137.3812695, -3608.3, 8.35, 33.35, 36268],
  [4673, 119, 846, -4.8087161, 137.3815696, -3606.6, 8.61, 36.69, 36305],
  [4677, 119, 924, -4.8087123, 137.3816902, -3606.6, 4.39, 10.21, 36315],
  [4680, 119, 1344, -4.8082715, 137.3812465, -3608.0, 8.87, 44.66, 36360],
  [4684, 119, 1554, -4.8080110, 137.3810178, -3607.9, 9.26, 24.02, 36384],
  [4687, 119, 1722, -4.8078392, 137.3810353, -3610.4, 6.71, 17.1, 36401],
  [4709, 120, 0, -4.8079993, 137.3810495, -3608.7, 9.65, 10.4, 36411],
  [4711, 120, 82, -4.8080076, 137.3810041, -3607.7, 11, 3.71, 36415],
];

export const BOXWORK_WAYPOINTS: RoverWaypoint[] = RAW.map(([sol, site, drive, lat, lon, elevationM, tiltDeg, driveM, odometerM]) => ({ sol, site, drive, lat, lon, elevationM, tiltDeg, driveM, odometerM }));

const BLOG = "https://science.nasa.gov/blog/";

/** Science stops on the traverse, each tied to the waypoint where Curiosity worked (sources: NASA). */
export const BOXWORK_STOPS: TraverseStop[] = [
  {
    id: "boxwork-contact",
    sol: 4534,
    title: "Into the boxwork unit",
    kind: "context",
    weight: 0.4,
    text: "Start of the campaign's first phase (sols 4534–4570): Curiosity's initial observations of the boxwork unit.",
    source: { label: "NASA Curiosity blog, sols 4804–4811 (campaign phases)", url: `${BLOG}curiosity-blog-sols-4804-4811-kicking-off-the-final-phase-of-boxwork-exploration` },
  },
  {
    id: "fractured-ridge",
    sol: 4541,
    title: "Fractured ridge up close",
    kind: "outcrop",
    weight: 0.5,
    text: "Mastcam's close view of a curb-like boxwork ridge, taken on sol 4541 (16 May 2025) — image PIA26558.",
    source: { label: "NASA Photojournal PIA26558", url: "https://science.nasa.gov/photojournal/curiosity-views-a-fractured-boxwork-pattern-up-close" },
    images: [
      { src: "https://images-assets.nasa.gov/image/PIA26558/PIA26558~thumb.jpg", caption: "PIA26558 · Mastcam, sol 4541 · NASA/JPL-Caltech/MSSS", href: "https://images-assets.nasa.gov/image/PIA26558/PIA26558~medium.jpg" },
      { src: "https://images-assets.nasa.gov/image/PIA26559/PIA26559~thumb.jpg", caption: "PIA26559 · 360° Mastcam panorama, 15–18 May 2025 · NASA/JPL-Caltech/MSSS", href: "https://images-assets.nasa.gov/image/PIA26559/PIA26559~medium.jpg" },
    ],
  },
  {
    id: "altadena",
    sol: 4560,
    title: "Altadena drill site",
    kind: "drill",
    weight: 1,
    text: "Drill site at the edge of the boxwork unit (June 2025), Curiosity's 43rd. The rover stayed here until a ~48 m drive on sol 4571.",
    source: { label: "NASA Curiosity blog, sols 4568–4569", url: `${BLOG}curiosity-blog-sols-4568-4569-a-close-look-at-the-altadena-drill-hole-and-tailings/` },
    alsoSee: [{ label: "Blog, sols 4570–4572", url: `${BLOG}curiosity-blog-sols-4570-4572-a-fond-farewell-with-a-side-of-frost/` }],
  },
  {
    id: "asiruqucha-hollow",
    sol: 4628,
    title: "Hollow bedrock (Asiruqucha)",
    kind: "hollow",
    weight: 0.6,
    text: "Contact science on bedrock inside a hollow (APXS target Asiruqucha), followed by a ~30 m drive toward a ridge.",
    source: { label: "NASA Curiosity blog, sols 4629–4630", url: `${BLOG}curiosity-blog-sols-4629-4630-feeling-hollow/` },
  },
  {
    id: "mojo-hollow",
    sol: 4641,
    title: "Mojo hollow",
    kind: "hollow",
    weight: 0.6,
    text: "Reached by a ~15 m drive around a ridge into the next hollow; the following drive climbed onto the ridge to its south.",
    source: { label: "NASA Curiosity blog, sols 4641–4648", url: `${BLOG}curiosity-blog-sols-4641-4648-thinking-outside-and-inside-the-boxwork/` },
  },
  {
    id: "ridge-nodules",
    sol: 4650,
    title: "Ridge-to-hollow transition",
    kind: "outcrop",
    weight: 0.8,
    text: "Smooth ridge-top bedrock giving way to nodular bedrock at the edge of a shallow hollow, reached with a ~2 m bump.",
    source: { label: "NASA Curiosity blog, sols 4649–4654", url: `${BLOG}curiosity-blog-sols-4649-4654-ridges-hollows-and-nodules-oh-my/` },
  },
  {
    id: "valle-de-la-luna",
    sol: 4687,
    title: "Valle de la Luna drill · Monte Grande hollow",
    kind: "drill",
    weight: 1,
    text: "Curiosity's 44th drill hole, inside the Monte Grande hollow (October 2025); the powder went to the CheMin and SAM instruments.",
    source: { label: "NASA Curiosity blog, sols 4695–4701", url: "https://science.nasa.gov/solar-system/curiosity-blog-sols-4695-4701-searching-for-answers-at-monte-grande" },
    alsoSee: [{ label: "Blog, sols 4689–4694", url: `${BLOG}curiosity-blog-sols-4689-4694-drill-in-the-boxwork-unit-is-go/` }],
  },
  {
    id: "nevado-sajama",
    sol: 4711,
    title: "Nevado Sajama drill · ridge top",
    kind: "drill",
    weight: 1,
    text: "The ridge partner of the hollow sample, about 10 m away and ~2 m higher; drilled on sol 4718.",
    source: { label: "NASA Curiosity blog, sols 4709–4715", url: `${BLOG}curiosity-blog-sols-4709-4715-drilling-high-and-low-in-the-boxwork-unit` },
    alsoSee: [{ label: "Blog, sols 4716–4722", url: "https://science.nasa.gov/solar-system/curiosity-blog-sols-4716-4722-drilling-success-at-nevado-sajama" }],
  },
];

/** What boxwork is, for the panel header (sources: NASA). */
export const BOXWORK_CONTEXT = {
  text: "Boxwork: low ridges about 1–2 m tall with sandy hollows between them, a fracture network 10–20 km across on Mount Sharp. Minerals carried by ancient groundwater are thought to have hardened the rock along the fractures before wind eroded the rest.",
  sources: [
    { label: "NASA, Curiosity sees Martian 'spiderwebs' up close", url: "https://www.nasa.gov/missions/mars-science-laboratory/curiosity-rover/NASAs-curiosity-rover-sees-martian-spiderwebs-up-close/" },
    { label: "Photojournal PIA26306", url: "https://photojournal.jpl.nasa.gov/catalog/PIA26306" },
  ],
} as const;

export const BOXWORK_SITE_ID = "boxwork";
export const BOXWORK_SITE_NAME = "Mount Sharp boxwork (Gale)";

/** Ready-made EVAs along the real path (choices of start/end only — nothing invented). */
export const BOXWORK_PRESETS = [
  { id: "drills", label: "Drill sites loop", fromSol: 4641, toSol: 4711, returnToStart: true, note: "Mojo hollow → both 2025 drill holes and back" },
  { id: "approach", label: "Entering the boxwork", fromSol: 4530, toSol: 4560, returnToStart: true, note: "Unit contact → fractured ridge → Altadena and back" },
  { id: "campaign", label: "Whole campaign, one way", fromSol: 4530, toSol: 4711, returnToStart: false, note: "Curiosity's full 2025 path through the boxwork" },
] as const;

export function planBoxworkEva(opts: Omit<RoverEvaOptions, "siteId" | "siteName">): RoverEvaResult {
  return planRoverTraverseEva(BOXWORK_WAYPOINTS, BOXWORK_STOPS, { ...opts, siteId: BOXWORK_SITE_ID, siteName: BOXWORK_SITE_NAME });
}

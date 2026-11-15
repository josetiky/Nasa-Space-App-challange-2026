/**
 * Surface EVA sites reused from Access Mars (Google Creative Lab · NASA/JPL-Caltech, Apache-2.0).
 * Terrain meshes are reconstructed from Curiosity stereo imagery (Gale crater). Positions are metres
 * in the site frame (y up). POI texts and voiceovers are from Access Mars; see public/eva/NOTICE.md.
 */

export interface EvaPoi {
  id: string;
  title: string;
  text: string;
  image: string;
  vo?: string;
  position: [number, number, number];
  weight: number;
}

export interface EvaSite {
  id: string;
  name: string;
  solRange: string;
  capturedDate: string;
  planetocentricCoord: { lat: number; lon: number; elevationM: number };
  reconstructionType: "TYPE_A_PHOTOGRAMMETRY";
  description: string;
  traverseDistance: string;
  traverseKm: number;
  basePath: string;
  pois: EvaPoi[];
}

export interface RoverPartPoi {
  id: string;
  title: string;
  target: string;
  channel?: "r" | "g" | "b";
  image: string;
  vo: string;
  text: string;
  position: [number, number, number];
}

export const CURIOSITY_ROVER_PARTS: RoverPartPoi[] = [
  {
    id: "rover_poi_arm",
    title: "Robotic Arm (MAHLI & APXS)",
    target: "arm",
    image: "/eva/cards/rm4.jpg",
    vo: "/eva/vo/rover1.mp3",
    text: "Curiosity's robotic arm contains various instruments to measure rock and soil composition, brush dust away from rocks, take imagery, and even drill into rocks.",
    position: [0.0, 0.9, 1.45],
  },
  {
    id: "rover_poi_mast",
    title: "Remote Sensing Mast (Mastcam & ChemCam)",
    target: "mast",
    image: "/eva/cards/rm1.jpg",
    vo: "/eva/vo/rover2.mp3",
    text: "There are seven different cameras on Curiosity's mast: two pairs of black and white navigation cameras; two color Mastcams; and 'ChemCam,' which uses a powerful laser to vaporize small pieces of rock from up to 7 meters away.",
    position: [0.35, 1.95, 0.55],
  },
  {
    id: "rover_poi_analysis",
    title: "Analytical System (SAM & CheMin)",
    target: "chassis",
    channel: "b",
    image: "/eva/cards/rm2.jpg",
    vo: "/eva/vo/rover3.mp3",
    text: "Curiosity's two large analytical instruments inside its chassis can analyze rock, soil, and atmosphere samples. These measurements help unlock the history of Mars, revealing that Mars would have been habitable in the ancient past.",
    position: [0.0, 1.15, 0.15],
  },
  {
    id: "rover_poi_rtg",
    title: "MMRTG Nuclear Power Source",
    target: "chassis",
    channel: "g",
    image: "/eva/cards/rm3.jpg",
    vo: "/eva/vo/rover4.mp3",
    text: "At the back of Curiosity is its power source, a Radioisotope Thermoelectric Generator — or RTG — that converts the heat created by a small amount of plutonium into electricity.",
    position: [0.0, 1.15, -1.25],
  },
  {
    id: "rover_poi_uhf",
    title: "UHF Orbiter Relay Antenna",
    target: "chassis",
    channel: "r",
    image: "/eva/cards/rm5.jpg",
    vo: "/eva/vo/rover5.mp3",
    text: "Curiosity's UHF antenna sends large amounts of data to satellites orbiting Mars, which then send the data to Earth. In a typical day, Curiosity will return around 50 megabytes of data.",
    position: [-0.45, 1.3, -0.45],
  },
  {
    id: "rover_poi_suspension",
    title: "Rocker-Bogie Mobility System",
    target: "suspension",
    image: "/eva/cards/rm6.jpg",
    vo: "/eva/vo/rover6.mp3",
    text: "Curiosity's wheels are twice the size of wheels on previous rovers, helping it handle rougher terrain. On flat ground, Curiosity has a top speed of four centimeters per second.",
    position: [0.85, 0.45, 0.0],
  },
];

/** Science weight of each POI for EVA planning (MODEL ASSUMPTION: drill/outcrop targets weigh more than context views). */
export const EVA_SITES: EvaSite[] = [
  {
    id: "landing_site",
    name: "Bradbury Landing",
    solRange: "Sol 1 – Sol 20",
    capturedDate: "Aug 7, 2012 – Aug 26, 2012",
    planetocentricCoord: { lat: -4.5895, lon: 137.4417, elevationM: -4501 },
    reconstructionType: "TYPE_A_PHOTOGRAMMETRY",
    description: "Curiosity's landing site (August 2012) on the floor of Gale crater (Aeolis Palus).",
    traverseDistance: "0 km (landing)",
    traverseKm: 0,
    basePath: "/eva/gale/landing_site",
    pois: [
      { id: "ls3", title: "Satellite View", text: "This photo taken from the Mars Reconnaissance Orbiter shows the landing site where you're standing now. It also shows where other parts of the landing system ended up, like the rocket-powered descent stage and the parachute.", image: "/eva/cards/ls1.jpg", vo: "/eva/vo/ls3.mp3", position: [21.0, 0.0, 0.0], weight: 0.3 },
      { id: "ls2", title: "Is This Terrain Real?", text: "All the terrain around you has been created using real data and images from Curiosity. By taking photos with two side-by-side cameras we can reconstruct the terrain in 3D.", image: "/eva/cards/ls2.jpg", vo: "/eva/vo/ls2.mp3", position: [14.0, 0.0, 6.0], weight: 0.3 },
      { id: "ls1", title: "Black And White Tiles", text: "Some areas are black and white because they were only photographed by Curiosity's lower resolution navigation cameras. Frequently, Curiosity has to move on before it can photograph everything with its higher resolution Mastcams.", image: "/eva/cards/ls3.jpg", vo: "/eva/vo/ls1.mp3", position: [-9.0, 0.0, 4.0], weight: 0.2 },
    ],
  },
  {
    id: "pahrump_hills",
    name: "Pahrump Hills",
    solRange: "Sol 753 – Sol 948",
    capturedDate: "Feb 17, 2015 – Mar 11, 2015",
    planetocentricCoord: { lat: -4.6712, lon: 137.4021, elevationM: -4442 },
    reconstructionType: "TYPE_A_PHOTOGRAMMETRY",
    description: "Mudstone outcrops of the Murray formation at the base of Mount Sharp, studied from September 2014 to March 2015.",
    traverseDistance: "≈ 9.7 km along the traverse",
    traverseKm: 9.7,
    basePath: "/eva/gale/pahrump_hills",
    pois: [
      { id: "ph1", title: "Arrival", text: "Curiosity arrived in Pahrump Hills in September 2014. It began conducting a walkabout of the area, the same way geologists on Earth do field work. It surveyed the area, then scientists chose which sites to examine more closely.", image: "/eva/cards/ph1.jpg", vo: "/eva/vo/ph1.mp3", position: [1.9, 1.0, -3.9], weight: 0.5 },
      { id: "ph2", title: "Ancient History", text: "Sedimentary rocks in this area appear to have formed in the presence of water. Scientists think this could have been the bottom of a lake, billions of years ago.", image: "/eva/cards/ph2.jpg", vo: "/eva/vo/ph2.mp3", position: [2.8, 2.5, -7.3], weight: 0.8 },
      { id: "ph3", title: "Drill Site (Mojave & Telegraph Peak)", text: "Curiosity analyzed several samples in this area using its drill and instruments. Minerals found here suggest that the chemistry of this lake was changing. This suggests that environments on Mars capable of supporting life varied over time.", image: "/eva/cards/ph3.jpg", vo: "/eva/vo/ph3.mp3", position: [6.98, 1.13, -5.61], weight: 1.0 },
      { id: "ph4", title: "Mount Sharp", text: "Pahrump Hills is at the base of Mount Sharp, a major objective for Curiosity. From orbit, we have seen layers of minerals reaching from the floor of Gale Crater to the foot hills of Mount Sharp. By climbing up the slope, layer by layer, Curiosity can reveal clues about the history of Mars, and its potential ability to support life.", image: "/eva/cards/ph4.jpg", vo: "/eva/vo/ph4.mp3", position: [-28.9, 4.3, -10.7], weight: 0.6 },
    ],
  },
  {
    id: "marias_pass",
    name: "Marias Pass",
    solRange: "Sol 992 – Sol 1067",
    capturedDate: "May 22, 2015 – Aug 6, 2015",
    planetocentricCoord: { lat: -4.6778, lon: 137.3974, elevationM: -4428 },
    reconstructionType: "TYPE_A_PHOTOGRAMMETRY",
    description: "Unconformable contact between Stimson sandstone and Murray mudstone; Buckskin high-silica / tridymite drill target (2015).",
    traverseDistance: "≈ 10.8 km along the traverse",
    traverseKm: 10.8,
    basePath: "/eva/gale/marias_pass",
    pois: [
      { id: "mp1", title: "Arrival", text: "Curiosity arrived in Marias Pass on May 20, 2015. Here, a younger layer of sandstone sits atop an older layer of mudstone, potentially preserving clues about ancient changes in the Martian environment.", image: "/eva/cards/mp1.jpg", vo: "/eva/vo/mp1.mp3", position: [8.85, -0.65, 5.6], weight: 0.5 },
      { id: "mp2", title: "Buckskin", text: "This target is named \"Buckskin.\" A sample drilled here showed high levels of silica, which could be promising for preserving organic material. It also showed traces of the mineral tridymite, which was left behind by volcanic activity.", image: "/eva/cards/mp2.jpg", vo: "/eva/vo/mp2.mp3", position: [6.1, -0.3, 22.0], weight: 1.0 },
      { id: "mp3", title: "Selfie", text: "Curiosity took this selfie here in August 2015. Observations like this are used to monitor dust deposits, wear on the rover's wheels, and other signs of aging.", image: "/eva/cards/mp3.jpg", vo: "/eva/vo/mp3.mp3", position: [10.8, -0.4, 19.4], weight: 0.4 },
      { id: "mp4", title: "Conjunction", text: "Curiosity spent all of June 2015 parked in this spot, because Mars and Earth were on opposite sides of the Sun. When this 'conjunction' happens, radio signals between Mars and Earth become unreliable, so commands aren't sent to Curiosity.", image: "/eva/cards/mp4.jpg", vo: "/eva/vo/mp4.mp3", position: [2.16, -1.17, 4.88], weight: 0.4 },
    ],
  },
  {
    id: "murray_buttes",
    name: "Murray Buttes",
    solRange: "Sol 1421 – Sol 1458",
    capturedDate: "Sep 1, 2016 – Sep 4, 2016",
    planetocentricCoord: { lat: -4.7031, lon: 137.3912, elevationM: -4404 },
    reconstructionType: "TYPE_A_PHOTOGRAMMETRY",
    description: "Wind-eroded Stimson sandstone buttes with cross-bedding at the entrance to Mount Sharp (September 2016).",
    traverseDistance: "≈ 14.1 km along the traverse",
    traverseKm: 14.1,
    basePath: "/eva/gale/murray_buttes",
    pois: [
      { id: "mb1", title: "Buttes", text: "These are the Murray Buttes. Buttes are steep, knob-like rock formations. The largest one here is about as tall as a three-story building. These buttes served as Curiosity's entryway to its main destination: Mount Sharp.", image: "/eva/cards/mb1.jpg", vo: "/eva/vo/mb1.mp3", position: [13.8, 1.2, 6.9], weight: 0.7 },
      { id: "mb2", title: "Bruce Murray", text: "The Murray Buttes are named after the late Bruce Murray, a Caltech planetary scientist and director of NASA's Jet Propulsion Laboratory. He worked on NASA's first missions to Mars and laid the groundwork for future Mars exploration.", image: "/eva/cards/mb2.jpg", vo: "/eva/vo/mb2.mp3", position: [-10.56, 1.8, -12.9], weight: 0.3 },
      { id: "mb3", title: "Monument Valley", text: "These buttes are similar to ones you'd find on Earth, formed when wind erodes ancient sandstone. Scientists have compared the region to Monument Valley.", image: "/eva/cards/mb3.jpg", vo: "/eva/vo/mb3.mp3", position: [21.0, 6.2, 3.7], weight: 0.6 },
      { id: "mb4", title: "Interference", text: "The buttes are beautiful, but are sometimes tall enough to block the signal between Curiosity and the Mars orbiters that fly overhead. That can temporarily reduce the amount of data that Curiosity can send back to Earth.", image: "/eva/cards/mb4.jpg", vo: "/eva/vo/mb4.mp3", position: [-63.5, -3.9, 35.2], weight: 0.3 },
    ],
  },
  {
    id: "live_site",
    name: "Vera Rubin Ridge Approach (Access Mars Live Site)",
    solRange: "Sol 1834",
    capturedDate: "Oct 3, 2017",
    planetocentricCoord: { lat: -4.7215, lon: 137.3948, elevationM: -4175 },
    reconstructionType: "TYPE_A_PHOTOGRAMMETRY",
    description: "Photogrammetric stereo terrain captured by Curiosity on October 3, 2017 along the ascent of Vera Rubin Ridge on Mount Sharp.",
    traverseDistance: "≈ 17.5 km along the traverse",
    traverseKm: 17.5,
    basePath: "/eva/gale/live_site",
    pois: [
      { id: "lv1", title: "Vera Rubin Ridge Ascent", text: "Photographed on October 3, 2017 (Sol 1834) as Curiosity ascended Vera Rubin Ridge, an erosion-resistant hematite-bearing topographic ridge on northwestern Mount Sharp.", image: "/eva/cards/ph4.jpg", vo: "/eva/vo/intro1.mp3", position: [4.5, 0.5, -4.0], weight: 0.8 },
      { id: "lv2", title: "Navcam / Mastcam Stereo Mosaic", text: "Reconstructed directly from Curiosity's onboard stereo navigation and mast cameras by the NASA JPL OnSight pipeline.", image: "/eva/cards/ls2.jpg", vo: "/eva/vo/intro2.mp3", position: [-6.0, 0.2, 5.5], weight: 0.5 },
    ],
  },
];

export const GALE_REFERENCE = { lat: -4.5895, lon: 137.4417, name: "Gale crater (Curiosity landing site)" } as const;
